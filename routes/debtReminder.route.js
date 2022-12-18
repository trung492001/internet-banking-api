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
import db from '../utils/db.js'
import userModel from '../models/user.model.js'
import { userViewModel } from '../view_models/user.viewModel.js'

const router = express.Router()

router.use(currentUserMdw)
router.post('/', async (req, res) => {
  let data = req.body
  const currentUser = res.locals.currentUser
  data = {
    ...data,
    user_id: currentUser.id,
    isPaid: false,
    created_at: new Date().toUTCString()
  }
  await debtReminderModel.add(data)
  return res.status('200').json(data)
})

router.get('/', async (req, res) => {
  const currentUser = res.locals.currentUser
  const account = await accountModel.fetch({ user_id: currentUser.id }, 'id')
  const ret = await db('DebtReminders').select('id amount note isPaid user_id account_id'.split(' ')).where({ user_id: currentUser.id }).orWhere({ account_id: account[0].id })
  return res.status('200').json(ret)
})

router.delete('/:id', async (req, res) => {
  const currentUser = res.locals.currentUser
  const { id } = req.params
  const dataReq = req.body
  const ret = await debtReminderModel.fetch({ id, user_id: currentUser.id }, 'account_id user_id amount created_at'.split(' '))
  if (!ret[0]) {
    return res.status('200').json({ error_message: 'Không tìm thấy nhắc nợ' })
  }
  const account = await accountModel.fetch({ id: ret[0].account_id }, accountViewModel.split(' '))
  const receiver = await userModel.fetch({ id: account[0].user_id }, userViewModel.split(' '))

  const date = new Date(ret[0].created_at)
  const dateStr =
  ('00' + (date.getMonth() + 1)).slice(-2) + '/' +
  ('00' + date.getDate()).slice(-2) + '/' +
  date.getFullYear() + ' ' +
  ('00' + (date.getHours() + 7)).slice(-2) + ':' +
  ('00' + date.getMinutes()).slice(-2) + ':' +
  ('00' + date.getSeconds()).slice(-2)
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.smtp_email,
      pass: process.env.smtp_email_password
    }
  })

  const formatter = new Intl.NumberFormat('en-US', { style: 'currency' })
  try {
    const data = fs.readFileSync('./html_template/DebtReminder.html')
    let htmlString = data.toString()
    htmlString = htmlString.replace('user_name', receiver[0].name)
    htmlString = htmlString.replace('created_at', dateStr)
    htmlString = htmlString.replace('amount', formatter.format(ret[0].amount))
    htmlString = htmlString.replace('created_by', currentUser.name)
    htmlString = htmlString.replace('note', dataReq.note)
    const mainOptions = {
      from: 'SWEN Bank',
      to: receiver[0].email,
      subject: 'Thông báo xóa nhắc nợ',
      html: htmlString
    }
    transporter.sendMail(mainOptions, async (err, info) => {
      if (err) {
        console.log('err', err)
      } else {
        console.log('success')
      }
    })
  } catch (err) {
    console.log('err', err)
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
