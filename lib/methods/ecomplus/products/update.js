'use strict'
/**
 *  Atualiza estoque na ecomplus caso o estoque seja diferente do bling e do banco de dados local
 */
module.exports = ({ mysql, ecomAuth }) => {
  const getVariation = require('../../api/get-variations')({ mysql })
  const getProduct = require('../../api/get-product')({ mysql })
  const updateProduct = require('../../api/update-product')({ mysql })
  const updateVariation = require('../../api/update-variation')({ mysql })

  return (trigger, storeId, lojaId) => {
    return new Promise(async (resolve, reject) => {
      let promise = null
      let resource = ''
      let pathBody = {}

      // busca pela variação
      // se não existir busca o produto 'pai'
      let variation = await getVariation(trigger.codigo, null, lojaId, storeId).catch(e => console.log(e))

      if (variation.length) {
        if (variation[0].variation_stock_bling !== trigger.estoqueAtual) {
          promise = updateVariation(null, trigger.estoqueAtual, variation[0].variation_id, storeId, lojaId)
          // busco id do produto pai pelo sku
          let product = await getProduct(null, variation[0].parent_sku, lojaId, storeId).catch(e => console.log(e))
          resource = '/products/' + product[0].product_id + '/variations/' + variation[0].variation_id + '.json'
          pathBody = {
            quantity: Math.sign(trigger.estoqueAtual) === -1 ? 0 : trigger.estoqueAtual
          }
        }
      } else {
        // quando for produto e não variação
        let product = await getProduct(null, trigger.codigo, lojaId, storeId).catch(e => console.log(e))
        if (product.length) {
          if (product[0].product_bling_stock !== trigger.estoqueAtual) {
            resource = '/products/' + product[0].product_id + '.json'
            pathBody = {
              quantity: Math.sign(trigger.estoqueAtual) === -1 ? 0 : trigger.estoqueAtual
            }
            promise = updateProduct(trigger.estoqueAtual, trigger.estoqueAtual, product[0].product_id, storeId, lojaId)
          }
        }
      }

      if (!promise) {
        resolve()
      }

      const sdk = await ecomAuth.then()
      const updateProductEcom = sdk.apiRequest(storeId, resource, 'PATCH', pathBody)

      // se tiver tudo ok atualiza estque na ecom
      promise.then(updateProductEcom).then(resolve).catch(reject)
    })
  }
}
