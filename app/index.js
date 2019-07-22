const Koa = require('koa')
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
  const startedAt = Date.now()
  ctx.logger = new ContextLogger(ctx, logger)
  await next()
  ctx.logger.info(`${ctx.method} ${ctx.path} [${ctx.state.pid}] - ${Date.now() - startedAt}`)
})

app.use(bodyParser())

app.use(async (ctx, next) => {
  if (ctx.method === 'POST') {
    ctx.request.query = ctx.request.body
  }
  await next()
})

app.use(async (ctx, next) => {
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
  await pool.use(inst => {
    const { pid } = inst.process()
    ctx.state.pid = pid
    ctx.logger.debug(`Using browser instance with PID ${pid}`)
    return inst.newPage().then(page => {
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
  const { url } = ctx.request.query
  const { page } = ctx.state
  ctx.logger.debug(`Attempting to load ${url}`)
  try {
    await page.goto(url)
    await sleep(config.screen.screenshotDelay)
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
  await page.close()
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