'use strict'

module.exports = ({ mysql, ecomAuth }) => {
  return (trigger, storeId, lojaId) => {
    return new Promise(async (resolve, reject) => {
      let triggerEstoque = trigger.retorno.estoques[0].estoque

      // busca a variação
      let sqlVariation = 'SELECT variation_sku, parent_sku, variation_id FROM ecomplus_products_variations WHERE variation_sku = ? AND store_id = ? AND lojaId = ?'
      let valuesVariation = [
        triggerEstoque.codigo,
        storeId,
        lojaId
      ]
      let variation = await mysql.query(sqlVariation, valuesVariation).catch(e => console.log(e))

      // verifica o produto pai
      let sql = 'SELECT product_sku, product_bling_stock, product_id FROM ecomplus_products WHERE product_sku = ? AND product_store_id = ? AND product_loja_id = ?'
      let values = [
        variation.length ? variation[0].parent_sku : triggerEstoque.codigo,
        storeId,
        lojaId
      ]
      let produto = await mysql.query(sql, values).catch(e => console.log(e))
      // estoque diferente da notificação
      if (produto[0].product_bling_stock !== triggerEstoque.estoqueAtual) {
        let sqlUpdate = 'UPDATE ecomplus_products SET product_bling_stock = ?, updated_at = CURRENT_TIMESTAMP() WHERE product_sku = ? AND product_store_id = ? AND product_loja_id = ?'
        mysql.query(sqlUpdate, [triggerEstoque.estoqueAtual, produto[0].product_sku, storeId, lojaId])
          .then(async () => {
            // api
            const sdk = await ecomAuth.then()
            let resource = '/products/' + produto[0].product_id + '/variations/' + variation[0].variation_id + '.json'
            console.log(resource)
            let quantityUpdate = Math.sign(triggerEstoque.estoqueAtual) === -1 ? 0 : triggerEstoque.estoqueAtual
            sdk.apiRequest(storeId, resource, 'PATCH', { quantity: quantityUpdate })
              .then(r => resolve(r))
              .catch(e => reject(e))
          })
          .catch(e => reject(e))
      }
      // nada a alterar
      resolve('cu')
    })
  }
}
