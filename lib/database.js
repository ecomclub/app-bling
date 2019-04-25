'use strict'

const mysql = require('mysql')
const logger = require('console-files')

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  insecureAuth: true
})

const query = (sql, values) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, values, (error, results, fields) => {
      if (error) {
        console.error(error.message)
        logger.error(error)
        reject(error)
      }
      resolve(results)
    })
  })
}

module.exports = {
  pool,
  query
}
