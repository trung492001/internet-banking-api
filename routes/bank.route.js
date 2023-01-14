import express from 'express'
import currentUserMdw from '../middlewares/currentUser.mdw.js'
import bankModel from '../models/bank.model.js'

const router = express.Router()

router.use(currentUserMdw)

router.get('/', async (req, res) => {
  const ret = await bankModel.findAll('name id'.split(' '))
  return res.json({ status: 'success', data: ret.slice(1) })
})

export default router
