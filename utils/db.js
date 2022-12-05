import knex from 'knex';
import * as dotenv from 'dotenv'
dotenv.config();

console.log(process.env.PG_CONNECTION_STRING);

export default knex({
    client: 'pg',
    connection:{
        host : '127.0.0.1',
        port : 5432,
        user : 'postgres',
        password : 'mismart123',
        database : 'internet-banking'
    },
    searchPath: ['knex', 'public'],
});