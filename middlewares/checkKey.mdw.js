import sha256 from 'sha256'
export default (req, res, next) => {
  const token = req.body.token || req.query.token || req.headers['x-secret-token']
  const time = req.body.time || req.query.time || req.headers['x-time']
  console.log(req)
  const stringKey = time + req.baseUrl + process.env.secret_key
  if (sha256(stringKey) === token) { next() } else {
    return res.json({ status: 'success', elements: 'Secret Key Invalid!!!' })
  }
}
