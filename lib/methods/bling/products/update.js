'use strict'
module.exports = ({ ecomAuth, mysql, Bling }) => {
  return (trigger, lojaId) => {
    return new Promise((resolve, reject) => {
      const storeId = trigger.store_id
      let promise = null
      // variação
      if (trigger.hasOwnProperty('subresource') && trigger.subresource === 'variations') {
        const getVariation = require('../../api/get-variations')({ mysql })
        promise = getVariation(null, trigger.subresource_id, lojaId, storeId)
      } else {
        // produto
        const getProduct = require('../../api/get-product')({ mysql })
        promise = getProduct(trigger.resource_id, null, lojaId, storeId)
      }
      // atualiza no banco e no bling
      promise
        .then(async result => {
          const sdk = await ecomAuth.then()
          let apiPath = 'products/' + trigger.resource_id + '.json'
          let method = 'GET'
          let ecomStockValue = result[0].product_ecom_stock || result[0].variation_stock_ecomplus
          let blingStockValue = result[0].product_ecom_bling || result[0].variation_stock_bling
          let productSku = result[0].product_sku || result[0].parent_sku

          sdk.apiRequest(trigger.store_id, apiPath, method)
            .then(async apiResp => {
              // quantidade diferente do local?
              if (trigger.body.quantity !== ecomStockValue) {
                let promise = null
                if (trigger.hasOwnProperty('subresource') && trigger.subresource === 'variations') {
                  // atualiza variação
                  let variation = apiResp.response.data.variations.find(variation => variation._id === trigger.subresource_id)
                  let blingEstoque = blingStockValue !== variation.quantity ? variation.quantity : null
                  const updateVariation = require('../../api/update-variation')({ mysql })
                  promise = updateVariation(variation.quantity, blingEstoque, trigger.subresource_id, storeId, lojaId)
                } else {
                  // atualiza produto
                  const updateProduct = require('../../api/update-product')({ mysql })
                  promise = updateProduct(apiResp.response.data.quantity, null, result[0].product_id, storeId, lojaId)
                }

                promise
                  .then(async result => {
                    let app = await sdk.apiApp(trigger.store_id, null, 'GET')
                    const blingAPIKey = app.response.data.hidden_data.bling_api_key
                    const blingLojaId = app.response.data.hidden_data.bling_loja_id

                    const bling = new Bling({
                      apiKey: blingAPIKey,
                      lojaId: blingLojaId
                    })

                    const { blingProductSchema } = require('../../../schemas/products')

                    let schema = blingProductSchema(apiResp.response.data)
                    // bling api
                    bling.produtos.update(schema, productSku).then(resolve).catch(reject)
                  })
                  .catch(e => console.log(e))
              }
              resolve()
            })
            .catch(reject)
        })
        .catch(reject)
    })
  }
}
