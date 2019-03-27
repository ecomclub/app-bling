'use strict'

// handle app authentication to Store API
const { ecomAuth } = require('ecomplus-app-sdk')

module.exports = (req, res) => {
  require('../index')(req, res).then((storeId, body) => {
    ecomAuth.then(appSdk => {
      // Store API authentication callback
      appSdk.handleCallback(storeId, body).then(() => {
        // just respond first
        res.statusCode = 204
        res.end()
      })

        .catch(err => {
          if (typeof err.code === 'string' && !err.code.startsWith('SQLITE_CONSTRAINT')) {
            // debug SQLite errors
            console.error(err)
          }
          res.statusCode = 500
          res.end(err.message)
        })
    })
  })
}
