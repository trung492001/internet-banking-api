import knex from 'knex'
import * as dotenv from 'dotenv'
import pgConnectionString from 'pg-connection-string'
dotenv.config()

const config = pgConnectionString.parse(process.env.DATABASE_URL)

// config.ssl = { rejectUnauthorized: false }
export default knex({
  client: 'pg',
  connection: config
})
