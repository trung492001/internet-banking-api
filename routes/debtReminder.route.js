import express from 'express'
import currentUserMdw from '../middlewares/currentUser.mdw.js'
import accountModel from '../models/account.model.js'
import debtReminderModel from '../models/debtReminder.model.js'
import { accountViewModel } from '../view_models/account.viewModel.js'
import otpGenerator from 'otp-generator'
import transactionModel from '../models/transaction.model.js'
import nodemailer from 'nodemailer'
import fs from 'fs'
import otpModel from '../models/transactionOTP.model.js'
import db from '../utils/db.js'
import userModel from '../models/user.model.js'
import { userViewModel } from '../view_models/user.viewModel.js'
import { debtReminderViewModel } from '../view_models/debtReminder.viewModel.js'

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
  return res.status('200').json({ status: 'success', data })
})

router.get('/', async (req, res) => {
  const currentUser = res.locals.currentUser
  const account = await accountModel.findOne({ user_id: currentUser.id }, 'id')
  const ret = await db('DebtReminders').select(debtReminderViewModel).where({ user_id: currentUser.id }).orWhere({ account_id: account[0].id })
  return res.status('200').json({ status: 'success', data: ret })
})

router.delete('/:id', async (req, res) => {
  const currentUser = res.locals.currentUser
  const { id } = req.params
  const dataReq = req.body
  const ret = await debtReminderModel.findOne({ id, user_id: currentUser.id }, debtReminderViewModel)
  if (!ret) {
    return res.status('200').json({ status: 'fail', message: 'Not found debt reminder' })
  }
  const account = await accountModel.findOne({ id: ret.account_id }, accountViewModel)
  const receiver = await userModel.findOne({ id: account.user_id }, userViewModel)

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
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_EMAIL_PASSWORD
    }
  })

  const formatter = new Intl.NumberFormat('en-US', { style: 'currency' })
  try {
    const data = fs.readFileSync('./html_template/DebtReminder.html')
    let htmlString = data.toString()
    htmlString = htmlString.replace('username', receiver.name)
    htmlString = htmlString.replace('created_at', dateStr)
    htmlString = htmlString.replace('amount', formatter.format(ret.amount))
    htmlString = htmlString.replace('created_by', currentUser.name)
    htmlString = htmlString.replace('note', dataReq.note)
    const mainOptions = {
      from: 'SWEN Bank',
      to: receiver.email,
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
  return res.status('200').json({ status: 'success', message: 'Delete successful' })
})

router.patch('/:id', async (req, res) => {
  const currentUser = res.locals.currentUser
  const { id } = req.params
  const data = req.body
  const ret = await debtReminderModel.findOne({ id, user_id: currentUser.id }, debtReminderViewModel)
  if (!ret) {
    return res.status('200').json({ status: 'success', message: 'Not found debt reminder' })
  }
  const result = await debtReminderModel.update(id, data, debtReminderViewModel)
  return res.status('200').json({ status: 'success', data: result })
})

router.post('/:id/Pay', async (req, res) => {
  const currentUser = res.locals.currentUser
  const { id } = req.params
  const data = req.body
  const ret = await debtReminderModel.findOne({ id, user_id: currentUser.id }, debtReminderViewModel)
  if (!ret) {
    return res.status('200').json({ status: 'fail', message: 'Not found debt reminder' })
  }

  const sourceAccount = await accountModel.fetch({ uuid: data.source_account_uuid, user_id: currentUser.id }, accountViewModel)
  if (!sourceAccount) {
    return res.status('200').json({ status: 'fail', message: 'Not found source account' })
  }
  const destinationAccount = await accountModel.fetch({ id: ret.account_id }, accountViewModel)
  if (!destinationAccount) {
    return res.status('200').json({ status: 'fail', message: 'Not found destination account' })
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
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_EMAIL_PASSWORD
    }
  })
  const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false })
  try {
    const data = fs.readFileSync('./html_template/OTP.html')
    let htmlString = data.toString()
    htmlString = htmlString.replace('username', currentUser.name)
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
          transaction_id: transactionTransfer.id
        }
        await otpModel.add(otpData)
      }
    })
  } catch (err) {
    console.log('err', err)
  }
})

export default router
