'use strict'

module.exports = ({ mysql, ecomAuth, Bling }) => {
  return async (request, response) => {
    const { lojaId } = request.query
    const requestBody = request.body
    const sdk = await ecomAuth.then()
    const findApp = await sdk.apiApp(requestBody.store_id, null, 'GET').catch(e => console.log(e))
    const application = findApp.response.data
    console.log(requestBody)
    //
    const sucess = () => response.status(204).end()
    const fail = () => response.status(400).end()

    const triggerParse = async trigger => {
      switch (trigger.resource) {
        case 'products':
          let apiPath = '/products/' + (trigger.resource_id || trigger.inserted_id) + '.json'
          let method = 'GET'
          let product = await sdk.apiRequest(requestBody.store_id, apiPath, method).catch(e => console.log(e))
          let promise = null

          //
          if (trigger.action === 'change') {
            if (trigger.hasOwnProperty('fields') && trigger.fields.includes('quantity')) {
              console.log('Update')
              const updateProduct = require('../methods/bling/products/update')({ ecomAuth, mysql, Bling })
              promise = updateProduct(trigger, lojaId)
            }
          } else if (trigger.action === 'create') {
            const insertProduct = require('../methods/bling/products/insert')({ ecomAuth, mysql, Bling })
            promise = insertProduct(application, product)
          } else {
            sucess()
            break
          }

          if (promise) {
            promise.then(sucess).catch(fail)
          }
          sucess()
          break
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
