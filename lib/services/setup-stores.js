'use strict'
const logger = require('console-files')
/**
 * Verifica se a instalação do applicativo está completa a cada 3m
 * para registrar os triggers da applicação.
 */
module.exports = ({ db, ecomAuth }) => {
  const task = () => {
    // debug
    console.log('Verificando se existe store para ser configurada.')
    logger.log('Verificando se existe store para ser configurada.')

    let query = 'SELECT application_id, store_id, authentication_id FROM bling_app_settings WHERE setted_up = ?'
    let index = 0

    db.each(query, [0], (erro, rows) => {
      setTimeout(async () => {
        if (erro) {
          // faz alguma coisa..
          console.log('Erro setup_query', erro)
          logger.log('Erro setup_query', erro)
        } else {
          ecomAuth.then(async sdk => {
            sdk.getAuth(rows.store_id, rows.authentication_id)
              .then(async auth => {
                // procedure só é registrado
                // se já houver access_token configurado
                if (auth.row.access_token && auth.row.authentication_id) {
                  let params = {
                    title: 'Bling application setup',
                    triggers: [
                      {
                        resource: 'applications',
                        resource_id: auth.row.application_id
                      }
                    ],
                    webhooks: [
                      {
                        api: {
                          external_api: { // debug
                            uri: 'https://bling.ecomplus.biz/triggers/ecomplus'
                          }
                        },
                        method: 'POST',
                        send_body: true
                      }
                    ]
                  }
                  sdk.apiRequest(auth.row.store_id, '/procedures.json', 'POST', params, auth)
                    .then(() => {
                      let values = [
                        1,
                        auth.row.authentication_id,
                        rows.store_id,
                        auth.row.application_id
                      ]
                      let query = 'UPDATE bling_app_settings SET setted_up = ?, setted_at = CURRENT_TIMESTAMP WHERE authentication_id = ? AND store_id = ? AND application_id = ?'
                      db.run(query, values, erro => {
                        if (erro) {
                          // ... logger?
                        } else {
                          console.log('Application [%s] setted up.', auth.row.application_id)
                        }
                      })
                    })
                    .catch(e => {
                      console.log(e)
                      logger.log(e)
                    })
                }
              })
              .catch(e => {
                console.log(e)
                logger.log(e)
              })
          })
        }
      }, index * 1000)
    })
  }
  // run task with 1 min interval
  const interval = 60 * 60 * 1000
  setInterval(task, interval)
  task()
}
