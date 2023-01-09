import express from 'express'
import accountModel from '../models/account.model.js'
import { accountViewModel } from '../view_models/account.viewModel.js'
import userModel from '../models/user.model.js'
import { userViewModel } from '../view_models/user.viewModel.js'
import md5 from 'md5'
import bankModel from '../models/bank.model.js'
import NodeRSA from 'node-rsa'
import otpGenerator from 'otp-generator'
import transactionModel from '../models/transaction.model.js'
import { smallTransactionViewModel } from '../view_models/transaction.viewModel.js'

const router = express.Router()

router.get('/GetInformationAccount', async (req, res) => {
  const query = req.query
  const encode = md5(`bankCode=${query.bankCode}&time=${query.time}&key=${process.env.SECRET_KEY}`)
  if (encode === query.hmac) {
    const currentTime = Date.now()
    if (currentTime - query.time <= process.env.EXPIRED_QUERY_TIME) {
      const bank = await bankModel.findOne({ name: query.bankCode }, 'name')
      if (bank) {
        const account = await accountModel.findOne({ number: query.accountNumber }, 'number user_id'.split(' '))
        if (account) {
          const user = await userModel.findOne({ id: account.user_id }, userViewModel)
          return res.status(200).json({ status: 'success', data: { number: account.number, name: user.name, bank: 'SWEN' } })
        }
        return res.status(202).json({ status: 'fail', message: 'Not found account' })
      }
      return res.status(202).json({ status: 'fail', message: 'Not found bank' })
    }
    return res.status(202).json({ status: 'fail', message: 'Time out' })
  }
  return res.status(202).json({ status: 'fail', message: 'Not Allow' })
})

router.post('/DepositAccount', async (req, res) => {
  try {
    const query = req.query
    const encode = md5(`bankCode=${query.bankCode}&time=${query.time}&key=${process.env.SECRET_KEY}`)
    if (encode === query.hmac) {
      const currentTime = Date.now()
      if (currentTime - query.time <= process.env.EXPIRED_QUERY_TIME) {
        const bank = await bankModel.findOne({ name: query.bankCode }, 'id key host'.split(' '))
        if (bank) {
          let data = req.body.data
          const bankKey = bank.key.replace(/\\n/g, '\n')
          let key = new NodeRSA(bankKey)
          const signature = Buffer.from(req.body.signature, 'base64')
          const transaction = Buffer.from(JSON.stringify(data))
          const result = key.verify(transaction, signature)
          if (result) {
            let temp = true
            if (data.fee === 0) temp = false
            const transactionCode = 'SWEN' + otpGenerator.generate(15, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false })

            data = {
              ...data,
              status_id: 2,
              fee_is_paid_by_receiver: temp,
              code: transactionCode,
              created_at: new Date().toUTCString(),
              signature: req.body.signature,
              source_bank_id: bank.id,
              destination_bank_id: 1
            }
            let destinationAccount = await accountModel.findOne({ number: data.destination_account_number }, accountViewModel)
            if (destinationAccount) {
              let balance = destinationAccount.balance + data.amount
              if (data.fee_is_paid_by_receiver) balance -= data.fee
              destinationAccount = {
                ...destinationAccount,
                balance
              }
              await accountModel.update(destinationAccount.id, destinationAccount, accountViewModel)
              const transactionRet = await transactionModel.add(data, smallTransactionViewModel)
              key = new NodeRSA(process.env.PRIVATE_KEY)
              const signature = key.sign(data, 'base64')
              return res.status(201).json({ status: 'success', data: transactionRet[0], signature, public_key: process.env.PUBLIC_KEY })
            }
            return res.status(200).json({ status: 'fail', message: 'Not found account' })
          }
          return res.status(200).json({ status: 'fail', message: 'Invalid signature' })
        }
        return res.status(200).json({ status: 'fail', message: 'Not found bank' })
      }
      return res.status(200).json({ status: 'fail', message: 'Time out' })
    }
    return res.status(200).json({ status: 'fail', message: 'Not Allow' })
  } catch (err) {
    return res.status(400).json({ status: 'fail', message: err })
  }
})

router.post('/GenerateTestSign', async (req, res) => {
  const key = new NodeRSA(process.env.PRIVATE_KEY)
  const data = req.body
  return res.status(201).json(key.sign(data, 'base64'))
})

export default router
