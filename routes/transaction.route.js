import express from 'express'
import accountModel from '../models/account.model.js'
import { accountViewModel } from '../view_models/account.viewModel.js'
import transactionModel from '../models/transaction.model.js'
import currentUserMdw from '../middlewares/currentUser.mdw.js'
import nodemailer from 'nodemailer'
import otpGenerator from 'otp-generator'
import fs from 'fs'
import transactionOTPModel from '../models/transactionOTP.model.js'
import { transactionViewModel } from '../view_models/transaction.viewModel.js'
import { v4 as uuidv4 } from 'uuid'
import debtReminderModel from '../models/debtReminder.model.js'
import { debtReminderViewModel } from '../view_models/debtReminder.viewModel.js'
import { transactionOTPViewModel } from '../view_models/transactionOTP.viewModel.js'

const router = express.Router()

router.use(currentUserMdw)
router.post('/:id/ResendOTP', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 2) {
    return res.status(403).json({ message: 'You do not have permission to access the API!' })
  }
  const { id } = req.params
  const transaction = await transactionModel.findOne({ id }, transactionViewModel)
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
    htmlString = htmlString.replace('transaction_code', transaction.code)
    htmlString = htmlString.replace('username', currentUser.name)
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
        await transactionOTPModel.add(otpData)
        return res.status(201).json({ message: 'New OTP is sent' })
      }
    })
  } catch (err) {
    console.log('err', err)
    return res.status(200).json({ message: 'Failed to sent email' })
  }
})

router.post('/VerifyOTP', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 2) {
    return res.status(403).json({ message: 'You do not have permission to access the API!' })
  }
  const data = req.body
  const otp = await transactionOTPModel.findOne({ otp: data.otp }, transactionOTPViewModel)
  if (!otp) {
    return res.status(200).json({ message: 'Invalid OTP' })
  }
  if (new Date(otp.expired_at).getTime() < new Date().getTime()) {
    await transactionOTPModel.delete(otp.id)
    return res.status(200).json({ message: 'OTP expired' })
  }
  let transactionData = await transactionModel.findOne({ id: otp.transaction_id }, transactionViewModel)
  const sourceAccount = await accountModel.findOne({ uuid: transactionData.source_account_uuid, user_id: currentUser.id }, accountViewModel)
  if (!sourceAccount) {
    return res.status(200).json({ message: 'Cannot find payment account' })
  }
  const destinationAccount = (await accountModel.fetch({ uuid: transactionData.destination_account_uuid }, accountViewModel))[0]
  if (!destinationAccount) {
    return res.status(200).json({ message: 'Cannot find receiver account' })
  }
  transactionData = {
    ...transactionData,
    status_id: 2
  }
  await transactionModel.update(transactionData.id, transactionData)

  if (sourceAccount.balance < transactionData.amount) {
    return res.status(200).json({ message: 'The balance is not enough' })
  }
  sourceAccount.balance -= transactionData.amount
  destinationAccount.balance += transactionData.amount

  if (transactionData.debt_reminder_id !== null) {
    let debtReminder = await debtReminderModel.findOne({ id: transactionData.debt_reminder_id }, debtReminderViewModel)
    if (!debtReminder) {
      return res.status(200).json({ message: 'Cannot find Debt reminder' })
    }
    debtReminder = {
      ...debtReminder,
      isPaid: true
    }
    console.log('debtReminder: ', debtReminder);
    await debtReminderModel.update(debtReminder.id, debtReminder)
  }
  console.log('sourceAccount: ', sourceAccount);
  await accountModel.update(sourceAccount.id, sourceAccount)
  console.log('destinationAccount: ', destinationAccount);
  await accountModel.update(destinationAccount.id, destinationAccount)
  await transactionOTPModel.delete(otp.id)
  res.status(201).json({ message: 'OTP code confirm succesfully. Transaction has been proceeded' })
})

router.post('/', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 2) {
    return res.status(403).json({ message: 'You do not have permission to access the API!' })
  }
  const data = req.body
  const sourceAccount = await accountModel.findOne({ uuid: data.source_account_uuid, user_id: currentUser.id }, accountViewModel)
  if (!sourceAccount) {
    return res.status(200).json({ message: 'Cannot find payment account' })
  }
  const destinationAccount = await accountModel.findOne({ uuid: data.destination_account_uuid }, accountViewModel)
  if (!destinationAccount) {
    return res.status(200).json({ message: 'Cannot find receiver account' })
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
        expiredTime.setSeconds(new Date().getSeconds() + 180)
        console.log(expiredTime)
        const otpData = {
          otp,
          expired_at: expiredTime,
          transaction_id: transactionTransfer[0].id
        }
        await transactionOTPModel.add(otpData)
      }
    })
  } catch (err) {
    console.log('err', err)
  }
  return res.status(201).json(transactionTransfer[0])
})

export default router