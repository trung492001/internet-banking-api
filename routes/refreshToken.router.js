import express from 'express'
import userModel from '../models/user.model.js'
import db from '../utils/db.js'
import jwt from 'jsonwebtoken'
import _CONF from '../config/index.js'
import refreshTokenModel from '../models/refreshToken.model.js'

const router = express.Router()

router.post('/Refresh', async function (req, res) {
  // refresh the damn token
  const { refreshToken } = req.body
  // if refresh token exists
  console.log(new Date().toISOString())
  const listRefreshToken = await db('RefreshToken').where('secret_key', refreshToken).where('expired_at', '>', new Date().toISOString())
  console.log(listRefreshToken)
  if (refreshToken && listRefreshToken.length !== 0) {
    const record = listRefreshToken[0]

    const user = await userModel.findByID(record.user_id)

    const token = jwt.sign(user[0], _CONF.SECRET, { expiresIn: _CONF.tokenLife })

    const response = {
      token,
      refreshToken
    }

    const expired = new Date(record.expired_time)
    expired.setSeconds(expired.getSeconds() + process.env.expired_time)

    record.expired_time = expired
    await refreshTokenModel.update(record.id, record)

    res.status(200).json(response)
  } else {
    res.status(404).send('Invalid request')
  }
})

export default router
