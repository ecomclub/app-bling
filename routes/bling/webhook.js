'use strict'
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'
const logger = require('console-files')

module.exports = (appSdk) => {
  return (req, res) => {
    const { storeId } = req.query
    const { data } = req.body

    // get app configured options
    getConfig({ appSdk, storeId }, true)
      .then(configObj => {
        let body
        try {
          body = JSON.parse(data)
        } catch (err) {
          logger.error('ParseBodyErr', err)
        }

        if (body.retorno.hasOwnProperty('estoques')) {
          const stockManager = require('./../../lib/bling/handle-stock')(configObj, appSdk, storeId)
          stockManager(body)
        }
        if (body.retorno.hasOwnProperty('pedidos')) {
          const ordersManager = require('./../../lib/bling/handle-orders')(configObj, appSdk, storeId)
          ordersManager(body)
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