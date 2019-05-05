'use strict'
module.exports = ({ ecomAuth, mysql, Bling }) => {
  return (trigger, lojaId) => {
    return new Promise(async (resolve, reject) => {
      let sql, values

      if (trigger.hasOwnProperty('subresource') && trigger.subresource === 'variations') {
        // variação?
        sql = `SELECT variation_sku, variation_id, variation_stock_ecomplus, variation_stock_bling, parent_sku
                    FROM ecomplus_products_variations 
                    WHERE variation_id = ?
                    AND store_id = ? 
                    AND lojaId = ?`
        values = [
          trigger.subresource_id,
          trigger.store_id,
          lojaId
        ]
      } else {
        // produto
        sql = `SELECT product_sku, product_ecom_stock, product_bling_stock, product_id 
                    FROM ecomplus_products 
                    WHERE product_id = ? 
                    AND product_store_id = ? 
                    AND product_loja_id = ?`
        values = [
          trigger.resource_id,
          trigger.store_id,
          lojaId
        ]
      }

      mysql.query(sql, values).then(async result => {
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
              // quantidade local diferente da api?
              if (apiResp.response.data.quantity !== ecomStockValue) {
                // atualiza produto no db e depois no bling
                if (trigger.subresource === 'variations') {
                  // atualiza variação
                  let variation = apiResp.response.data.variations.find(variation => variation._id === trigger.subresource_id)
                  sql = `UPDATE ecomplus_products_variations
                    SET variation_stock_ecomplus = ?`
                  if (blingStockValue !== variation.quantity) {
                    sql += `, variation_stock_bling = ? `
                    values = [variation.quantity]
                  }
                  sql += `WHERE variation_id = ?
                    AND store_id = ? 
                    AND lojaId = ?`
                  values = [
                    ...values,
                    variation.quantity,
                    trigger.subresource_id,
                    trigger.store_id,
                    lojaId
                  ]
                } else {
                  // atualiza produto
                  sql = `UPDATE ecomplus_products 
                  SET product_ecom_stock = ?, updated_at = CURRENT_TIMESTAMP() 
                  WHERE product_id = ? 
                  AND product_store_id = ? 
                  AND product_loja_id = ?`
                  values = [
                    apiResp.response.data.quantity,
                    result[0].product_id,
                    trigger.store_id,
                    lojaId
                  ]
                }

                await mysql.query(sql, values)
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
            }
            resolve()
          })
          .catch(e => console.log(e))
      }).catch(e => console.log(e))
    })
  }
}
