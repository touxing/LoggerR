import { ILogger, LogLevel } from "./ILogger"
import { IndexedDBClient } from "./dbClient"
import { dbConfig } from "./config"
import LogWebWorker from "web-worker:./log.worker.ts"

interface IDatabase {
  addLog(log: string): Promise<void>
}

class LogWorker {
  private static instance: Worker | null = null
  private constructor() {}
  public static getInstance(): Worker {
    if (!LogWorker.instance) {
      /* LogWorker.instance = new Worker(new URL('./log.worker.ts', import.meta.url).href, {
        type: 'module',
      }) */
      LogWorker.instance = new LogWebWorker()
    }
    return LogWorker.instance
  }
}
export class IndexedDB {
  private declare db: IndexedDBClient
  static instance: IndexedDB
  private declare logWorker: Worker
  private constructor() {}
  public init(options?: Record<string, any>) {
    options = { ...dbConfig, ...options }
    this.db = IndexedDBClient.getInstance().configure({
      dbName: options.dbName,
      storeName: options.storeName,
    })
    this.logWorker = LogWorker.getInstance()
    return IndexedDB.getInstance()
  }
  public static getInstance(): IndexedDB {
    if (!IndexedDB.instance) {
      IndexedDB.instance = new IndexedDB()
    }
    return IndexedDB.instance
  }
  async addLog(log: string): Promise<void> {
    try {
      // log 对象 如果有不可序列化的数据，eg: 函数，会报错
      this.logWorker.postMessage({ action: "addLog", log, ...dbConfig })
    } catch (error) {
      console.log(`🚀 ~ IndexedDB ~ addLog ~ error:`, error)
    }
  }
}
export class DBLogger implements ILogger {
  private db: IDatabase
  static instance: DBLogger | null = null
  private indexDB: IndexedDBClient
  private logWorker: Worker
  private constructor(options?: Record<string, any>) {
    this.db = IndexedDB.getInstance().init(options)
    this.indexDB = IndexedDBClient.getInstance()
    this.logWorker = LogWorker.getInstance()
  }
  public static getInstance() {
    if (!DBLogger.instance) {
      DBLogger.instance = new DBLogger()
    }
    return DBLogger.instance
  }
  public log(logLevel: LogLevel, message: string): void {
    this.db.addLog(message)
  }
  public async getAllLogs(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.logWorker.onmessage = (event) => {
        const { logs, error } = event.data
        if (error) {
          console.error(error)
          return
        }
        resolve(logs)
      }
      this.logWorker.onerror = (error) => {
        reject(error)
      }
      this.logWorker.postMessage({ action: "getLogs", ...dbConfig })
    })
  }

  public async deleteTopNRecords(n: number) {
    await this.indexDB.open()
    return await this.indexDB.deleteTopNRecords(n)
  }
}
