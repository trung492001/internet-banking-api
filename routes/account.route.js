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
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 3) {
    return res.status('403').json({ message: 'Không đủ quyền truy cập' })
  }
  const data = req.body
  if (data.user_name) {
    const user = await userModel.find({ user_name: data.user_name }, userViewModel.split(' '))
    if (!user) {
      res.status('200').json({ message: 'Không tìm thấy người dùng' })
    }

    let account = await db('Accounts').where({ user_id: user.id }).first()
    if (!account) {
      res.status('200').json({ message: 'Không tìm thấy tài khoản của người dùng' })
    }
    account = {
      ...account,
      balance: account.balance + data.balance
    }

    const ret = await accountModel.update(account.id, account, accountViewModel.split(' '))

    return res.status('200').json(ret[0])
  } else if (data.account_number) {
    let account = await db('Accounts').where({ number: data.account_number })
    if (!account) {
      res.status('200').json({ message: 'Không tìm thấy tài khoản của người dùng' })
    }
    account = {
      ...account,
      balance: account.balance + data.balance
    }

    const ret = await accountModel.update(account.id, account, accountViewModel.split(' '))

    return res.status('200').json(ret[0])
  }
  return res.status('200').json({ message: 'Không có tài khoản người dùng' })
})

export default router
