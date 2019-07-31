'use strict'
const Bling = require('bling-erp-sdk')
module.exports = () => {
  return (req, res) => {
    let blingAPiKey = req.get('X-Bling-Api-Key')
    if (!blingAPiKey) {
      return res.status(401).send({
        error: 'X-Bling-Api-Key not foud at headers'
      })
    }
    const blingSettings = {
      apiKey: blingAPiKey,
      lojaId: null
    }
    const bling = new Bling(blingSettings)

    bling.produtos.getAll()
      .then(result => {
        try {
          let list = JSON.parse(result)
          list = list.retorno
          let produtos = list.produtos || []
          return res.status(200).send(produtos)
        } catch (error) {
          res.status(400).send(error)
        }
      })
      .catch(e => {
        res.status(400).send(e)
      })
  }
}
