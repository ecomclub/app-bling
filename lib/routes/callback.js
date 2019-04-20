'use strict'
const callback = require('express').Router()
const { ecomAuth } = require('ecomplus-app-sdk')
const sqlite = require('sqlite3').verbose()
const db = new sqlite.Database(process.env.ECOM_AUTH_DB)
const logger = require('console-files')
/**
 * @description handle ecomplus callbacks
 */
callback.post('', (request, response) => {
  ecomAuth.then(sdk => {
    let storeId = parseInt(request.headers['x-store-id'], 10)
    sdk.handleCallback(storeId, request.body).then(async ({ isNew, authenticationId }) => {
      if (isNew) {
        try {
          let query = 'INSERT INTO bling_app_settings (store_id, authentication_id, application_id, setted_up) VALUES (?,?,?,?)'
          let values = [
            request.body.store_id,
            request.body.authentication._id,
            request.body.application._id,
            0
          ]
          db.run(query, values, erro => {
            if (erro) {
              logger.error(erro)
            }
          })
        } catch (error) {
          logger.error(error)
        }
      }
      response.status(204)
      return response.end()
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
      response.status(400)
      return response.end()
    })
})

module.exports = callback
