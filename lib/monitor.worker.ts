import pako from 'pako'
import { IndexedDBClient } from './dbClient'
import { dbConfig, logConfig } from './config'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
let deleting = false
const dbClient = IndexedDBClient.getInstance()

self.onmessage = event => {
  const { dbName, storeName, action = 'getSize' } = event.data

  switch (action) {
    case 'getSize': {
      monitorSize()
      break
    }
  }

  async function monitorSize() {
    while (true) {
      if (!deleting) {
        await getSize(event.data)
      }
      await sleep(logConfig.interval)
    }
  }
}
async function getSize(data: any) {
  let { dbName, storeName } = data
  dbClient
    .configure({
      dbName,
      storeName,
    })
    .open()
    .then(db => {
      const transaction = db.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      let totalSize = 0
      let count = 0

      // 游标遍历所有记录
      const cursorRequest = store.openCursor()
      cursorRequest.onsuccess = async event => {
        // @ts-ignore
        const cursor = event.target.result
        if (cursor) {
          // 计算每条记录的大小（压缩后的大小）
          // chrome -> Application -> Storage 可以查看大小
          const pakoSize = new Blob([pako.deflate(cursor.value)]).size

          totalSize += pakoSize // 累加到总大小
          count++
          cursor.continue() // 继续下一个游标
        } else {
          // 遍历完成后返回总大小（以 MB 为单位）
          const totalSizeInMB = (totalSize / (1024 * 1024)).toFixed(2) // 转为 MB

          self.postMessage({
            totalSizeInMB,
            count,
          })
          console.log(`logDB集合压缩后的大小: ${totalSizeInMB} MB, 记录条数: ${count}, `)
          if (count > logConfig.maxCount || Number(totalSizeInMB) > logConfig.maxSize) {
            deleting = true
            // const allLogs = await dbClient.findAll()
            // packetLog(allLogs)
            console.log('开始删除历史top 20%日志...')
            const deleteCount = Math.floor(Math.min(count * 0.2, logConfig.rollingDeleteCount))
            await deleteTopNLogs(deleteCount)
            console.log(`删除${deleteCount}条日志完成`)
            deleting = false
          }
        }
      }

      cursorRequest.onerror = () => {
        self.postMessage({ error: 'open cursor failed' })
      }
    })
}

async function deleteTopNLogs(n: number) {
  await dbClient.deleteTopNRecords(n)
}

async function packetLog(log: any[]) {
  // todo: 压缩日志, 分表存储
  dbClient.configure({
    dbName: dbConfig.dbName,
    storeName: dbConfig.storeName,
  })
  dbClient.create(pako.deflate(log.join('\n')))
}
