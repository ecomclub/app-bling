
module.exports = ({ database, logger }) => {
  return async (req, res) => {
    const productId = req.params.id
    const storeId = req.storeId

    if (!productId) {
      res.status(400).send({
        status: 400,
        message: 'Id do produto não informado'
      })
    }

    const sql = 'select * from ecomplus_products WHERE id = ? AND product_store_id = ? limit 1'
    const values = [productId, storeId]
    await database.query(sql, values).then(async rows => {
      if (!rows || !rows.length) {
        res.status(404)
        return res.send({
          status: 404,
          message: 'Recurso não encontrado, verifique se o :id informado está correto.'
        })
      }

      const product = rows[0]

      const deleteQuery = 'delete from ecomplus_products where id = ? and product_store_id = ?'
      return database.query(deleteQuery, values).then(() => {
        // exclui variations?
        const delVariations = 'delete from ecomplus_products_variations where parent_sku = ? and store_id = ?'
        return database.query(delVariations, [product.product_sku, storeId])
      }).then(() => {
        return res.status(204).end()
      })
    })
      .catch(err => {
        logger.error('Erro ao excluir o produto', productId, err)
        return res.status(500).send({
          message: 'Erro inesperado, tente novamente mais tarde.',
          err
        })
      })
  }
}