module.exports = ({ appSdk, logger }) => {
  return (req, res) => {
    const storeId = parseInt(req.get('x-store-id'), 10)
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let secret = ''
    for (let i = 0; i < 32; i++) {
      secret += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    appSdk.getAuth(storeId).then((auth) => {
      console.log(auth.row.application_id)
      // save in application.hidden_data
      const url = `/applications/${auth.row.application_id}/hidden_data.json`
      return appSdk.apiRequest(storeId, url, 'patch', {
        store_secret: secret
      })
    }).then(() => {
      logger.log('Secret gerado com sucesso #,', secret, storeId)
      return res.send({ secret })
    })
      .catch(err => {
        console.log(err)
        res.status(500)
        return res.send({
          err,
          message: 'Generate secret failed'
        })
      })
  }
}