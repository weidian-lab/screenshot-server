const {
  PORT = 3000,
  PUPPETEER_POOL_MIN = 2,
  PUPPETEER_POOL_MAX = 10,
  CHROME_BIN,
  CHROME_ARGS = '--no-sandbox',
  SCREEN_WIDTH = 750,
  SCREEN_HEIGHT = 768,
  DEFAULT_FORMAT = 'jpeg',
  WWW_PATH = ''
} = process.env

exports.server = {
  port: PORT
}

exports.wwwPath = WWW_PATH

exports.screen = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  defaultFormat: DEFAULT_FORMAT,
  supportedFormats: ['jpg', 'jpeg', 'pdf', 'png']
}

exports.puppeteer = {
  executablePath: CHROME_BIN,
  args: CHROME_ARGS.split(','),
  pool: {
    min: PUPPETEER_POOL_MIN,
    max: PUPPETEER_POOL_MAX
  }
}
