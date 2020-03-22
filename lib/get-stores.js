// sqlite
const sqlite = require('sqlite3').verbose()
const db = new sqlite.Database(process.env.ECOM_AUTH_DB)

module.exports = () => new Promise((resolve, reject) => {
  const query = 'SELECT DISTINCT store_id FROM ecomplus_app_auth ORDER BY created_at DESC'
  db.all(query, (err, rows) => {
    if (err) {
      reject(new Error(err.message))
    }
    if (rows) {
      rows = rows.map(row => row.store_id)
    }
    resolve(rows)
  })
})
