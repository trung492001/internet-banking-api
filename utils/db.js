import knex from 'knex'
import * as dotenv from 'dotenv'
dotenv.config()

export default knex({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: '123456',
    database: 'internet-banking'
  },
  searchPath: ['knex', 'public']
})
