'use strict'
const logger = require('console-files')

module.exports = ({ db, ecomAuth }) => {
  return (request, response) => {
    const success = () => response.status(204).end()
    const fail = () => response.status(500).end()
    const storeId = parseInt(request.headers['x-store-id'], 10)
    ecomAuth.then(sdk => {
      sdk.handleCallback(storeId, request.body).then(async ({ isNew, authenticationId }) => {
        if (isNew) {
          // registra procedure para ouvir alterações no data/hidden_data do aplicativo
          const procedures = require('./../services/_procedures')({ ecomAuth })
          let proceduresBody = {
            title: 'Bling application setup',
            triggers: [
              {
                resource: 'applications',
                resource_id: request.body.application._id
              }
            ],
            webhooks: [
              {
                api: {
                  external_api: {
                    uri: 'https://bling.ecomplus.biz/triggers/ecomplus'
                  }
                },
                method: 'POST',
                send_body: true
              }
            ]
          }
          procedures(proceduresBody, storeId)
            .then(success)
            .catch(fail)
        }
        // ok
        success()
      })
        .catch(err => {
          if (typeof err.code === 'string' && !err.code.startsWith('SQLITE_CONSTRAINT')) {
            // debug SQLite errors
            logger.error(err)
          }
          response.status(500)
          return response.send({ erro: 'bling_callback_erro', message: err.message })
        })
    })
      .catch(e => {
        logger.error('Erro with ecomplus-app-sdk' + e)
        fail()
      })
  }
}
