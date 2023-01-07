import express from 'express'
import accountModel from '../models/account.model.js'
import { accountViewModel } from '../view_models/account.viewModel.js'
import currentUserMdw from '../middlewares/currentUser.mdw.js'
import userModel from '../models/user.model.js'
import { userViewModel } from '../view_models/user.viewModel.js'
import md5 from 'md5'
import bankModel from '../models/bank.model.js'
import NodeRSA from 'node-rsa'

const router = express.Router()

router.get('/External', async (req, res) => {
  const query = req.query
  const encode = md5(`bankCode=${query.bankCode}&time=${query.time}&key=${query.key}`)
  if (encode === query.hmac) {
    const currentTime = Date.now()
    if (currentTime - query.time <= process.env.EXPIRED_QUERY_TIME) {
      const bank = await bankModel.findOne({ name: query.bankCode }, 'name')
      if (bank) {
        const account = await accountModel.findOne({ number: query.accountNumber }, 'number user_id'.split(' '))
        if (account) {
          const user = await userModel.findOne({ id: account.user_id }, userViewModel)
          return res.json({ status: 'success', data: { number: account.number, name: user.name, bank: bank.name } })
        }
        return res.json({ status: 'fail', message: 'Not found account' })
      }
      return res.json({ status: 'fail', message: 'Not found bank' })
    }
    return res.json({ status: 'fail', message: 'Time out' })
  }
  return res.json({ status: 'fail', message: 'Not Allow' })
})

router.post('/External/DepositAccount', async (req, res) => {
  const query = req.query
  const encode = md5(`bankCode=${query.bankCode}&time=${query.time}&key=${query.key}`)
  if (encode === query.hmac) {
    const currentTime = Date.now()
    if (currentTime - query.time <= process.env.EXPIRED_QUERY_TIME) {
      const bank = await bankModel.findOne({ name: query.bankCode }, 'id')
      if (bank) {
        const data = req.body
        const key = new NodeRSA(process.env.PRIVATE_KEY)
        const signature = Buffer.from(req.body.signature, 'base64')
        const transaction = Buffer.from(req.body.payment, 'base64')
        const result = key.verify(transaction, signature)
        if (result) {
          let destinationAccount = await accountModel.findOne({ number: data.destination_account_number }, accountViewModel)
          if (destinationAccount) {
            destinationAccount = {
              ...destinationAccount,
              balance: destinationAccount.balance + data.balance
            }
            await accountModel.update(destinationAccount.id, destinationAccount, accountViewModel)
            return res.status(200).json({ status: 'success' })
          }
          return res.json({ status: 'fail', message: 'Not found account' })
        }
        return res.json({ status: 'fail', message: 'Invalid signature' })
      }
      return res.json({ status: 'fail', message: 'Not found bank' })
    }
    return res.json({ status: 'fail', message: 'Time out' })
  }
  return res.json({ status: 'fail', message: 'Not Allow' })
})

router.use(currentUserMdw)
router.post('/DepositAccount', async (req, res) => {
  const currentUser = res.locals.currentUser
  if (currentUser.role_id !== 3) {
    return res.status(403).json({ status: 'fail', message: 'Not allow' })
  }
  const data = req.body
  if (data.username) {
    const user = await userModel.findOne({ username: data.username }, userViewModel)
    if (!user) {
      return res.status(204).json({ status: 'fail', message: 'Not found user' })
    }

    let account = await accountModel.findOne({ user_id: user.id }, accountViewModel)
    if (!account) {
      return res.status(204).json({ status: 'fail', message: 'Not found account' })
    }
    account = {
      ...account,
      balance: account.balance + data.balance
    }

    const ret = await accountModel.update(account.id, account, accountViewModel)

    return res.status(200).json({ status: 'success', data: ret[0] })
  } else if (data.account_number) {
    let account = await accountModel.findOne({ number: data.account_number }, accountViewModel)
    if (!account) {
      return res.status(204).json({ status: 'fail', message: 'Not found account' })
    }
    account = {
      ...account,
      balance: account.balance + data.balance
    }

    const ret = await accountModel.update(account.id, account, accountViewModel)

    return res.status(200).json({ status: 'success', data: ret[0] })
  }
  return res.status(204).json({ status: 'fail', message: 'Not found account or username' })
})

router.get('/:accountNumber/Internal', async (req, res) => {
  const { accountNumber } = req.params
  const account = await accountModel.findOne({ number: accountNumber }, 'id number uuid user_id'.split(' '))
  if (account) {
    const user = await userModel.findOne({ id: account.user_id }, 'name')
    return res.status(200).json({ status: 'success', data: { ...account, username: user.name } })
  }
  return res.status(200).json({ status: 'fail', message: 'Not found account' })
})

export default router
