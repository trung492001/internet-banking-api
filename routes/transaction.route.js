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

const router = express.Router()

router.use(currentUserMdw)
router.post('/resendOTP', (req, res) => {
  const currentUser = res.locals.currentUser
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.smtp_email,
      pass: process.env.smtp_email_password
    }
  })
  const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false })
  try {
    const data = fs.readFileSync('./html_template/mainOTP.html')
    let htmlString = data.toString()
    htmlString = htmlString.replace('user_name', currentUser.name)
    htmlString = htmlString.replace('otp_code', otp)
    const mainOptions = {
      from: 'SWEN Bank',
      to: currentUser.email,
      subject: 'OTP xác nhận giao dịch',
      html: htmlString
    }
    transporter.sendMail(mainOptions, function (err, info) {
      if (err) {
        console.log('err', err)
        res.status('200').json({ message: 'Send mail fail' })
      } else {
        console.log('success')
        res.status('200').json({ message: 'Send mail success' })
      }
    })
  } catch (err) {
    console.log('err', err)
    res.status('200').json({ message: 'Send mail fail' })
  }
})
router.post('/VerifyOTP', async (req, res) => {
  const currentUser = res.locals.currentUser
  const data = req.body
  const otp = await otpModel.find({ otp: data.otp }, 'id transaction_id expired_at')
  if (new Date(otp.expired_at).getMilliseconds() > Date.now()) {
    await otpModel.delete(otp.id)
    return res.status('200').json({ error_message: 'OTP hết hạn' })
  }
  let transactionData = await transactionModel.find({ id: otp.transaction_id }, transactionViewModel)
  const sourceAccount = await accountModel.find({ uuid: transactionData.source_account_uuid, user_id: currentUser.id }, accountViewModel.split(' '))
  if (!sourceAccount) {
    return res.status('200').json({ error_message: 'Không tìm thấy tài khoản thanh toán' })
  }
  const destinationAccount = await accountModel.find({ uuid: transactionData.destination_account_uuid }, accountViewModel.split(' '))
  if (!destinationAccount) {
    return res.status('200').json({ error_message: 'Không tìm thấy tài khoản người nhận' })
  }
  const transactionCode = 'SWEN' + otpGenerator.generate(15, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })
  const receiverData = {
    ...transactionData,
    id: undefined,
    type_id: 1,
    created_at: new Date().toUTCString(),
    status_id: 2,
    code: transactionCode
  }
  transactionData = {
    ...transactionData,
    status_id: 2
  }
  await transactionModel.update(transactionData.id, transactionData)
  await transactionModel.add(receiverData, 'id')

  if (sourceAccount.balance < transactionData.amount) {
    return res.status('200').json({ error_message: 'Không đủ số dư' })
  }
  sourceAccount.balance -= transactionData.amount
  destinationAccount.balance += transactionData.amount

  await accountModel.update(sourceAccount.id, sourceAccount)
  await accountModel.update(destinationAccount.id, destinationAccount)
  await otpModel.delete(otp.id)
  res.status('200').json({ message: 'Xác nhận thành công' })
})
router.post('/', async (req, res) => {
  const currentUser = res.locals.currentUser
  const data = req.body
  const sourceAccount = await accountModel.find({ uuid: data.source_account_uuid, user_id: currentUser.id }, accountViewModel.split(' '))
  if (!sourceAccount) {
    return res.status('200').json({ message: 'Không tìm thấy tài khoản thanh toán' })
  }
  const destinationAccount = await accountModel.find({ uuid: data.destination_account_uuid }, accountViewModel.split(' '))
  if (!destinationAccount) {
    return res.status('200').json({ message: 'Không tìm thấy tài khoản người nhận' })
  }
  const transactionCode = 'SWEN' + otpGenerator.generate(15, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })
  const transferData = {
    ...data,
    type_id: 2,
    created_at: new Date().toUTCString(),
    status_id: 1,
    code: transactionCode
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
  return res.status('200').json(transactionTransfer[0])
})

export default router
