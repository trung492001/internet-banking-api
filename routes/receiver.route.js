import express from 'express'
import currentUserMdw from '../middlewares/currentUser.mdw.js'
import validate from '../middlewares/validate.mdw.js'
import { readFile } from 'fs/promises'
import accountModel from '../models/account.model.js'
import userModel from '../models/user.model.js'
import { userViewModel } from '../view_models/user.viewModel.js'
import receiverModel from '../models/receiver.model.js'
import bankModel from '../models/bank.model.js'
import { receiverViewModel } from '../view_models/receiver.viewModel.js'
import { accountViewModel } from '../view_models/account.viewModel.js'

const router = express.Router()

const addReceiverSchema = JSON.parse(await readFile(new URL('../schemas/addReceiver.json', import.meta.url)))

router.use(currentUserMdw)
router.post('/', validate(addReceiverSchema), async (req, res) => {
  const currentUser = res.locals.currentUser
  const data = req.body
  const account = await accountModel.findOne({ number: data.account_number }, accountViewModel)
  if (!account) {
    return res.status(204).json({ message: 'Không tìm thấy tài khoản' })
  }
  if (data.reminiscent_name === undefined || data.reminiscent_name === null || data.reminiscent_name === '') {
    const user = await userModel.findOne({ id: account.user_id }, userViewModel)
    if (!user) {
      return res.status(204).json({ message: 'Không tìm thấy người dùng' })
    }
    data.reminiscent_name = user.username
  }
  data.user_id = currentUser.id
  const bank = await bankModel.fetch({ id: data.bank_id })
  if (!bank) {
    return res.status(204).json({ message: 'Không tìm thấy ngân hàng' })
  }
  const ret = await receiverModel.add(data, receiverViewModel.split(' '))
  return res.status(201).json(ret[0])
})

router.patch('/:id', validate(addReceiverSchema), async (req, res) => {
  const currentUser = res.locals.currentUser
  const data = req.body
  const id = req.params.id
  console.log(id)
  const oldReceiver = await receiverModel.fetch({ id, user_id: currentUser.id })
  if (!oldReceiver) {
    return res.status(204).json({ message: 'Không tìm thấy người nhận' })
  }
  const ret = await receiverModel.update(id, data, receiverViewModel.split(' '))
  return res.status(200).json(ret[0])
})

router.delete('/:id', async (req, res) => {
  const currentUser = res.locals.currentUser
  const id = req.params.id
  console.log(id)
  const oldReceiver = await receiverModel.findOne({ id, user_id: currentUser.id }, receiverViewModel)
  if (!oldReceiver) {
    return res.status(204).json({ message: 'Không tìm thấy người nhận' })
  }
  await receiverModel.delete(id)
  return res.status(200).json()
})

router.get('/', async (req, res) => {
  const currentUser = res.locals.currentUser
  const receivers = await receiverModel.fetch({ user_id: currentUser.id }, receiverViewModel)
  return res.status(200).json(receivers)
})

export default router
