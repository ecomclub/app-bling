const js = require('jstoxml')

const jsToXML = data => {
  const xmlOptions = {
    attributesFilter: {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&apos;',
      '&': '&amp;'
    },
    filter: {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&apos;',
      '&': '&amp;'
    }
  }

  return js.toXML(data, xmlOptions)
}

module.exports = {
  jsToXML
}
