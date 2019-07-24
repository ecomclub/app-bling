'use strict'
module.exports = ({ mysql }) => {
  return (ecomEstoque, blingEstoque, variationId, storeId, lojaId) => {
    console.log(ecomEstoque, blingEstoque, variationId, storeId, lojaId)
    return new Promise((resolve, reject) => {
      let sql = `UPDATE ecomplus_products_variations SET `
      let values = []
      if (ecomEstoque !== null) {
        sql += `variation_stock_ecomplus = ?, `
        values = [ecomEstoque]
      }

      if (blingEstoque !== null) {
        sql += `variation_stock_bling = ?, `
        values = [...values, blingEstoque]
      }

      sql += `updated_at = CURRENT_TIMESTAMP() 
        WHERE variation_id = ?
          AND store_id = ? 
          AND lojaId = ?`

      values = [
        ...values,
        variationId,
        storeId,
        lojaId
      ]
      mysql.query(sql, values).then(resolve).catch(reject)
    })
  }
}
