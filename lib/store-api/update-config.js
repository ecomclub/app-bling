'use strict'
const logger = require('console-files')

module.exports = (appSdk, storeId, applicationId) => {
  return (body) => {
    let resource = `/applications/${applicationId}/hidden_data.json`
    let method = 'PATCH'
    let bodyUpdate = {
      last_sync: body
    }

    return appSdk
      .apiRequest(storeId, resource, method, bodyUpdate)
      .catch(e => {
        logger.error('--> last_sync app update erro', e)
      })
  }
}
