import express from 'express'
import roleModel from '../models/role.model.js'

const router = express.Router()

router.post('/', async (req, res) => {
  const role = req.body

  const ret = await roleModel.add(role)

  // role = {
  //   id: ret[0],
  //   ...role
  // }

  res.status(201).json({
    id: ret[0],
    ...role
  })
})

router.get('/', async (req, res) => {
  const ret = await roleModel.fetch({}, 'id name'.split(' '))
  res.status(200).json(ret)
})

export default router
