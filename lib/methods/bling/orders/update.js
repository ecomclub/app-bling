'use strict'
const { blingProductSchema } = require(process.cwd() + '/lib/schemas/products')

module.exports = ({ ecomAuth, mysql, Bling }) => {
  return (trigger, lojaId) => {
    return new Promise(async (resolve, reject) => {
      let sql = 'SELECT product_sku, product_ecom_stock, product_bling_stock, product_id FROM ecomplus_products WHERE product_store_id = ? AND product_loja_id = ? AND product_id = ?'
      let result = await mysql.query(sql, [trigger.store_id, lojaId, trigger.resource_id]).catch(e => console.log(e))

      // existe produto e a quantidade no trigger for diferente da quantidade no db
      if (result && (result[0].product_ecom_stock !== trigger.body.quantity)) {
        // procura o produto na api pra confirmar se o valor é o mesmo da notificação
        const sdk = await ecomAuth.then()
        let resource = '/products/' + result[0].product_id + '.json'

        sdk.apiRequest(trigger.store_id, resource, 'GET')
          .then(resp => {
            // se o valor local estiver diferente da api
            if (result[0].product_ecom_stock !== resp.response.data.quantity) {
              let sql = 'UPDATE ecomplus_products SET product_ecom_stock = ?, updated_at = CURRENT_TIMESTAMP() WHERE product_id = ? AND product_store_id = ? AND product_loja_id = ?'
              const values = [
                resp.response.data.quantity,
                result[0].product_id,
                trigger.store_id,
                lojaId
              ]

              // atualiza o estoque local com valor da api
              mysql.query(sql, values)
                .then(async () => {
                  // se o estoque do bling também estiver diferente atualizo também
                  if (result[0].product_bling_stock !== resp.response.data.quantity) {
                    // local
                    let sql = 'UPDATE ecomplus_products SET product_bling_stock = ?, updated_at = CURRENT_TIMESTAMP() WHERE product_id = ? AND product_store_id = ? AND product_loja_id = ?'
                    mysql.query(sql, values)
                      .then(async () => {
                        let app = await sdk.apiApp(trigger.store_id, null, 'GET')
                        const blingAPIKey = app.response.data.hidden_data.bling_api_key
                        const blingLojaId = app.response.data.hidden_data.bling_loja_id

                        const bling = new Bling({
                          apiKey: blingAPIKey,
                          lojaId: blingLojaId
                        })
                        let schema = blingProductSchema(resp.response.data)
                        // bling api
                        bling.produtos.update(schema, result[0].product_sku)
                          .then(r => resolve(r))
                          .catch(e => reject(e))
                      })
                  }
                })
                .catch(e => reject(e))
            }
          })
          .catch(e => reject(e))
      }
    })
  }
}
