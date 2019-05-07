'use strict'
module.exports = ({ mysql }) => {
  return (ecomEstoque = null, blingEstoque = null, productId, storeId, lojaId) => {
    return new Promise((resolve, reject) => {
      // atualiza produto
      let sql = `UPDATE ecomplus_products SET `
      let values = []
      if (ecomEstoque) {
        sql += `product_ecom_stock = ?, `
        values = [ecomEstoque]
      }

      if (blingEstoque) {
        sql += `product_bling_stock = ?, `
        values = [...values, blingEstoque]
      }

      sql += `updated_at = CURRENT_TIMESTAMP() 
        WHERE product_id = ? 
          AND product_store_id = ? 
          AND product_loja_id = ?`
      values = [
        ...values,
        productId,
        storeId,
        lojaId
      ]
      mysql.query(sql, values).then(resolve).catch(reject)
    })
  }
}
