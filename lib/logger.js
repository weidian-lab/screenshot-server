const Logger = require('egg-logger').Logger;
const FileTransport = require('egg-logger').FileTransport;
const ConsoleTransport = require('egg-logger').ConsoleTransport;

const logger = new Logger();

if (process.env.NODE_ENV === 'production') {
  logger.set('file', new FileTransport({
    file: '/usr/local/app/logs/app.log',
    level: 'INFO',
  }));
}

logger.set('console', new ConsoleTransport({
  level: process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG',
}));

module.exports = logger
