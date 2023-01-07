import express from 'express'
import userModel from '../models/user.model.js'
import db from '../utils/db.js'
import jwt from 'jsonwebtoken'
import _CONF from '../config/index.js'
import refreshTokenModel from '../models/refreshToken.model.js'
import { userViewModel } from '../view_models/user.viewModel.js'

const router = express.Router()

router.post('/Refresh', async function (req, res) {
  // refresh the damn token
  const { refreshToken } = req.body
  // if refresh token exists
  console.log(new Date().toISOString())
  const listRefreshToken = await db('RefreshTokens').where('secret_key', refreshToken).where('expired_at', '>', new Date().toISOString())
  console.log(listRefreshToken)
  if (refreshToken && listRefreshToken.length !== 0) {
    const record = listRefreshToken[0]

    const user = await userModel.findOne({ id: record.user_id }, userViewModel)

    const token = jwt.sign(user, _CONF.SECRET, { expiresIn: _CONF.tokenLife })

    const response = {
      token,
      refreshToken
    }

    const expired = new Date(record.expired_at)
    expired.setSeconds(expired.getSeconds() + process.env.EXPIRED_TIME)
    record.expired_at = expired
    await refreshTokenModel.update(record.id, record)

    res.status(200).json({ status: 'success', data: response })
  } else {
    res.status(400).send({ status: 'fail', message: 'Invalid Request' })
  }
})

export default router
