const Koa = require('koa')
const Timing = require('supertiming')
const bodyParser = require('koa-bodyparser')
const { sleep } = require('pure-func/promise')

const ContextLogger = require('egg-logger/lib/egg/context_logger')
const createPuppeteerPool = require('./lib/puppeteer-pool')
const logger = require('./lib/logger')
const config = require('./lib/config')

const { server: { port } } = config

const app = new Koa()

const pool = createPuppeteerPool({
  ...config.puppeteer.pool,
  puppeteerArgs: {
    args: config.puppeteer.args,
    executablePath: config.puppeteer.executablePath
  }
})

app.use(async (ctx, next) => {
  ctx.timing = new Timing()
  ctx.timing.start('Total')
  ctx.logger = new ContextLogger(ctx, logger)
  await next()
  ctx.timing.end('*')
  ctx.set('Server-Timing', ctx.timing.toServerTiming())
  const { use } = ctx.timing.toJSON(true)[0]
  ctx.set('X-Response-Time', `${use}ms`)
  if (use < 200) { return }
  const log = `[${ctx.state.pid}] ${ctx.timing.toString()}`
  if (use > 8000) { ctx.logger.error(log) }
  if (use > 2000) { ctx.logger.warn(log) }
  if (use > 500) { ctx.logger.info(log) }
})

app.use(bodyParser())

app.use(async (ctx, next) => {
  if (ctx.method === 'POST') {
    ctx.request.query = ctx.request.body
  }
  await next()
})

app.use(async (ctx, next) => {
  ctx.timing.start('validate')
  const { url } = ctx.request.query
  if (!url) {
    ctx.throw(400, 'No url request parameter supplied.')
  }
  if (url.startsWith('file://')) {
    if (!config.wwwPath) {
      ctx.throw(403)
    }
    if (!url.startsWith(`file://${config.wwwPath}`)) {
      ctx.throw(403)
    }
  }
  await next()
})

app.use(async (ctx, next) => {
  const { format = config.screen.defaultFormat } = ctx.request.query
  if (config.screen.supportedFormats.indexOf(format.toLowerCase()) === -1) {
    ctx.throw(400, `Format ${format} not supported.`)
  }
  ctx.type = format
  ctx.state.format = format
  ctx.timing.end('validate')
  await next()
})

app.use(async (ctx, next) => {
  ctx.body = 'success'
  const { width, height } = ctx.request.query
  const size = {
    width: Math.min(2048, parseInt(width, 10) || config.screen.width),
    height: Math.min(2048, parseInt(height, 10) || config.screen.height)
  }
  ctx.logger.debug(`Instantiating Page with size ${size.width}x${size.height}`)
  let pageError
  ctx.timing.start('screenshot')
  await pool.use(inst => {
    const { pid } = inst.process()
    ctx.state.pid = pid
    ctx.logger.debug(`Using browser instance with PID ${pid}`)
    ctx.timing.start('newPage')
    return inst.newPage().then(page => {
      ctx.timing.end('newPage')
      ctx.logger.debug('Set page instance on state')
      ctx.state.page = page
    }).then(() => {
      ctx.logger.debug('Set viewport for page')
      return ctx.state.page.setViewport(size)
    }).catch(error => {
      pageError = error
      ctx.logger.debug(`Invalidating instance with PID ${pid}`)
      pool.invalidate(inst)
    })
  })
  if (pageError) {
    ctx.throw(404, `Could not open a page: ${pageError.message}`)
  }
  await next()
})

app.use(async (ctx, next) => {
  const { url, screenshotDelay } = ctx.request.query
  const { page } = ctx.state
  ctx.logger.debug(`Attempting to load ${url}`)
  try {
    ctx.timing.start('goto')
    await page.goto(url, { waitUntil: 'load' })
    if (screenshotDelay) {
      await sleep(parseInt(screenshotDelay, 10))
    }
    ctx.timing.end('goto')
  } catch (err) {
    ctx.logger.error(err)
    ctx.throw(404)
  }
  await next()
})


app.use(async (ctx, next) => {
  const { url, fullPage } = ctx.request.query
  const { format, page } = ctx.state
  const { width, height } = page.viewport()
  let renderError
  ctx.logger.debug(`Rendering screenshot of ${url} to ${format}`)
  ctx.timing.start('screenshotImg')
  if (format === 'pdf') {
    await page.pdf({
      format: 'A4',
      margin: {
        top: '1cm', right: '1cm', bottom: '1cm', left: '1cm'
      }
    })
      .then(response => { ctx.body = response })
      .catch(error => { renderError = error })
  } else {
    const clipInfo = fullPage ? { fullPage: true } : {
      clip: {
        x: 0, y: 0, width, height
      }
    }
    await page
      .screenshot(Object.assign({
        type: format === 'jpg' ? 'jpeg' : format,
        omitBackground: true
      }, clipInfo))
      .then(response => { ctx.body = response })
      .catch(error => { renderError = error })
  }
  if (renderError) {
    ctx.throw(400, `Could not render page: ${renderError.message}`)
  }
  ctx.timing.end('screenshotImg')
  page.close()
  await next()
})


app.on('error', (error, ctx) => {
  const { page } = ctx.state
  if (page) {
    page.close()
  }
  ctx.logger.error(error.message)
})

app.listen(port)

logger.info(`started ${port}`)

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, exiting...')
  pool
    .drain()
    .then(() => pool.clear())
    .then(() => process.exit(143))
})
