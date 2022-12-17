import express from 'express'
import currentUserMdw from '../middlewares/currentUser.mdw.js'
import accountModel from '../models/account.model.js'
import debtReminderModel from '../models/debtReminder.model.js'
import { accountViewModel } from '../view_models/account.viewModel.js'
import otpGenerator from 'otp-generator'
import transactionModel from '../models/transactionModel.js'
import nodemailer from 'nodemailer'
import fs from 'fs'
import otpModel from '../models/otp.model.js'

const router = express.Router()

router.use(currentUserMdw)
router.post('/', async (req, res) => {
  let data = req.body
  const currentUser = res.locals.currentUser
  data = {
    ...data,
    user_id: currentUser.id,
    isPaid: false
  }
  await debtReminderModel.add(data)
  return res.status('200').json(data)
})

router.get('/', async (req, res) => {
  const currentUser = res.locals.currentUser
  const ret = await debtReminderModel.fetch({ user_id: currentUser.id }, 'id amount note isPaid user_id account_id'.split(' '))
  return res.status('200').json(ret)
})

router.delete('/:id', async (req, res) => {
  const currentUser = res.locals.currentUser
  const { id } = req.params
  const ret = await debtReminderModel.fetch({ id, user_id: currentUser.id })
  if (!ret[0]) {
    return res.status('200').json({ error_message: 'Không tìm thấy nhắc nợ' })
  }
  await debtReminderModel.delete(id)
  return res.status('200').json({ message: 'Xóa thành công' })
})

router.patch('/:id', async (req, res) => {
  const currentUser = res.locals.currentUser
  const { id } = req.params
  const data = req.body
  const ret = await debtReminderModel.fetch({ id, user_id: currentUser.id })
  if (!ret[0]) {
    return res.status('200').json({ error_message: 'Không tìm thấy nhắc nợ' })
  }
  const result = await debtReminderModel.update(id, data, 'id amount note isPaid user_id account_id'.split(' '))
  return res.status('200').json(result)
})

router.post('/:id/Pay', async (req, res) => {
  const currentUser = res.locals.currentUser
  const { id } = req.params
  const data = req.body
  const ret = await debtReminderModel.fetch({ id, user_id: currentUser.id }, 'id amount note isPaid user_id account_id'.split(' '))
  if (!ret[0]) {
    return res.status('200').json({ error_message: 'Không tìm thấy nhắc nợ' })
  }

  const sourceAccount = await accountModel.fetch({ uuid: data.source_account_uuid, user_id: currentUser.id }, accountViewModel.split(' '))
  if (!sourceAccount) {
    return res.status('200').json({ message: 'Không tìm thấy tài khoản thanh toán' })
  }
  const destinationAccount = await accountModel.fetch({ id: ret[0].account_id }, accountViewModel.split(' '))
  if (!destinationAccount) {
    return res.status('200').json({ message: 'Không tìm thấy tài khoản người nhận' })
  }
  const transactionCode = 'SWEN' + otpGenerator.generate(15, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })
  const transferData = {
    ...data,
    created_at: new Date().toUTCString(),
    status_id: 1,
    code: transactionCode,
    debt_reminder_id: id
  }
  const transactionTransfer = await transactionModel.add(transferData, 'id')

  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.smtp_email,
      pass: process.env.smtp_email_password
    }
  })
  const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false })
  try {
    const data = fs.readFileSync('./html_template/OTP.html')
    let htmlString = data.toString()
    htmlString = htmlString.replace('user_name', currentUser.name)
    htmlString = htmlString.replace('otp_code', otp)
    htmlString = htmlString.replace('transaction_code', transactionCode)
    const mainOptions = {
      from: 'SWEN Bank',
      to: currentUser.email,
      subject: 'OTP xác nhận giao dịch',
      html: htmlString
    }
    transporter.sendMail(mainOptions, async (err, info) => {
      if (err) {
        console.log('err', err)
      } else {
        console.log('success')
        const expiredTime = new Date()
        expiredTime.setSeconds(new Date().getSeconds() + 60)
        console.log(expiredTime)
        const otpData = {
          otp,
          expired_at: expiredTime,
          transaction_id: transactionTransfer[0].id
        }
        await otpModel.add(otpData)
      }
    })
  } catch (err) {
    console.log('err', err)
  }
})

export default router
