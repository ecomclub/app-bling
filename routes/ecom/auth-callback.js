'use strict'

// log on files
const logger = require('console-files')

module.exports = (appSdk) => {
  return (req, res) => {
    // handle callback with E-Com Plus app SDK
    // https://github.com/ecomplus/application-sdk
    appSdk.handleCallback(req.storeId, req.body)

      .then(({ isNew, authenticationId }) => {
        res.status(204)
        res.end()
      })

      .catch(err => {
        if (typeof err.code === 'string' && !err.code.startsWith('SQLITE_CONSTRAINT')) {
          // debug SQLite errors
          logger.error(err)
        }
        res.status(500)
        const { message } = err
        res.send({
          error: 'auth_callback_error',
          message
        })
      })
  }
}
