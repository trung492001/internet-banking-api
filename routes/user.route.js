import express from 'express'
import userModel from '../models/user.model.js'
import accountModel from '../models/account.model.js'
import validate from '../middlewares/validate.mdw.js'
import { readFile } from 'fs/promises'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()

const userSchema = JSON.parse(await readFile(new URL('../schemas/user.json', import.meta.url)))

router.post('/', validate(userSchema), async (req, res) => {
  let user = req.body

  const salt = await bcrypt.genSalt(10)
  user.password = await bcrypt.hash(user.password, salt)
  const ret = await userModel.add(user)

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

export default router
