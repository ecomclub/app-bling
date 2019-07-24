'use strict'

// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

// 
const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

module.exports = (appSdk) => {
  return (req, res) => {
    const storeId = req.storeId
    const triggerBody = req.body
    /*
    Treat E-Com Plus trigger body here
    // https://developers.e-com.plus/docs/api/#/store/triggers/
    const trigger = req.body
    */

    // get app configured options
    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        /* Do the stuff */
        switch (triggerBody.resource) {
          case 'applications':
            const handleApplications = require('./../../lib/ecomplus/triggers-applications')(appSdk, configObj)
            const watchProcedures = require('./../../lib/ecomplus/watch-procedures')(appSdk)
            handleApplications(triggerBody, storeId)
            watchProcedures(configObj, storeId)
            break
          case 'orders':
            const handleOrders = require('./../../lib/ecomplus/handle-orders')(appSdk)
            handleOrders(triggerBody, configObj, storeId)
            break
          case 'products':
            const handleProducts = require('./../../lib/ecomplus/handle-products')(appSdk)
            handleProducts(triggerBody, configObj, storeId)
            break
          default: break
        }
        // all done
        res.send(ECHO_SUCCESS)
      })

      .catch(err => {
        if (err.name === SKIP_TRIGGER_NAME) {
          // trigger ignored by app configuration
          res.send(ECHO_SKIP)
        } else {
          // logger.error(err)
          // request to Store API with error response
          // return error status code
          res.status(500)
          let { message } = err
          res.send({
            error: ECHO_API_ERROR,
            message
          })
        }
      })
  }
}
