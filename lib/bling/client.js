const axios = require('axios')
const qs = require('querystring')
const { jsToXML } = require('./js-to-xml')

const instance = axios.create({
  baseURL: 'https://bling.com.br/Api/v2/',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
})

const client = ({ url, method, apiKey, data }) => {
  const options = {}
  let uri = url
  if (method.toLowerCase() === 'post' || method.toLowerCase() === 'put') {
    options.data = qs.stringify({
      'apikey': apiKey,
      'xml': jsToXML(data)
    })

    uri += '/json/'
  }

  if (method.toLowerCase() === 'get') {
    uri += '/json?apikey=' + apiKey
  }

  if (method.toLowerCase() === 'get' && url.startsWith('produto')) {
    uri = url + '/json/?estoque=S&imagem=S&apikey=' + apiKey
  }

  return instance({
    url: uri,
    method,
    ...options
  })
}


module.exports = client