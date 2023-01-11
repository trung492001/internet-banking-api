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
import { transactionOTPViewModel } from '../view_models/transactionOTP.viewModel.js'
import userModel from '../models/user.model.js'
import db from '../utils/db.js'

const router = express.Router()

const getDataConfirmationString = (data) => {
  const keys = ['bankCode', 'transactionType', 'amount', 'fee', 'content', 'time', 'status']
  const sortKeys = []
  for (const key in data) {
    if (keys.includes(key)) {
      sortKeys.push(key)
    }
  }

  sortKeys.sort()

  const keyValues = []

  sortKeys.forEach((key) => {
    keyValues.push(`${key}=${data[key]}`)
  })

  return keyValues.join('&').toString()
}

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
  const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })
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
        return res.status(201).json({ status: 'success', message: 'OTP email is re-sent successfully' })
      }
    })
  } catch (err) {
    console.log('err', err)
    return res.status(200).json({ status: 'fail', message: 'Send mail failed' })
  }
})

router.post('/VerifyOTP', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 2) {
    return res.status(403).json({ message: 'You do not have permission to access the API!' })
  }
  const data = req.body
  const otp = await transactionOTPModel.findOne({ otp: data.otp }, transactionOTPViewModel)
  if (new Date(otp.expired_at).getTime() < new Date().getTime()) {
    return res.status(200).json({ status: 'OTP_expired', message: 'OTP is expired' })
  }
  if (!otp) {
    return res.status(200).json({ status: 'OTP_invalid', message: 'Not correct OTP' })
  }
  if (new Date(otp.expired_at).getTime() < new Date().getTime()) {
    await transactionOTPModel.delete(otp.id)
    return res.status(200).json({ status: 'fail', message: 'Time out OTP' })
  }
  let transactionData = await transactionModel.findOne({ id: otp.transaction_id }, transactionViewModel)
  const sourceAccount = await accountModel.findOne({ number: transactionData.source_account_number, user_id: currentUser.id }, accountViewModel)
  if (!sourceAccount) {
    return res.status(200).json({ status: 'no_source_account', message: 'Not found source account' })
  }
  if (sourceAccount.balance < transactionData.amount) {
    return res.status(200).json({ status: 'invalid_balance', message: 'Invalid balance' })
  }
  switch (transactionData.destination_bank_id) {
    case 1:
      const destinationAccount = (await accountModel.fetch({ number: transactionData.destination_account_number }, accountViewModel))[0]
      if (!destinationAccount) {
        return res.status(200).json({ status: 'no_destination_account', message: 'Not found destination account' })
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
      console.log(process.env.PRIVATE_KEY)
      console.log(process.env.PUBLIC_KEY)
      const key = new NodeRSA(process.env.PRIVATE_KEY)
      key.setOptions({ signingScheme: 'pkcs1-sha256' })
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
      const tempData = getDataConfirmationString(transactionDataBuffer)
      const decodeData = md5(tempData)
      const signature = key.sign(decodeData, 'base64')
      const time = Date.now()
      const hmac = md5(`bankCode=${bank.name}&time=${time}&secretKey=TIMO_AUTHENTICATION_SERVER_SECRET_KEY_SWEN`)
      try {
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
        if (ret.data.payload.data.status === 'success') {
          transactionData.status = 3
          transactionData.signature = ret.data.payload.data.signature
          transactionData.response_data = JSON.stringify(ret.data.payload.data.data)
          await transactionModel.update(transactionData.id, transactionData, transactionViewModel)
        } else {
          return res.status(400).json({ status: 'fail' })
        }
      } catch (err) {
        return res.status(400).json({ status: 'fail', message: err })
      }
      break
    default:
      return res.status(401).json({ status: 'fail', message: 'Not found bank' })
  }
  sourceAccount.balance -= transactionData.amount
  await accountModel.update(sourceAccount.id, sourceAccount)

  if (transactionData.debt_reminder_id !== null) {
    let debtReminder = await debtReminderModel.findOne({ id: transactionData.debt_reminder_id }, debtReminderViewModel)
    if (!debtReminder) {
      return res.status(200).json({ status: 'no_debt_reminder', message: 'Not found debt reminder' })
    }
    debtReminder = {
      ...debtReminder,
      isPaid: true
    }
    console.log('debtReminder: ', debtReminder)
    await debtReminderModel.update(debtReminder.id, debtReminder)
  }
  // await transactionOTPModel.delete(otp.id)
  res.status(201).json({ status: 'success', message: 'Transaction is proceeded' })
})

router.post('/', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 2) {
    return res.status(403).json({ message: 'You do not have permission to access the API!' })
  }
  const data = req.body
  const sourceAccount = await accountModel.findOne({ number: data.source_account_number, user_id: currentUser.id }, accountViewModel)
  if (!sourceAccount) {
    return res.status(200).json({ status: 'no_source_account', message: 'Not found source account' })
  }
  let destinationAccount = null
  if (data.destination_bank_id === 1) {
    destinationAccount = await accountModel.findOne({ number: data.destination_account_number }, accountViewModel)
    const destinationOwnerName = await userModel.findOne({ id: destinationAccount.user_id }, 'name')
    destinationAccount.accountOwnerName = destinationOwnerName.name
  } else {
    const time = Date.now()
    const bank = await bankModel.findOne({ id: data.destination_bank_id }, 'host key'.split(' '))
    const hmac = md5(`bankCode=SWEN&time=${time}&secretKey=TIMO_AUTHENTICATION_SERVER_SECRET_KEY_SWEN`)
    const ret = await axios.get(`${bank.host}/api/interbank/get-account/${data.destination_account_number}`, {
      params: {
        hmac,
        time,
        bankCode: 'SWEN'
      }
    })
    console.log(ret)
    if (ret.data.success) { destinationAccount = ret.data.payload }
  }
  if (!destinationAccount) {
    return res.status(200).json({ status: 'no_destination_account', message: 'Not found destination account' })
  }

  const transactionCode = 'SWEN' + otpGenerator.generate(15, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })
  const transferData = {
    ...data,
    source_bank_id: 1,
    created_at: new Date().toUTCString(),
    status_id: 1,
    code: transactionCode,
    fee: 0,
    source_owner_name: currentUser.name,
    destination_owner_name: destinationAccount.accountOwnerName
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
    res.status(200).json({ status: 'fail', message: 'Send mail failed' })
    console.log('err', err)
  }
  return res.status(201).json({ status: 'success', data: transactionTransfer[0] })
})

router.get('/:number', async (req, res) => {
  const accountNumber = req.params.number
  const result = await db("Transactions").where("source_account_number", accountNumber).orWhere("destination_account_number", accountNumber).orderBy("created_at", "desc")
  console.log(result);
  res.status(200).json({ status: 'success', data: result })
})

export default router