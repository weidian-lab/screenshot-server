const {
  PORT = 3000,
  PUPPETEER_POOL_MIN = 2,
  PUPPETEER_POOL_MAX = 10,
  CHROME_BIN,
  CHROME_ARGS = '--no-sandbox',
  SCREENSHOT_DELAY = 50
  SCREEN_WIDTH = 1024,
  SCREEN_HEIGHT = 768,
  DEFAULT_FORMAT = 'jpeg',
} = process.env

exports.server = {
  port: PORT
}

exports.screen = {
  screenshotDelay: SCREENSHOT_DELAY,
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  defaultFormat: 'jpeg',
  supportedFormats: ['jpg', 'jpeg', 'pdf', 'png']
}

exports.puppeteer = {
  executablePath: CHROME_BIN,
  args: CHROME_ARGS.split(','),
  pool: {
    min: PUPPETEER_POOL_MIN,
    max: PUPPETEER_POOL_MAX,
  }
}
