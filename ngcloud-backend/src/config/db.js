const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

pool.on('connect', () => {
  console.log('✓ New database connection established')
})

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message)
})

module.exports = pool