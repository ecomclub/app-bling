'use strict'
const Bling = require('bling-erp-sdk')
const logger = require('console-files')

module.exports = (configObj, appSdk, storeId) => {
  const blingAPIKey = configObj.bling_api_key
  const blingLojaId = configObj.bling_loja_id || null

  if (!blingAPIKey) {
    throw new Error('Bling bling_api_key not found.')
  }

  const blingSettings = {
    apiKey: blingAPIKey,
    lojaId: blingLojaId
  }

  const bling = new Bling(blingSettings)

  return (body) => {
    const updateProductQuantity = () => {
      let trigger = body.retorno.estoques[0].estoque

      bling.produtos.getById(trigger.codigo)
        .then(result => {
          result = JSON.parse(result)
          let produto = result.retorno.produtos[0].produto
          return produto
        })
        .then(produto => {
          let resourceId
          if (!produto.hasOwnProperty('codigoPai')) {
            // produto
            console.log('Produto')
            resourceId = produto.codigo
          } else {
            console.log('Variação')
            // variação
            resourceId = produto.codigoPai
          }

          let resource = `/products.json?sku=${resourceId}`
          let method = 'GET'

          return appSdk.apiRequest(storeId, resource, method)
            .then(resp => {
              let { data } = resp.response
              if (data.result.length) {
                let product = data.result.find(product => product.sku === resourceId)
                let resource = `/products/${product._id}.json`
                let method = 'GET'

                return appSdk.apiRequest(storeId, resource, method)
                  .then(resp => {
                    let promise
                    let { data } = resp.response
                    if (!produto.hasOwnProperty('codigoPai')) {
                      // produto
                      if (data.quantity !== produto.estoqueAtual) {
                        console.log('quantidades diferentes')
                        let body = {
                          quantity: Math.sign(produto.estoqueAtual) === -1 ? 0 : produto.estoqueAtual
                        }
                        promise = appSdk.apiRequest(storeId, resource, 'PATCH', body)
                      }
                    } else {
                      console.log('Variação')
                      // variação
                      let variation = data.variations.find(variation => variation.sku === produto.codigo)
                      if (variation) {
                        // variação existe na ecomplus
                        if (variation.quantity !== produto.estoqueAtual) {
                          resource = `/products/${product._id}/variations/${variation._id}.json`
                          let body = {
                            quantity: Math.sign(produto.estoqueAtual) === -1 ? 0 : produto.estoqueAtual
                          }
                          promise = appSdk.apiRequest(storeId, resource, 'PATCH', body)
                        }
                      } else {
                        // variação nao existe
                        // inserir?
                        console.log('Variação nao existe na ecompls')
                        return bling.produtos.getById(resourceId)
                          .then(result => {
                            result = JSON.parse(result)
                            let produto = result.retorno.produtos[0].produto
                            return produto
                          })
                          .then(produto => {
                            let match = produto.variacoes.find(variacao => variacao.variacao.codigo === trigger.codigo)
                            if (match) {
                              console.log(produto)
                              let variacaoTipo = match.variacao.nome.split(':')[0]
                              let variacaoNome = match.variacao.nome.split(':')[1]
                              let body = {
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
                              console.log(body)
                              resource = `/products/${product._id}/variations.json`
                              return appSdk.apiRequest(storeId, resource, 'POST', body)
                            }
                          })
                      }
                    }
                    return promise.then(() => logger.log(`Estoque do produto ${resourceId} alterado de ${data.quantity} para ${produto.estoqueAtual}`))
                  })
              } else {
                console.log('Produto não encontrado na ecomplus API')
                const ecomplusProductSchema = require('./../schemas/ecomplus-products')
                return bling.produtos.getById(resourceId)
                  .then(result => {
                    result = JSON.parse(result)
                    let produto = result.retorno.produtos[0].produto
                    return produto
                  })
                  .then(produto => {
                    let body = ecomplusProductSchema(produto)
                    resource = `/products.json`
                    return appSdk.apiRequest(storeId, resource, 'POST', body)
                      .then(resp => {
                        console.log(resp.response.data._id)
                        if (!produto.hasOwnProperty('codigoPai') && produto.variacoes.length) {
                          resource = `/products/${resp.response.data._id}/variations.json`
                          let variations = []
                          produto.variacoes.forEach(variacao => {
                            let variacaoTipo = variacao.variacao.nome.split(':')[0]
                            let variacaoNome = variacao.variacao.nome.split(':')[1]
                            let body = {
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
                            //variations.push(body)
                            return appSdk.apiRequest(storeId, resource, 'POST', body)
                          })
                          console.log(variations)
                          //return appSdk.apiRequest(storeId, resource, 'POST', body)
                        }
                      })
                  })
              }
            })
        })
        .catch(e => {
          if (e.response && e.response.data) {
            logger.error('API_REQUEST_ERR', e.response.data)
          }
          logger.error(e)
        })
    }

    if ((configObj.hasOwnProperty('synchronize') && configObj.synchronize.hasOwnProperty('bling')) &&
      configObj.synchronize.bling.hasOwnProperty('products') && configObj.synchronize.bling.products === true) {
      updateProductQuantity()
    }
  }
}