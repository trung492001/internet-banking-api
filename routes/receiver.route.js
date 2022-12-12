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

const router = express.Router()

const receiverSchema = JSON.parse(await readFile(new URL('../schemas/receiver.json', import.meta.url)))

router.use(currentUserMdw)
router.post('/', validate(receiverSchema), async (req, res) => {
  const currentUser = res.locals.currentUser
  const data = req.body
  const account = await accountModel.find({ number: data.account_number }, 'user_id id')
  if (!account) {
    return res.status('200').json({ message: 'Không tìm thấy tài khoản' })
  }
  if (data.reminiscent_name === undefined || data.reminiscent_name === null || data.reminiscent_name === '') {
    const user = await userModel.find({ id: account.user_id }, userViewModel.split(' '))
    if (!user) {
      return res.status('200').json({ message: 'Không tìm thấy người dùng' })
    }
    data.reminiscent_name = user.user_name
  }
  data.user_id = currentUser.id
  const bank = await bankModel.find({ id: data.bank_id })
  if (!bank) {
    return res.status('200').json({ message: 'Không tìm thấy ngân hàng' })
  }
  const ret = await receiverModel.add(data, receiverViewModel.split(' '))
  return res.status('201').json(ret[0])
})

export default router
