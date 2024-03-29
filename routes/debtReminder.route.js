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
  if (currentUser.role_id !== 2) {
    return res.status(403).json({ status: 'fail', message: 'You do not have permission to access the API!' })
  }
  data = {
    ...data,
    isPaid: false,
    created_at: new Date().toUTCString()
  }
  const ret = await debtReminderModel.add(data, 'id')
  return res.status(201).json({ status: 'success', data: ret[0] })
})

router.get('/', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 2) {
    return res.status(403).json({ status: 'fail', message: 'You do not have permission to access the API!' })
  }
  const account = await accountModel.findOne({ user_id: currentUser.id }, 'number')
  console.log(currentUser)
  const ret = await db('DebtReminders').select(debtReminderViewModel).where({ source_account_number: account.number }).orWhere({ destination_account_number: account.number })
  console.log(ret)
  return res.status(200).json({ status: 'success', data: ret })
})

router.get('/:id', async (req, res) => {
  const { id } = req.params
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 2) {
    return res.status(403).json({ status: 'fail', message: 'You do not have permission to access the API!' })
  }
  const account = await accountModel.findOne({ user_id: currentUser.id }, 'number')
  const ret = await db('DebtReminders').select(debtReminderViewModel).where({ source_account_number: account.number, id }).orWhere({ destination_account_number: account.number, id }).first()
  console.log(ret)
  return res.status(200).json({ status: 'success', data: ret })
})

router.delete('/:id', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 2) {
    return res.status(403).json({ status: 'fail', message: 'You do not have permission to access the API!' })
  }
  const { id } = req.params
  const dataReq = req.body
  const account = await accountModel.findOne({ user_id: currentUser.id }, 'number')
  const ret = await debtReminderModel.findOne({ id, source_account_number: account.number }, debtReminderViewModel)
  if (!ret) {
    return res.status(200).json({ status: 'fail', message: 'Not found debt reminder' })
  }
  const receiverAccount = await accountModel.findOne({ number: ret.destination_account_number }, 'user_id')
  const receiver = await userModel.findOne({ id: receiverAccount.user_id }, userViewModel)

  const date = new Date(ret.created_at)
  console.log(ret.created_at)
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

  const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
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
  return res.status(201).json({ status: 'success', message: 'Delete successful' })
})

router.patch('/:id', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 2) {
    return res.status(403).json({ status: 'fail', message: 'You do not have permission to access the API!' })
  }
  const { id } = req.params
  const data = req.body
  const account = await accountModel.findOne({ user_id: currentUser.id }, accountViewModel)
  const ret = await debtReminderModel.findOne({ id, source_account_number: account.number }, debtReminderViewModel)
  if (!ret) {
    return res.status(200).json({ status: 'fail', message: 'Not found debt reminder' })
  }
  const result = await debtReminderModel.update(id, data, debtReminderViewModel)
  return res.status(201).json({ status: 'success', data: result })
})

router.post('/:id/Pay', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 2) {
    return res.status(403).json({ status: 'fail', message: 'You do not have permission to access the API!' })
  }
  const { id } = req.params
  const data = req.body
  const ret = await debtReminderModel.findOne({ id }, debtReminderViewModel)
  if (!ret) {
    return res.status(200).json({ status: 'no_debt_reminder', message: 'Not found debt reminder' })
  }
  const sourceAccount = await accountModel.findOne({ number: ret.source_account_number }, accountViewModel)
  if (!sourceAccount) {
    return res.status(200).json({ status: 'no_source_account', message: 'Not found source account' })
  }
  if (sourceAccount.balance < ret.amount) {
    return res.status(200).json({ status: 'not_enough_balance', message: 'Not enough balance' })
  }

  const destinationAccount = await accountModel.findOne({ number: ret.destination_account_number }, accountViewModel)
  if (!destinationAccount) {
    return res.status(200).json({ status: 'no_destination_account', message: 'Not found destination account' })
  }
  console.log('destinationAccount', destinationAccount)

  const transactionCode = 'SWEN' + otpGenerator.generate(15, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })
  const transferData = {
    source_account_number: ret.destination_account_number,
    source_owner_name: ret.destination_owner_name,
    destination_account_number: ret.source_account_number,
    destination_owner_name: ret.source_owner_name,
    source_bank_id: 1,
    destination_bank_id: 1,
    created_at: new Date(),
    note: data.note ?? '',
    amount: ret.amount,
    fee: 0,
    fee_is_paid_by_receiver: data.fee_is_paid_by_receiver ?? true,
    status_id: 1,
    code: transactionCode,
    debt_reminder_id: ret.id
  }
  const transactionTransfer = await transactionModel.add(transferData, 'id')

  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_EMAIL_PASSWORD
    }
  })
  const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })
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
          transaction_id: transactionTransfer[0].id
        }
        await otpModel.add(otpData)
      }
    })
  } catch (err) {
    console.log('err', err)
  }
  return res.status(201).json(transactionTransfer[0])
})

export default router
