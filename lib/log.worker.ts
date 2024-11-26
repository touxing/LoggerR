// log.worker.ts
import pako from 'pako'
import { IndexedDBClient } from './dbClient'
import { logConfig } from './config'

self.onmessage = event => {
  const { dbName, storeName, action, log } = event.data
  switch (action) {
    case 'getLogs': {
      getLogs()
      break
    }
    case 'addLog': {
      addLog(log)
      break
    }
    default: {
      throw new Error(`Invalid action: ${action}`)
    }
  }

  async function addLog(log: string) {
    const dbClient = IndexedDBClient.getInstance()
    dbClient
      .configure({
        dbName,
        storeName,
      })
      .open()
      .then(db => {
        // 存储 log 之前先压缩 初步计算可以节省 6% 的存储空间
        // 增加了内存的使用，会导致浏览器内存占用增加，目前不需要节约，用空间换时间
        dbClient.create(log)
      })
      .catch(err => {
        console.error(err)
        if (/VersionError: .* is less than the existing version/.test(JSON.stringify(err))) {
          // 数据库版本过低，需要更新
          dbClient.deleteDatabase()
        }
      })
  }

  async function getLogs() {
    const dbClient = IndexedDBClient.getInstance()
    dbClient
      .configure({
        dbName,
        storeName,
      })
      .open()
      .then(db => {
        dbClient.findAll().then(data => {
          const deflator = new pako.Deflate()
          const chunkSize = logConfig.chunkSize
          const dataLength = data.length
          // FIXED: Big Array 调用 join 方法 报错 RangeError: Invalid string length at Array.join
          // 分片处理
          for (let i = 0; i < dataLength; i += chunkSize) {
            const end = Math.min(i + chunkSize, dataLength)
            const chunk = data.slice(i, end)
            deflator.push(chunk.join('\n'), end === dataLength)
          }

          self.postMessage({ logs: deflator.result })
        })
      })
  }
}
