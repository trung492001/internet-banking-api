import express from 'express'
import accountModel from '../models/account.model.js'
import { accountViewModel } from '../view_models/account.viewModel.js'
import transactionModel from '../models/transactionModel.js'
import currentUserMdw from '../middlewares/currentUser.mdw.js'
import nodemailer from 'nodemailer'
import otpGenerator from 'otp-generator'
import fs from 'fs'
import otpModel from '../models/otp.model.js'
import { transactionViewModel } from '../view_models/transaction.viewModel.js'
import { v4 as uuidv4 } from 'uuid'
import debtReminderModel from '../models/debtReminder.model.js'

const router = express.Router()

router.use(currentUserMdw)
router.post('/:id/ResendOTP', async (req, res) => {
  const currentUser = res.locals.currentUser
  const { id } = req.params
  const transaction = await transactionModel.fetch({ id }, transactionViewModel.split(' '))
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
    htmlString = htmlString.replace('transaction_code', transaction[0].code)
    htmlString = htmlString.replace('user_name', currentUser.name)
    htmlString = htmlString.replace('otp_code', otp)
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
        expiredTime.setSeconds(new Date().getSeconds() + 180)
        console.log(expiredTime)
        const otpData = {
          otp,
          expired_at: expiredTime,
          transaction_id: id
        }
        await otpModel.add(otpData)
        return res.status('200').json({ message: 'Gửi mail thành công' })
      }
    })
  } catch (err) {
    console.log('err', err)
    return res.status('200').json({ message: 'Gửi mail thất bại' })
  }
})
router.post('/VerifyOTP', async (req, res) => {
  const currentUser = res.locals.currentUser
  const data = req.body
  const otp = await otpModel.fetch({ otp: data.otp }, 'id transaction_id expired_at'.split(' '))
  if (!otp[0]) {
    return res.status('200').json({ error_message: 'OTP không chính xác' })
  }
  if (new Date(otp[0].expired_at).getTime() < new Date().getTime()) {
    await otpModel.delete(otp[0].id)
    return res.status('200').json({ error_message: 'OTP hết hạn' })
  }
  let transactionData = await transactionModel.fetch({ id: otp[0].transaction_id }, transactionViewModel.split(' '))
  const sourceAccount = await accountModel.fetch({ uuid: transactionData[0].source_account_uuid, user_id: currentUser.id }, accountViewModel.split(' '))
  if (!sourceAccount[0]) {
    return res.status('200').json({ error_message: 'Không tìm thấy tài khoản thanh toán' })
  }
  const destinationAccount = await accountModel.fetch({ uuid: transactionData[0].destination_account_uuid }, accountViewModel.split(' '))
  if (!destinationAccount[0]) {
    return res.status('200').json({ error_message: 'Không tìm thấy tài khoản người nhận' })
  }
  transactionData = {
    ...transactionData[0],
    status_id: 2
  }
  await transactionModel.update(transactionData.id, transactionData)

  if (sourceAccount[0].balance < transactionData.amount) {
    return res.status('200').json({ error_message: 'Không đủ số dư' })
  }
  sourceAccount[0].balance -= transactionData.amount
  destinationAccount[0].balance += transactionData.amount

  if (transactionData.debt_reminder_id !== null) {
    let debtReminder = debtReminderModel.fetch({ id: transactionData.debt_reminder_id }, 'id amount note isPaid user_id account_id'.split(' '))
    if (!debtReminder[0]) {
      return res.status('200').json({ error_message: 'Không tìm thấy nhắc nợ' })
    }
    debtReminder = {
      ...debtReminder[0],
      isPaid: true
    }
    await debtReminderModel.update(debtReminder.id, debtReminder)
  }
  await accountModel.update(sourceAccount[0].id, sourceAccount[0])
  await accountModel.update(destinationAccount[0].id, destinationAccount[0])
  await otpModel.delete(otp[0].id)
  res.status('200').json({ message: 'Xác nhận thành công' })
})
router.post('/', async (req, res) => {
  const currentUser = res.locals.currentUser
  const data = req.body
  const sourceAccount = await accountModel.fetch({ uuid: data.source_account_uuid, user_id: currentUser.id }, accountViewModel.split(' '))
  if (!sourceAccount[0]) {
    return res.status('200').json({ message: 'Không tìm thấy tài khoản thanh toán' })
  }
  const destinationAccount = await accountModel.fetch({ uuid: data.destination_account_uuid }, accountViewModel.split(' '))
  if (!destinationAccount[0]) {
    return res.status('200').json({ message: 'Không tìm thấy tài khoản người nhận' })
  }
  const transactionCode = 'SWEN' + otpGenerator.generate(15, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })
  const transferData = {
    ...data,
    created_at: new Date().toUTCString(),
    status_id: 1,
    code: transactionCode,
    uuid: uuidv4()
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
        expiredTime.setSeconds(new Date().getSeconds() + 180)
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
  return res.status('200').json(transactionTransfer[0])
})

export default router
