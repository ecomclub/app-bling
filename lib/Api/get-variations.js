'use strict'

module.exports = ({ mysql }) => {
  return (variationSku = null, variationId = null, lojaId, storeId) => {
    return new Promise((resolve, reject) => {
      let sql = `SELECT variation_sku, variation_id, variation_stock_ecomplus, variation_stock_bling, parent_sku
      FROM ecomplus_products_variations `
      if (variationId) {
        sql += `WHERE variation_id = ? `
      } else {
        sql += `WHERE variation_sku = ? `
      }

      sql += `AND store_id = ? AND lojaId = ?`

      let values = [
        variationId || variationSku,
        storeId,
        lojaId
      ]
      mysql.query(sql, values).then(resolve).catch(reject)
    })
  }
}
