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
          setTimeout(task, 1000)
        } else {
          let storeId = row.store_id
          let applicationId = row.application_id

          appSdk.getAuth(storeId)
            .then(async data => {
              if (data.row.access_token) {
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
                    .then((data) => {
                      logger.log(data)
                      // all done with success
                      // remove from queue
                      logger.log('--> Setup procedure APP #' + applicationId)
                      let query = 'UPDATE bling_app_settings SET setted_up = 1, setted_at = CURRENT_TIMESTAMP WHERE store_id = ?'
                      db.run(query, [storeId], err => {
                        if (err) {
                          logger.error('[UPDATE STORE]', err)
                          throw err
                        }
                      })
                    })
                    .catch(e => {
                      logger.error(e)
                    })
                } catch (error) {
                  logger.error('[REGISTER PROCEDURES]', error)
                }
                // all async process done
                // schedule next store to setup
                setTimeout(task, 1000)
              } else {
                setTimeout(task, 1000)
              }
            })
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
