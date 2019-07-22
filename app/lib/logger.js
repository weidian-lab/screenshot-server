const { Logger } = require('egg-logger')
const { FileTransport } = require('egg-logger')
const { ConsoleTransport } = require('egg-logger')

const logger = new Logger()

if (process.env.NODE_ENV === 'production') {
  logger.set('file', new FileTransport({
    file: '/usr/local/app/logs/app.log',
    level: 'INFO'
  }))
}

logger.set('console', new ConsoleTransport({
  level: process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG'
}))

module.exports = logger
