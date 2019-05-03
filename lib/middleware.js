'use strict'
const { ecomServerIps } = require('ecomplus-app-sdk')
// verifica se a requisição tem x-store-id válido
// ou se vem de algum ip autorizado
module.exports = (request, response, next) => {
  let storeId = request.headers['x-store-id']
  if (typeof storeId === 'string') {
    storeId = parseInt(storeId, 10)
  }
  if (typeof storeId !== 'number' || isNaN(storeId) || storeId < 0) {
    // invalid ID string
    response.status(403)
    return response.send({ error: 'Undefined or invalid Store ID' })
  } else {
    if (request.method !== 'GET' && process.env.NODE_ENV === 'production') {
      // check if request comes from E-Com Plus servers
      if (ecomServerIps.indexOf(request.headers['x-real-ip']) === -1) {
        response.status(403)
        return response.send({ error: 'Who are you? Unauthorized IP address' })
      }
    }
  }
  next()
}
