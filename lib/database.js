'use strict'

const mysql = require('mysql')
const logger = require('console-files')

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  insecureAuth: true
})

/* pool.connect(function (err) {
  if (err) {
    return console.error('error: ' + err.message)
  } else {
    logger.log('Database conected.')
  }
}) */

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
