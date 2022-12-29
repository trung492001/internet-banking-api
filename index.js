import express from 'express'
import morgan from 'morgan'
import http from 'http'
import cors from 'cors'

import userRoute from './routes/user.route.js'
import roleRoute from './routes/role.router.js'
import accountRoute from './routes/account.route.js'
import refreshTokenRoute from './routes/refreshToken.router.js'
import receiverRoute from './routes/receiver.route.js'
import transactionRoute from './routes/transaction.route.js'
import debtReminderRoute from './routes/debtReminder.route.js'

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

app.get('/', (req, res) => {
  res.send('Hello World')
})

const PORT = process.env.PORT || 3030
const server = http.createServer(app)
server.listen(PORT, () => {
  console.log(`Internet Banking API listening on port ${PORT}`)
})
