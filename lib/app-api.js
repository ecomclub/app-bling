'use strict'
/**
 * 
 * @param mysql 
 */
const getVariation = ({ mysql }) => {
  return (variationSku = null, variationId = null, lojaId, storeId) => {
    return new Promise((resolve, reject) => {
      let sql = `SELECT variation_sku, variation_id, variation_stock_ecomplus, variation_stock_bling, parent_sku
      FROM ecomplus_products_variations `
      if (variationId) {
        sql += `WHERE variation_id = ? `
      } else {
        sql += `WHERE variation_sku = ?`
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

/**
 * 
 * @param mysql
 */
const getProduct = ({ mysql }) => {
  return (productId = null, productSku = null, lojaId = null, storeId = null) => {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT product_sku, product_bling_stock, product_id FROM ecomplus_products WHERE product_sku = ? AND product_store_id = ? AND product_loja_id = ?'
      let values = [
        productId || productSku,
        storeId,
        lojaId
      ]
      mysql.query(sql, values).then(resolve).catch(reject)
    })
  }
}

const updateVariation = ({ mysql }) => {
  return (ecomEstoque, blingEstoque, variationId, storeId, lojaId) => {
    return new Promise((resolve, reject) => {
      let sql = `UPDATE ecomplus_products_variations SET `
      let values = []
      if (ecomEstoque) {
        sql += `variation_stock_ecomplus = ?, `
        values = [blingEstoque]
      }

      if (blingEstoque) {
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

const updateProduct = ({ mysql }) => {
  return (ecomEstoque = null, blingEstoque = null, productId, storeId, lojaId) => {
    return new Promise((resolve, reject) => {
      // atualiza produto
      let sql = `UPDATE ecomplus_products SET`
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

module.exports = {
  getVariation,
  getProduct,
  updateProduct,
  updateVariation
}
