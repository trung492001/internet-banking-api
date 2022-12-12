import jwt from 'jsonwebtoken'
import _CONF from '../config/index.js'

export default (req, res, next) => {
  const token = req.body.token || req.query.token || req.headers['x-access-token']
  // decode token
  if (token) {
    // verifies secret and checks exp
    jwt.verify(token, _CONF.SECRET, function (err, decoded) {
      if (err) {
        console.error(err.toString())
        // if (err) throw new Error(err)
        return res.status(401).json({ error: true, message: 'Unauthorized access.', err })
      }
      console.log(`decoded>>${decoded}`)
      res.locals.currentUser = decoded
      res.locals.authenticated = true
      next()
    })
  } else {
    // if there is no token
    // return an error
    res.locals.currentUser = null
    res.locals.authenticated = false
    return res.status(403).send({
      error: true,
      message: 'No token provided.'
    })
  }
}
