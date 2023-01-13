import express from 'express'
import accountModel from '../models/account.model.js'
import { accountViewModel } from '../view_models/account.viewModel.js'
import currentUserMdw from '../middlewares/currentUser.mdw.js'
import userModel from '../models/user.model.js'
import { userViewModel } from '../view_models/user.viewModel.js'

const router = express.Router()

router.use(currentUserMdw)
router.post('/DepositAccount', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 3) {
    return res.status(403).json({ status: 'fail', message: 'You do not have permission to access the API!' })
  }
  const data = req.body
  if (data.username) {
    const user = await userModel.findOne({ username: data.username }, userViewModel)
    if (!user) {
      return res.status(200).json({ status: 'not_found_user', message: 'Not found user' })
    }

    let account = await accountModel.findOne({ user_id: user.id }, accountViewModel)
    if (!account) {
      return res.status(200).json({ status: 'not_found_account', message: 'Not found account' })
    }
    account = {
      ...account,
      balance: account.balance + data.balance
    }

    const ret = await accountModel.update(account.id, account, accountViewModel)

    return res.status(201).json({ status: 'success', data: ret[0] })
  } else if (data.account_number) {
    let account = await accountModel.findOne({ number: data.account_number }, accountViewModel)
    if (!account) {
      return res.status(200).json({ status: 'not_found_account', message: 'Not found account' })
    }
    account = {
      ...account,
      balance: account.balance + data.balance
    }

    const ret = await accountModel.update(account.id, account, accountViewModel)

    return res.status(201).json({ status: 'success', data: ret[0] })
  }
  return res.status(200).json({ status: 'missing_parameters', message: 'Not found account or username' })
})

router.get('/:accountNumber/Internal', async (req, res) => {
  const { accountNumber } = req.params
  const account = await accountModel.findOne({ number: accountNumber }, 'id number user_id'.split(' '))
  if (account) {
    const user = await userModel.findOne({ id: account.user_id }, 'name')
    return res.status(200).json({ status: 'success', data: { ...account, name: user.name } })
  }
  return res.status(204).json({ status: 'fail', message: 'Not found account' })
})

export default router
