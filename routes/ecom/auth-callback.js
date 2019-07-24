'use strict'

// log on files
const logger = require('console-files')
const { internalApi } = require('./../../lib/Api/Api')

module.exports = (appSdk) => {
  return (req, res) => {
    // handle callback with E-Com Plus app SDK
    // https://github.com/ecomclub/ecomplus-app-sdk
    appSdk.handleCallback(req.storeId, req.body)

      .then(({ isNew, authenticationId }) => {
        // authentication tokens were updated
        if (isNew) {
          internalApi
            .then(api => {
              api.addAppConfig(req.storeId, req.body.application._id, authenticationId)
            })
        }

        res.status(204)
        res.end()
      })

      .catch(err => {
        if (typeof err.code === 'string' && !err.code.startsWith('SQLITE_CONSTRAINT')) {
          // debug SQLite errors
          logger.error(err)
        }
        res.status(500)
        let { message } = err
        res.send({
          error: 'auth_callback_error',
          message
        })
      })
  }
}
