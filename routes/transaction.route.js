import express from 'express'
import accountModel from '../models/account.model.js'
import { accountViewModel } from '../view_models/account.viewModel.js'
import transactionModel from '../models/transactionModel.js'
import currentUserMdw from '../middlewares/currentUser.mdw.js'
import nodemailer from 'nodemailer'
import otpGenerator from 'otp-generator'
import fs from 'fs'

const router = express.Router()

router.use(currentUserMdw)
router.post('/sendOTP', (req, res) => {
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
  const receiverData = {
    ...data,
    type_id: 1,
    created_at: new Date().toUTCString()
  }
  const transferData = {
    ...data,
    type_id: 2,
    created_at: new Date().toUTCString()
  }
  await transactionModel.add(receiverData, 'id')
  const transactionTransfer = await transactionModel.add(transferData, 'id')
  sourceAccount.balance -= data.amount
  destinationAccount.balance += data.amount
  await accountModel.update(sourceAccount.id, sourceAccount)
  await accountModel.update(destinationAccount.id, destinationAccount)
  return res.status('200').json(transactionTransfer[0])
})

export default router
