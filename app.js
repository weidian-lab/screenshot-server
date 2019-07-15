const Koa = require('koa')
const { sleep } = require('pure-func/promise')

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
  await next()
  logger.info(`${ctx.method} ${ctx.url}[${ctx.state.pid}] - ${Date.now() - startedAt}`)
})

app.use(async (ctx, next) => {
  const { url } = ctx.request.query
  let gotoError
  if (!url) {
    ctx.throw(400, 'No url request parameter supplied.')
  }
  if (url.indexOf('file://') >= 0 && !allowFileScheme) {
    ctx.throw(403)
  }
  await next()
})

app.use(async (ctx, next) => {
  const { format = config.screen.defaultFormat } = ctx.request.query
  if (config.screen.supportedFormats.indexOf(format.toLowerCase()) === -1) {
    ctx.throw(400, `Format ${format} not supported.`)
  }
  ctx.type = ctx.state.format = format
  await next()
})

app.use(async (ctx, next) => {
  ctx.body = 'success'
  const { width, height } = ctx.request.query;
  const size = {
    width: Math.min(2048, parseInt(width, 10) || config.screen.width),
    height: Math.min(2048, parseInt(height, 10) || config.screen.height),
  };
  logger.debug(`Instantiating Page with size ${size.width}x${size.height}`);
  let pageError;
  await pool.use(inst => {
    const pid = inst.process().pid
    ctx.state.pid = pid
    logger.debug(`Using browser instance with PID ${pid}`)
    return inst.newPage().then(page => {
      logger.debug('Set page instance on state')
      ctx.state.page = page
    }).then(() => {
      logger.debug('Set viewport for page');
      return ctx.state.page.setViewport(size);
    }).catch(error => {
      pageError = error
      logger.debug(`Invalidating instance with PID ${pid}`);
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
  logger.debug(`Attempting to load ${url}`)
  try {
    await page.goto(url)
    await sleep(config.screen.screenshotDelay)
  } catch (err) {
    logger.error(err)
    ctx.throw(404)
  }
  await next()
})


app.use(async (ctx, next) => {
  const { url, fullPage } = ctx.request.query;
  const { format, page, browser } = ctx.state;
  const { width, height } = page.viewport();
  let renderError;
  logger.debug(`Rendering screenshot of ${url} to ${format}`);
  if (format === 'pdf') {
    await page.pdf({
      format: 'A4',
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
    })
    .then(response => (ctx.body = response))
    .catch(error => (renderError = error));
  } else {
    let clipInfo = fullPage ? {fullPage: true} : { clip: { x: 0, y: 0, width, height }} ;
    await page
      .screenshot(Object.assign({
        type: format === 'jpg' ? 'jpeg' : format,
        omitBackground: true,
      }, clipInfo))
      .then(response => (ctx.body = response))
      .catch(error => (renderError = error));
    }
    if (renderError) {
      ctx.throw(400, `Could not render page: ${renderError.message}`);
    }
    await page.close();
    await next();
});


app.on('error', (error, context) => {
  const { page } = context.state;
  if (page) {
    page.close();
  }
  logger.error(error.message);
});

app.listen(port)

logger.info('started ' + port)

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, exiting...');
  pool
    .drain()
    .then(() => pool.clear())
    .then(() => process.exit(143));
});
