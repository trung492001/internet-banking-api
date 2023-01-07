/* eslint-disable no-case-declarations */
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
import debtReminderModel from '../models/debtReminder.model.js'
import { debtReminderViewModel } from '../view_models/debtReminder.viewModel.js'
import bankModel from '../models/bank.model.js'
import axios from 'axios'
import NodeRSA from 'node-rsa'
import md5 from 'md5'

const router = express.Router()

router.use(currentUserMdw)
router.post('/:id/ResendOTP', async (req, res) => {
  const currentUser = res.locals.currentUser
  const { id } = req.params
  const transaction = await transactionModel.findOne({ id }, transactionViewModel.split(' '))
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
        return res.status(200).json({ status: 'success', message: 'Send mail successful' })
      }
    })
  } catch (err) {
    console.log('err', err)
    return res.status(200).json({ status: 'fail', message: 'Send mail failed' })
  }
})

router.post('/VerifyOTP', async (req, res) => {
  const currentUser = res.locals.currentUser
  const data = req.body
  const otp = await transactionOTPModel.findOne({ otp: data.otp }, transactionViewModel)
  if (!otp) {
    return res.status(200).json({ status: 'fail', message: 'Not correct OTP' })
  }
  if (new Date(otp.expired_at).getTime() < new Date().getTime()) {
    await transactionOTPModel.delete(otp.id)
    return res.status(200).json({ status: 'fail', message: 'Time out OTP' })
  }
  let transactionData = await transactionModel.findOne({ id: otp.transaction_id }, transactionViewModel)
  const sourceAccount = await accountModel.findOne({ number: transactionData.source_account_number, user_id: currentUser.id }, accountViewModel)
  if (!sourceAccount) {
    return res.status(200).json({ status: 'fail', message: 'Not found source account' })
  }
  if (sourceAccount.balance < transactionData.amount) {
    return res.status(200).json({ status: 'fail', message: 'Invalid balance' })
  }
  switch (transactionData.destination_bank_id) {
    case 1:
      const destinationAccount = await accountModel.fetch({ uuid: transactionData.destination_account_number }, accountViewModel)
      if (!destinationAccount) {
        return res.status(200).json({ status: 'fail', message: 'Not found destination account' })
      }
      transactionData = {
        ...transactionData,
        status_id: 2
      }
      await transactionModel.update(transactionData.id, transactionData)
      destinationAccount.balance += transactionData.amount
      await accountModel.update(destinationAccount.id, destinationAccount)
      break
    case 2:
      const bank = await bankModel.findOne({ id: transactionData.destination_bank_id }, 'name host key'.split(' '))
      const key = new NodeRSA(process.env.PRIVATE_KEY)
      const transactionDataBuffer = {
        fromAccountNumber: transactionData.source_account_number,
        fromAccountOwnerName: transactionData.source_owner_name,
        bankCode: bank.name,
        toAccountNumber: transactionData.destination_account_number,
        toAccountOwnerName: transactionData.destination_owner_name,
        amount: transactionData.amount,
        fee: transactionData.fee,
        content: transactionData.note
      }
      const signature = key.sign(transactionDataBuffer, 'string')
      const time = Date.now()
      const hmac = md5(`bankCode=${bank.name}&time=${time}&secretKey=TIMO_AUTHENTICATION_SERVER_SECRET_KEY_FB88NCCA`)
      const ret = await axios.post(`${bank.host}/api/interbank/rsa-deposit`, {
        data: transactionDataBuffer,
        signature,
        publicKey: process.env.PUBLIC_KEY
      }, {
        params: {
          hmac,
          time,
          bankCode: bank.name
        }
      })
      console.log(ret)
      break
    default:
      return res.json({ status: 'fail', message: 'Not found bank' })
  }
  sourceAccount.balance -= transactionData.amount
  await accountModel.update(sourceAccount.id, sourceAccount)

  if (transactionData.debt_reminder_id !== null) {
    let debtReminder = debtReminderModel.findOne({ id: transactionData.debt_reminder_id }, debtReminderViewModel)
    if (!debtReminder) {
      return res.status(200).json({ status: 'fail', message: 'Not found debt reminder' })
    }
    debtReminder = {
      ...debtReminder,
      isPaid: true
    }
    await debtReminderModel.update(debtReminder.id, debtReminder)
  }
  await transactionOTPModel.delete(otp.id)
  res.status(200).json({ status: 'success', message: 'Data changed' })
})

router.post('/', async (req, res) => {
  const currentUser = res.locals.currentUser
  const data = req.body
  const sourceAccount = await accountModel.findOne({ number: data.source_account_number, user_id: currentUser.id }, accountViewModel)
  if (!sourceAccount) {
    return res.status(200).json({ status: 'fail', message: 'Not found source account' })
  }
  const destinationAccount = await accountModel.findOne({ number: data.destination_account_number }, accountViewModel)
  if (!destinationAccount) {
    return res.status(200).json({ status: 'fail', message: 'Not found destination account' })
  }
  const transactionCode = 'SWEN' + otpGenerator.generate(15, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })
  const transferData = {
    ...data,
    source_bank_id: 1,
    created_at: new Date().toUTCString(),
    status_id: 1,
    code: transactionCode,
    fee: 0
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
  return res.status(200).json({ status: 'success', data: transactionTransfer[0] })
})

export default router
