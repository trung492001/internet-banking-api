import express from 'express'
import userModel from '../models/user.model.js'
import accountModel from '../models/account.model.js'
import validate from '../middlewares/validate.mdw.js'
import { readFile } from 'fs/promises'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import db from '../utils/db.js'
import jwt from 'jsonwebtoken'
import _CONF from '../config/index.js'
import refreshTokenModel from '../models/refreshToken.model.js'

const router = express.Router()

const userSchema = JSON.parse(await readFile(new URL('../schemas/user.json', import.meta.url)))
const loginSchema = JSON.parse(await readFile(new URL('../schemas/login.json', import.meta.url)))

router.post('/', validate(userSchema), async (req, res) => {
  let user = req.body

  const salt = await bcrypt.genSalt(10)
  user.password = await bcrypt.hash(user.password, salt)
  const ret = await userModel.add(user, 'id')

  const accountUUID = uuidv4()
  const startWith = '32'
  const generator = Math.floor(Math.random() * 999999)
  const accountNumber = startWith + generator
  await accountModel.add({
    number: accountNumber,
    uuid: accountUUID,
    balance: 0,
    is_payment_account: true,
    user_id: ret[0].id
  })
  user = {
    id: ret[0].id,
    ...user
  }
  res.status(201).json(user)
})

router.post('/Login', validate(loginSchema), async (req, res) => {
  const data = req.body
  const ret = await db('User').where('user_name', data.user_name)
  if (ret.length === 0) {
    return res.status('200').json({ message: 'User not found' })
  } else {
    const result = await bcrypt.compare(data.password, ret[0].password)
    if (result) {
      const resUser = ret[0]
      const recordRefreshToken = await db('RefreshToken').where('user_id', resUser.id)
      const token = jwt.sign(resUser, _CONF.SECRET, { expiresIn: _CONF.tokenLife })
      const refreshToken = jwt.sign(resUser, _CONF.SECRET_REFRESH)

      if (recordRefreshToken.length !== 0) {
        const record = recordRefreshToken[0]
        record.secret_key = refreshToken

        const expired = new Date(record.expired_at)
        expired.setSeconds(expired.getSeconds() + process.env.expired_time)

        record.expired_at = expired
        await refreshTokenModel.update(record.id, record)
      } else {
        const now = new Date()
        now.setSeconds(now.getSeconds() + process.env.expired_time)

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
        refreshToken
      }
      return res.status(200).json(response)
    } else {
      return res.status(401).json({ message: 'Invalid credential' })
    }
  }
}
)

export default router
