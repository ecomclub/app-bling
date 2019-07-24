'use strict'
module.exports = (storeId, appSdk, applicationId) => {
  return ({ configObj }) => {
    console.log('--> Sync end')
    let { synchronize } = configObj || {}
    // update application data to default to prevent duplicate synchronizations
    let data = {
      synchronize: {
        ecomplus: {
          products: {
            all: false,
            ids: [],
            auto: (synchronize.hasOwnProperty('ecomplus') && synchronize.ecomplus.hasOwnProperty('products')) ? synchronize.ecomplus.products.auto : false
          },
          orders: {
            all: false,
            ids: [],
            auto: (synchronize.hasOwnProperty('ecomplus') && synchronize.ecomplus.hasOwnProperty('orders')) ? synchronize.ecomplus.orders.auto : false
          }
        }
      }
    }

    // merge with config
    data = {
      synchronize: {
        ...configObj.synchronize,
        ...data.synchronize
      }
    }

    let resource = `/applications/${applicationId}/data.json`
    let method = 'PATCH'
    return appSdk.apiRequest(storeId, resource, method, data)
  }
}