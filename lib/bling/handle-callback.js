'use strict'

const logger = require('console-files')
const ecomClient = require('@ecomplus/client')

module.exports = (appSdk, storeId, bling, trigger) => {
  logger.log(`Estoque #${storeId} ${trigger.codigo}`)
  bling.produtos.getById(trigger.codigo)
    .then(data => {
      const result = JSON.parse(data)
      const { produtos } = result.retorno
      if (produtos && Array.isArray(produtos) && produtos[0] && produtos[0].produto) {
        return produtos[0].produto
      } else {
        // todo
      }
    })

    .then(produto => {
      let sku
      if (!produto.codigoPai) {
        // produto
        sku = produto.codigo
      } else {
        sku = produto.codigoPai
      }

      return ecomClient
        .store({
          url: `/products.json?sku=${sku}`,
          storeId
        })

        .then(({ data }) => {
          const { result } = data
          if (result.length) {
            const product = result.find(product => product.sku === sku)
            let url = `/products/${product._id}.json`

            return ecomClient
              .store({ url, storeId })
              .then(({ data }) => {
                let promise
                if (!produto.codigoPai) {
                  // produto
                  if (data.quantity !== produto.estoqueAtual) {
                    const body = {
                      quantity: Math.sign(produto.estoqueAtual) === -1 ? 0 : produto.estoqueAtual
                    }
                    promise = appSdk.apiRequest(storeId, url, 'PATCH', body)
                  }
                } else {
                  // variations
                  const variation = data.variations
                    .find(variation => variation.sku === produto.codigo)
                  if (variation) {
                    // variação existe na ecomplus
                    if (variation.quantity !== produto.estoqueAtual) {
                      url = `/products/${product._id}/variations/${variation._id}.json`
                      const body = {
                        quantity: Math.sign(produto.estoqueAtual) === -1 ? 0 : produto.estoqueAtual
                      }
                      promise = appSdk.apiRequest(storeId, url, 'PATCH', body)
                    }
                  } else {
                    // variação nao existe
                    // inserir?
                    return bling
                      .produtos
                      .getById(sku)

                      .then(resp => {
                        const result = JSON.parse(resp)
                        const { produtos } = result.retorno
                        if (
                          produtos &&
                          Array.isArray(produtos) &&
                          produtos[0] &&
                          produtos[0].produto
                        ) {
                          return produtos[0].produto
                        } else {
                          // todo
                        }
                      })

                      .then(produto => {
                        const match = produto.variacoes
                          .find(variacao => variacao.variacao.codigo === trigger.codigo)
                        if (match) {
                          const variacaoTipo = match.variacao.nome.split(':')[0]
                          const variacaoNome = match.variacao.nome.split(':')[1]
                          const body = {
                            name: produto.descricao + ' / ' + variacaoNome,
                            sku: trigger.codigo,
                            quantity: match.variacao.estoqueAtual
                          }
                          body.specifications = {}
                          body.specifications[variacaoTipo] = [
                            {
                              text: variacaoNome
                            }
                          ]

                          url = `/products/${product._id}/variations.json`
                          return appSdk.apiRequest(storeId, url, 'POST', body)
                        }
                      })
                  }
                }
                return promise.then(() => {
                  logger.log(`#${storeId} ${sku}: ${data.quantity} => ${produto.estoqueAtual}`)
                })
              })
          } else {
            const ecomplusProductSchema = require('./../../lib/schemas/ecomplus-products')
            return bling
              .produtos
              .getById(sku)

              .then(data => {
                const result = JSON.parse(data)
                const { produtos } = result.retorno
                if (produtos && Array.isArray(produtos) && produtos[0] && produtos[0].produto) {
                  return produtos[0].produto
                } else {
                  // todo
                }
              })

              .then(produto => {
                const body = ecomplusProductSchema(produto)
                let resource = '/products.json'
                return appSdk
                  .apiRequest(storeId, resource, 'POST', body)

                  .then(resp => {
                    if (!produto.codigoPai && produto.variacoes.length) {
                      resource = `/products/${resp.response.data._id}/variations.json`
                      produto.variacoes.forEach(variacao => {
                        const variacaoTipo = variacao.variacao.nome.split(':')[0]
                        const variacaoNome = variacao.variacao.nome.split(':')[1]
                        const body = {
                          name: produto.descricao + ' / ' + variacaoNome,
                          sku: variacao.variacao.codigo,
                          quantity: variacao.variacao.estoqueAtual
                        }
                        body.specifications = {}
                        body.specifications[variacaoTipo] = [
                          {
                            text: variacaoNome
                          }
                        ]
                        return appSdk.apiRequest(storeId, resource, 'POST', body)
                      })
                    }
                  })
              })
          }
        })
    })

    .catch(error => {
      const err = new Error(`Erro no callback de estoque para #${storeId}`)
      err.original = error.message
      if (error.response) {
        if (error.response.data) {
          err.data = JSON.stringify(error.response.data)
        }
        err.status = error.response.status
        err.config = error.config
      }
      logger.error(err)
    })
}
