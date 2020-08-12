
module.exports = ({ database }) => {
  return (req, res) => {
    const productId = req.params.id
    const storeId = req.storeId

    if (productId) {
      const sql = 'select * from ecomplus_products WHERE id = ? AND product_store_id = ? limit 1'
      const values = [productId, storeId]
      return database.query(sql, values).then(async rows => {
        const product = rows[0]
        if (!rows || !rows.length) {
          res.status(404)
          return res.send({
            status: 404,
            message: 'Recurso não encontrado, verifique se o :id informado está correto.'
          })
        }


        const sqlVariations = 'select * from ecomplus_products_variations where parent_sku = ? and store_id = ?'
        await database.query(sqlVariations, [product.product_sku, storeId]).then(row => {
          if (row && row.length) {
            product.variations = row
          }
        })

        return product
      })
        .then(product => res.send(product))
    }

    // pesquisa por criterios ou retorna todos
    let sql = 'select * from ecomplus_products ' +
      'where product_store_id = ? '
    const values = [storeId]
    const { query } = req

    if (query.ecomplus_id) {
      sql += 'and product_id = ? '
      values.push(query.ecomplus_id)
    }

    if (query.bling_id) {
      sql += 'and product_bling_id = ? '
      values.push(query.bling_id)
    }

    if (query.sku) {
      sql += 'and product_sku = ? '
      values.push(query.sku)
    }

    if (query.title) {
      sql += 'and product_name = ? '
      values.push(query.title)
    }

    if (query.error) {
      sql += 'and error = ? '
      values.push(parseInt(query.error))
    }

    database.query(sql, values).then(row => {
      res.send(row)
    })
    .catch(err => {
      return res.status(500).send({
        status: 500,
        err,
        message: 'Erro inesperado, tente novamente mais tarde.'
      })
    })
  }
}