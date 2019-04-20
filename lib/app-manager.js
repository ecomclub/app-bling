'use strict'
const logger = require('console-files')
const sqlite = require('sqlite3').verbose()
const Bling = require('bling-erp-sdk')
const db = new sqlite.Database(process.env.ECOM_AUTH_DB)
const { ecomAuth } = require('ecomplus-app-sdk')
const { blingOrderSchema, ecomplusOrderSchema } = require('./schemas/orders')
const { blingProductSchema } = require('./schemas/products')
const mysql = require('./database')

/**
 * Verifica se a instalação do applicativo está completa a cada 3m
 * para registrar os triggers da applicação.
 */
const setup = () => {
  console.log('Verificando se existe procedure para ser registrado.')

  let query = 'SELECT application_id, store_id, authentication_id FROM bling_app_settings WHERE setted_up = ?'
  let index = 0

  db.each(query, [0], (erro, rows) => {
    setTimeout(async () => {
      if (erro) {
        // faz alguma coisa..
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
                          uri: 'https://echo-requests.herokuapp.com/' //'https://bling.ecomplus.biz/notifications'
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
                  })
              }
            })
            .catch(e => console.log(e))
        })
      }
    }, index * 1000)
  })
}

//
setInterval(setup, 1 * 60 * 1000)
