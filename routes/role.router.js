import express from 'express'
import roleModel from '../models/role.model.js'

const router = express.Router()

router.post('/', async (req, res) => {
  let role = req.body

  const ret = await roleModel.add(role)
  role = {
    id: ret[0],
    ...role
  }
  res.status(201).json(role)
})

export default router
