'use strict'

const REGISTER_PROCEDURE = 'regiter-procedure'
const DELETE_PROCEDURE = 'delete-procedure'
const TAG_PRODUCT = 'bling_sync_products'
const TAG_ORDERS = 'bling_sync_orders'
const PRODUCTS = 'products'
const ORDERS = 'orders'

module.exports = (appSdk) => {
  return (configObj, storeId) => {
    let promises = []
    if (configObj.synchronize != null &&
      configObj.synchronize.hasOwnProperty('ecomplus') &&
      configObj.synchronize.ecomplus.hasOwnProperty('products') &&
      configObj.synchronize.ecomplus.products.auto === true) {
      promises.push(handleProcedures(appSdk, storeId, REGISTER_PROCEDURE, PRODUCTS, TAG_PRODUCT))
    } else {
      promises.push(handleProcedures(appSdk, storeId, DELETE_PROCEDURE, PRODUCTS, TAG_PRODUCT))
    }

    if (configObj.synchronize != null &&
      configObj.synchronize.hasOwnProperty('ecomplus') &&
      configObj.synchronize.ecomplus.hasOwnProperty('orders') &&
      configObj.synchronize.ecomplus.orders.auto === true) {
      promises.push(handleProcedures(appSdk, storeId, REGISTER_PROCEDURE, ORDERS, TAG_ORDERS))
    } else {
      promises.push(handleProcedures(appSdk, storeId, DELETE_PROCEDURE, ORDERS, TAG_ORDERS))
    }

    return Promise.all(promises)
  }
}

const handleProcedures = (appSdk, storeId, action, triggerResource, tag) => {
  let resource = '/procedures'
  let method = 'GET'
  return appSdk.apiRequest(storeId, resource + `.json?tag=${tag}`, method)
    .then(resp => {
      let { result } = resp.response.data
      let resource
      let method
      let data = {}
      let run = false
      switch (action) {
        case REGISTER_PROCEDURE:
          method = 'POST'
          resource = `/procedures.json`
          data = {
            title: `Bling AUTO SYNC - ${triggerResource.toUpperCase()}`,
            short_description: `Keeps bling up to date with ${triggerResource} resource`,
            triggers: [
              {
                resource: triggerResource
              }
            ],
            webhooks: [
              {
                api: {
                  external_api: { // debug
                    uri: 'https://bling.ecomplus.biz/ecom/webhook'
                  }
                },
                method: 'POST',
                send_body: true
              }
            ],
            tag: tag
          }
          run = (!result.length)
          break
        case DELETE_PROCEDURE:
          if (result.length) {
            method = 'DELETE'
            resource = `/procedures/${result[0]._id}.json`
            run = (result.length)
          }
          break
        default: break
      }

      if (run) {
        return appSdk.apiRequest(storeId, resource, method, data)
      }
    })
}
