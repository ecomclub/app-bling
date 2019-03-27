'use strict'

// validate by IP address to receive mutation requests from E-Com Plus only
// https://github.com/ecomclub/ecomplus-app-sdk
const { ecomServerIps } = require('ecomplus-app-sdk')

module.exports = (req, res) => {
  return new Promise(resolve => {
    // function called before endpoints
    // authentications and other prerequisites when necessary
    // requires store ID
    let storeId = req.headers['x-store-id']
    if (typeof storeId === 'string') {
      storeId = parseInt(storeId, 10)
    }

    if (typeof storeId !== 'number' || isNaN(storeId) || storeId < 0) {
      // invalid ID string
      res.statusCode = 403
      res.end('Undefined or invalid Store ID')
      return
    } else {
      if (req.method !== 'GET' && process.env.NODE_ENV === 'production') {
        // check if request comes from E-Com Plus servers
        if (ecomServerIps.indexOf(req.headers['x-real-ip']) === -1) {
          res.statusCode = 403
          res.end('Who are you? Unauthorized IP address')
          return
        }
      }
    }

    // proceed to endpoint function
    resolve()
  })
}
