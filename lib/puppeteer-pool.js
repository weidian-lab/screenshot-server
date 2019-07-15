const puppeteer = require('puppeteer-core')
const genericPool = require('generic-pool')
const debug = require('debug')('puppeteer-pool')
const { EventEmitter } = require('events')

EventEmitter.defaultMaxListeners = 30

const initPuppeteerPool = ({
  max = 10, // 最多产生多少个 puppeteer 实例
  min = 2, // 保证池中最少有多少个实例存活
  idleTimeoutMillis = 30000, // 如果一个实例 60分钟 都没访问就关掉他
  maxUses = 100, // 每一个 实例 最大可重用次数，超过后将重启实例
  testOnBorrow = true, // 在将 实例 提供给用户之前，池应该验证这些实例。
  autostart =  false, // 是不是需要在 池 初始化时 初始化 实例
  evictionRunIntervalMillis = 180000, // 每 3分钟 检查一次 实例的访问状态
  puppeteerArgs = {},
  validator = () => Promise.resolve(true),
  ...otherConfig
}) => {
  debug('puppeteerArgs', puppeteerArgs)
  const factory = {
    create: () => puppeteer.launch(puppeteerArgs).then(instance => {
      instance.useCount = 0
      return instance
    }),
    destroy: (instance) => {
      instance.close()
    },
    validate: (instance) => {
      return validator(instance)
        .then(valid => Promise.resolve(valid && (maxUses <= 0 || instance.useCount < maxUses)))
    },
  }
  const config = {
    max,
    min,
    testOnBorrow,
    autostart,
    idleTimeoutMillis,
    evictionRunIntervalMillis,
    ...otherConfig,
  }
  const pool = genericPool.createPool(factory, config)
  const genericAcquire = pool.acquire.bind(pool)
  pool.acquire = () => genericAcquire().then(instance => {
    instance.useCount += 1
    return instance
  })
  pool.use = (fn) => {
    let resource
    return pool.acquire()
      .then(r => {
        resource = r
        return resource
      })
      .then(fn)
      .then((result) => {
        pool.release(resource)
        return result
      }, (err) => {
        pool.release(resource)
        throw err
      })
  }

  return pool
}

module.exports = initPuppeteerPool
