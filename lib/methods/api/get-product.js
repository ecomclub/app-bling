'use strict'
module.exports = ({ mysql }) => {
  return (productId = null, productSku = null, lojaId = null, storeId = null) => {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT product_sku, product_bling_stock, product_id FROM ecomplus_products WHERE '
      let values = []
      if (productId !== null) {
        sql += 'product_id = ? AND '
        values = [productId]
      }

      if (productSku !== null) {
        sql += 'product_sku = ? AND '
        values = [...values, productSku]
      }

      sql += 'product_store_id = ? AND product_loja_id = ?'
      values = [
        ...values,
        storeId,
        lojaId
      ]
      mysql.query(sql, values).then(resolve).catch(reject)
    })
  }
}
