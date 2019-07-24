'use strict'
// log on files
const logger = require('console-files')

module.exports = (appSdk, db) => {
  const task = () => {
    let query = 'SELECT store_id, authentication_id, application_id FROM bling_app_settings WHERE setted_up = ? ORDER BY created_at ASC LIMIT 1'
    db.get(query, [0], async (err, row) => {
      if (!err) {
        if (!row) {
          // no store to setup
          // schedule next table reading
          setTimeout(task, 5000)
        } else {
          let storeId = row.store_id
          let applicationId = row.application_id
          let erros
          try {
            const url = '/procedures.json'
            const method = 'POST'
            let procedure = {
              title: 'Bling Application Setup',
              triggers: [
                {
                  resource: 'applications',
                  resource_id: applicationId
                }
              ],
              webhooks: [
                {
                  api: {
                    external_api: {
                      uri: 'https://bling.ecomplus.biz/ecom/webhook'
                    }
                  },
                  method: 'POST',
                  send_body: true
                }
              ]
            }
            await appSdk.apiRequest(storeId, url, method, procedure)
          } catch (error) {
            erros = error
            logger.error('[REGISTER PROCEDURES]', erros)
          }
          // all async process done
          // schedule next store to setup
          setTimeout(task, 200)
          if (!erros) {
            // all done with success
            // remove from queue
            let query = 'UPDATE bling_app_settings SET setted_up = 1, setted_at = CURRENT_TIMESTAMP WHERE store_id = ?'
            db.run(query, [storeId], err => {
              if (err) {
                logger.error('[UPDATE STORE]', err)
                throw err
              }
            })
          }
        }
      } else {
        logger.error('--> Procedures setup:', err)
        throw err
      }
    })
  }
  // start task loop
  task()
}