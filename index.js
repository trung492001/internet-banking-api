import express from 'express'
import morgan from 'morgan'
import http from 'http'
import cors from 'cors'

import swaggerUi from 'swagger-ui-express'
import { readFile } from 'fs/promises'

import userRoute from './routes/user.route.js'
import roleRoute from './routes/role.router.js'
import accountRoute from './routes/account.route.js'
import refreshTokenRoute from './routes/refreshToken.router.js'
import receiverRoute from './routes/receiver.route.js'
import transactionRoute from './routes/transaction.route.js'
import debtReminderRoute from './routes/debtReminder.route.js'
import externalRoute from './routes/external.route.js'

const app = express()
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

app.use('/Users', userRoute)
app.use('/Roles', roleRoute)
app.use('/Accounts', accountRoute)
app.use('/RefreshToken', refreshTokenRoute)
app.use('/Receivers', receiverRoute)
app.use('/Transactions', transactionRoute)
app.use('/DebtReminders', debtReminderRoute)
app.use('/Api', externalRoute)

app.get('/', (req, res) => {
  res.send('Hello World')
})

const swaggerSpec = JSON.parse(await readFile(new URL('./schemas/swagger.json', import.meta.url)))
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.get('/err', function (req, res) {
  throw new Error('Error!')
})

app.use(function (req, res) {
  res.status(404).json({
    error: 'Endpoint not found!'
  })
})

app.use(function (err, req, res, next) {
  console.log(err.stack)
  res.status(500).json({
    message: err.stack
  })
})

const PORT = process.env.PORT || 3030
const server = http.createServer(app)
server.listen(PORT, () => {
  console.log(`Internet Banking API listening on port ${PORT}`)
})
