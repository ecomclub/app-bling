'use strict'

// APP hostname and base URL path
const appBaseUri = process.env.APP_BASE_URI
// APP name to procedures titles
const appName = 'Bling ERP'

module.exports = [
  {
    'title': appName + ': order',
    'triggers': [
      {
        'resource': 'orders',
        'subresource': null
      },
      {
        'resource': 'orders',
        'subresource': 'items'
      }
    ],
    'webhooks': [
      {
        'api': {
          'external_api': {
            'uri': appBaseUri + '/order.json'
          }
        },
        'method': 'POST'
      }
    ]
  },
  {
    'title': appName + ': product',
    'triggers': [
      {
        'resource': 'products',
        'subresource': null
      },
      {
        'resource': 'products',
        'subresource': 'variations'
      }
    ],
    'webhooks': [
      {
        'api': {
          'external_api': {
            'uri': appBaseUri + '/product.json'
          }
        },
        'method': 'POST'
      }
    ]
  }
]
