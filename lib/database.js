'use strict'

const mysql = require('mysql')

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  insecureAuth: true
})

const query = (sql, values) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, values, (error, results, fields) => {
      if (error) {
        reject(error)
      }
      resolve(results)
    })
  })
}

module.exports = {
  pool,
  // query instance
  query,
  /**
   * products db interface
   */
  products: {
    /**
     * save product
     */
    save: (sku, name, ecomPrice, ecomQuantity, blingPrice, blingQuantity, storeId, lojaId, productId, blingProductId) => {
      const sql = 'INSERT INTO ecomplus_products (product_sku, product_name, product_ecom_price, product_ecom_stock, product_bling_price, product_bling_stock, product_store_id, product_loja_id, product_id, product_bling_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?,?, ?)'
      return query(sql, [sku, name, ecomPrice, ecomQuantity, blingPrice, blingQuantity, storeId, lojaId, productId, blingProductId])
    },

    /**
     * get produtoc
     */
    get: (ecomId, storeId) => {
      const sql = 'SELECT * FROM ecomplus_products WHERE product_id = ? AND product_store_id = ?'
      return query(sql, [ecomId, storeId])
    },
    
    delete: (id, storeId) => {
      const sql = 'DELETE FROM ecomplus_products WHERE id = ? AND product_store_id = ?'
      return query(sql, [id, storeId])
    }
  },
  /**
   * variations db interface
   */
  variations: {
    save: (name, id, sku, parentSku, ecomQuantity, blingQuantity, lojaId, storeId) => {
      const sql = 'INSERT INTO ecomplus_products_variations (name, variation_id, variation_sku, parent_sku, variation_stock_ecomplus, variation_stock_bling, lojaId, store_id) VALUES (?,?,?,?,?,?,?,?)'
      return query(sql, [name, id, sku, parentSku, ecomQuantity, blingQuantity, lojaId, storeId])
    }
  },
  /**
   * orders db interface
   */
  orders: {
    /**
     * save orders
     */
    save: (storeId, orderId, blingId, lojaId, ecomStatus, blingStatus) => {
      const sql = 'INSERT INTO ecomplus_orders (order_store_id,order_ecom_id,order_bling_id,order_loja_id, order_ecom_status, order_bling_status) VALUES (?, ?, ?, ?, ?,?)'
      return query(sql, [storeId, orderId, blingId, lojaId, ecomStatus, blingStatus])
    },
    /**
     * get order
     */
    get: (ecomId, storeId) => {
      const sql = 'SELECT * FROM ecomplus_orders WHERE order_ecom_id = ? AND order_store_id = ?'
      return query(sql, [ecomId, storeId])
    }
  },

  logger: {
    error: (erros) => {
      if (Array.isArray(erros)) {
        const promises = []
        for (let i = 0; i < erros.length; i++) {
          const erro = erros[i]
          const keys = Object.keys(erro)
          const stmt = keys.map(() => '?')
          const values = Object.keys(erro).map(k => erro[k])
          const sql = 'insert into app_logs ' +
            `(${keys.join(',')}) ` +
            `values (${stmt.join(',')})`
          const promise = query(sql, values)
          promises.push(promise)
        }
        return Promise.all(promises)
      }

      throw new Error('! `erros` must be a array of erros')
    }
  }
}
