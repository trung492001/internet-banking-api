import express from 'express'
// import accountModel from '../models/account.model.js'
// import { accountViewModel } from '../view_models/account.viewModel.js'

const router = express.Router()

// router.post('/', async (req, res) => {
//   const data = req.body
//   const account = await accountModel.find({ uuid: data.account_uuid }, accountViewModel)
//   if (!account) {
//     res.status('200').json({ message: 'Không tìm thấy tài khoản' })
//   }
//   const receiverAccount = await accountModel.find({ uuid: data.receiver_account_uuid })
//   if account

// })

export default router
