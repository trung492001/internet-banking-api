import express from 'express';
import accountModel from '../models/account.model.js';

const router = express.Router();

router.get('/', async function (req, res) {
  console.log('a');
  const list = await accountModel.findAll();
  res.json(list);
});

router.post('/', async function (req, res) {
  let actor = req.body;
  const ret = await accountModel.add(actor);
  actor = {
    actor_id: ret[0],
    ...actor
  }
  res.status(201).json(actor);
});

export default router;