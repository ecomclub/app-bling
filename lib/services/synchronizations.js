'use strict'
const logger = require('console-files')

module.exports = ({ db, ecomAuth, mysql, Bling }) => {
  const synchronization = async () => {
    console.log('Verificando se existe sincronização pendente para o bling.')
    let query = 'SELECT store_id, authentication_id, application_id FROM bling_app_settings WHERE setted_up = ? AND store_synchronized = ?'
    let index = 0
    const sdk = await ecomAuth.then()

    if (sdk) {
      db.each(query, [1, 0], (erro, rows) => {
        setTimeout(async () => {
          if (erro) {
            // faz alguma coisa..
            logger.error(erro)
          } else {
            const synchronizeProductsToBling = require('./../methods/synchronize-products-to-bling')({ ecomAuth, mysql, Bling })
            const synchronizeOrderToBling = require('./../methods/synchronize-orders-to-bling')({ ecomAuth, mysql, Bling })
            const storeSynchronized = require('./../methods/store-synchronized')({ ecomAuth, db })

            await synchronizeProductsToBling(rows.store_id)
              .then(synchronizeOrderToBling)
              .then(storeSynchronized)
              .catch(e => console.log('[SYNCRONIZE CHAIN]', e))
          }
        }, index * 1000)
      })
    } else {
      console.log('SDK Ecomplus não configurado')
      logger.log('SDK Ecomplus não configurado')
    }
  }
  // run synchronization with 1 min interval
  const interval = 2 * 60 * 1000
  setInterval(synchronization, interval)
  synchronization()
}
