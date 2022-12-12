import express from 'express'
import accountModel from '../models/account.model.js'
import db from '../utils/db.js'
import { accountViewModel } from '../view_models/account.viewModel.js'
import currentUserMdw from '../middlewares/currentUser.mdw.js'
import userModel from '../models/user.model.js'
import { userViewModel } from '../view_models/user.viewModel.js'

const router = express.Router()

router.use(currentUserMdw)
router.post('/DepositAccount', async (req, res) => {
  const data = req.body
  if (data.user_name) {
    const user = await userModel.find({ user_name: data.user_name }, userViewModel.split(' '))
    if (!user) {
      res.status('200').json({ message: 'Không tìm thấy người dùng' })
    }

    let account = await db('Account').where({ user_id: user.id }).first()
    if (!account) {
      res.status('200').json({ message: 'Không tìm thấy tài khoản của người dùng' })
    }
    account = {
      ...account,
      balance: data.balance
    }

    const ret = await accountModel.update(account.id, account, accountViewModel.split(' '))

    res.status('200').json(ret)
  } else if (data.account_number) {
    let account = await db('Account').where({ number: data.account_number })
    if (!account) {
      res.status('200').json({ message: 'Không tìm thấy tài khoản của người dùng' })
    }
    account = {
      ...account,
      balance: data.balance
    }

    const ret = await accountModel.update(account.id, account, accountViewModel)

    res.status('200').json(ret[0])
  }
})

router.get('/Transfer', async (req, res) => {
})

export default router
