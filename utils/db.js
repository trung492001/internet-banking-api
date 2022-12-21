import knex from 'knex'
import * as dotenv from 'dotenv'
dotenv.config()

// config.ssl = { rejectUnauthorized: false }
export default knex({
  client: 'pg',
  connection: process.env.DATABASE_URL
})
