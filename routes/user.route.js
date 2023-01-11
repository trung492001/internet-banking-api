import express from 'express'
import userModel from '../models/user.model.js'
import accountModel from '../models/account.model.js'
import validate from '../middlewares/validate.mdw.js'
import { readFile } from 'fs/promises'
import bcrypt from 'bcrypt'
import db from '../utils/db.js'
import jwt from 'jsonwebtoken'
import _CONF from '../config/index.js'
import refreshTokenModel from '../models/refreshToken.model.js'
import { userViewModel } from '../view_models/user.viewModel.js'
import fs from 'fs'
import nodemailer from 'nodemailer'
import otpGenerator from 'otp-generator'
import resetPasswordOTPModel from '../models/resetPasswordOTP.model.js'
import { resetPasswordOTPViewModel } from '../view_models/resetPasswordOTP.viewModel.js'
import transactionOTPModel from '../models/transactionOTP.model.js'
import currentUserMdw from '../middlewares/currentUser.mdw.js'
import { accountViewModel } from '../view_models/account.viewModel.js'

const router = express.Router()

const userSchema = JSON.parse(await readFile(new URL('../schemas/user.json', import.meta.url)))
const loginSchema = JSON.parse(await readFile(new URL('../schemas/login.json', import.meta.url)))

router.post('/Login', validate(loginSchema), async (req, res) => {
  const data = req.body
  const ret = await db('Users').where('username', data.username)
  if (ret.length === 0) {
    return res.status(401).json({ status: 'fail', message: 'Invalid credential' })
  } else {
    const result = await bcrypt.compare(data.password, ret[0].password)
    if (result) {
      const resUser = ret[0]
      const recordRefreshToken = await db('RefreshTokens').where('user_id', resUser.id)
      const token = jwt.sign(resUser, _CONF.SECRET, { expiresIn: _CONF.tokenLife })
      const refreshToken = jwt.sign(resUser, _CONF.SECRET_REFRESH)

      if (recordRefreshToken.length !== 0) {
        const record = recordRefreshToken[0]
        record.secret_key = refreshToken

        const expired = new Date(record.expired_at)
        expired.setSeconds(expired.getSeconds() + process.env.EXPIRED_TIME)

        record.expired_at = expired
        await refreshTokenModel.update(record.id, record)
      } else {
        const now = new Date()
        now.setSeconds(now.getSeconds() + process.env.EXPIRED_TIME)

        const data = {
          secret_key: refreshToken,
          user_id: resUser.id,
          expired_at: now.toUTCString()
        }

        await refreshTokenModel.add(data)
      }
      const response = {
        message: 'Logged in',
        token,
        refreshToken,
        role_id: ret[0].role_id
      }
      return res.status(200).json({ status: 'success', data: response })
    } else {
      return res.status(401).json({ status: 'fail', message: 'Invalid credential' })
    }
  }
})

router.post('/ResetPassword', async (req, res) => {
  const data = req.body
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_EMAIL_PASSWORD
    }
  })
  const user = await userModel.findOne({ username: data.username }, userViewModel)
  if (!user) {
    return res.status(401).json({ status: 'fail', message: 'Invalid username' })
  }
  const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })
  try {
    const data = fs.readFileSync('./html_template/OTP.html')
    let htmlString = data.toString()
    htmlString = htmlString.replace('username', user.name)
    htmlString = htmlString.replace('otp_code', otp)
    const mainOptions = {
      from: 'SWEN Bank',
      to: user.email,
      subject: 'OTP xác nhận đổi mật khẩu',
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
          user_id: user.id
        }
        await resetPasswordOTPModel.add(otpData)
        res.status(200).json({ status: 'success', message: 'OTP code has been sent!', email: user.email.replace(/(\w{3})[\w.-]+@([\w.]+\w)/, '$1***@$2') })
      }
    })
  } catch (err) {
    console.log('err', err)
  }
})

router.post('/VerifyOTP', async (req, res) => {
  const data = req.body
  const resetPasswordOTP = await resetPasswordOTPModel.findOne({ otp: data.otp }, resetPasswordOTPViewModel)
  if (!resetPasswordOTP) {
    return res.status(401).json({ status: 'fail', message: 'Invalid OTP' })
  }
  const user = await userModel.findOne({ id: resetPasswordOTP.user_id })
  if (new Date(resetPasswordOTP.expired_at).getTime() < new Date().getTime()) {
    await transactionOTPModel.delete(resetPasswordOTP.id)
    return res.status(401).json({ status: 'expired', message: 'OTP expired!' })
  }
  const salt = await bcrypt.genSalt(10)
  data.password = await bcrypt.hash(data.password, salt)
  user.password = data.password
  await userModel.update(user.id, user, userViewModel)
  return res.status(200).json({ status: 'success', message: 'Password changed!' })
})

router.use(currentUserMdw)
router.patch('/', async (req, res) => {
  const currentUser = res.locals.currentUser
  const data = req.body

  // const oldUser = await userModel.findOne({ id: currentUser.id }, userViewModel)
  // const salt = await bcrypt.genSalt(10)
  // oldUser.password = await bcrypt.hash(data.password, salt)

  const ret = await userModel.update(currentUser.id, data, userViewModel)
  res.status(201).json({ status: 'success', data: ret[0] })
})

router.post('/', validate(userSchema), async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 1 && currentUser.role_id !== 3) {
    return res.status(403).json({ status: 'fail', message: 'You do not have permission to access the API!' })
  }
  let data = req.body
  const oldUser = await userModel.findOne({ username: data.username }, userViewModel)

  if (oldUser) {
    return res.status(409).json({ status: 'fail', message: 'User already exist' })
  }

  data.role_id = data.role_id || 2
  const salt = await bcrypt.genSalt(10)
  data.password = await bcrypt.hash(data.password, salt)
  const ret = await userModel.add(data, 'id')

  if (data.role_id === 2) {
    const startWith = '32'
    const generator = Math.floor(Math.random() * 999999)
    const accountNumber = startWith + generator
    await accountModel.add({
      number: accountNumber,
      balance: 0,
      is_payment_account: true,
      user_id: ret[0].id
    })
  }
  data = {
    id: ret[0].id,
    ...data
  }
  res.status(201).json({ status: 'success', data })
})

router.get('/Employees', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 1) {
    return res.status(403).json({ status: 'fail', message: 'You do not have permission to access the API!' })
  }

  const ret = await userModel.fetch({ role_id: 3 }, userViewModel)
  res.status(200).json({ status: 'success', data: ret })
})

router.delete('/Employees/:id', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 1) {
    return res.status(403).json({ status: 'fail', message: 'You do not have permission to access the API!' })
  }
  const id = req.params.id
  await userModel.delete(id)
  res.status(200).json({ status: 'success', message: 'Deleted employee!' })
})

router.get('/Accounts', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 2) {
    return res.status(403).json({ status: 'fail', message: 'You do not have permission to access the API!' })
  }
  const account = await accountModel.findOne({ user_id: currentUser.id }, accountViewModel)
  if (account) {
    return res.status(200).json({ status: 'success', data: account })
  }
  return res.status(200).json({ status: 'fail', message: 'Not found account' })
})

export default router
