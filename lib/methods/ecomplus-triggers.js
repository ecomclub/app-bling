'use strict'

module.exports = ({ mysql, ecomAuth, Bling }) => {
  return async (request, response) => {
    const { lojaId } = request.query
    const requestBody = request.body
    const sdk = await ecomAuth.then()

    let findApp = await sdk.apiApp(requestBody.store_id, null, 'GET').catch(e => console.log(e))
    const application = findApp.response.data

    const triggerParse = async trigger => {
      switch (trigger.resource) {
        case 'products':
          let apiPath = '/products/' + (trigger.resource_id || trigger.inserted_id) + '.json'
          let method = 'GET'
          let product = await sdk.apiRequest(requestBody.store_id, apiPath, method)
          let promise = new Promise()
          //
          if (trigger.action === 'change') {
            if (trigger.hasOwnProperty('fields') && trigger.fields.includes('quantity')) {
              const updateProduct = require('../methods/bling/products/update')({ ecomAuth, mysql, Bling })
              promise = updateProduct(trigger, lojaId)
            }
          } else if (trigger.action === 'create') {
            const insertProduct = require('../methods/bling/products/insert')({ ecomAuth, mysql, Bling })
            promise = insertProduct(application, product)
          } else {

          }

          return promise
            .then(() => response.status(200).end())
            .catch(() => response.status(400).end())
        case 'orders':
          break
        case 'applications':
          break
        default:
          break
      }
    }

    //
    triggerParse(requestBody)
  }
}
