'use strict'

const mysql = require('mysql')

const con = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
})

con.connect(function (err) {
  if (err) {
    return console.error('error: ' + err.message)
  }
})

const query = (sql, values) => {
  return new Promise((resolve, reject) => {
    con.query(sql, values, (error, results, fields) => {
      if (error) {
        console.error(error.message)
        reject(error)
      }
      resolve(results)
    })
  })
}

module.exports = {
  con,
  query
}
