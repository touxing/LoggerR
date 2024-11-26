import { dbConfig } from "./config"

export class IndexedDBClient {
  private declare dbName: string
  private declare storeName: string
  private version = dbConfig.version
  private db: IDBDatabase | null = null
  static instance: IndexedDBClient | null = null
  private constructor() {}

  public configure(options: { dbName: string; storeName: string }) {
    this.dbName = options.dbName
    this.storeName = options.storeName
    return IndexedDBClient.getInstance()
  }

  get config() {
    return { dbName: this.dbName, storeName: this.storeName }
  }

  public static getInstance(): IndexedDBClient {
    if (!IndexedDBClient.instance) {
      IndexedDBClient.instance = new IndexedDBClient()
    }
    return IndexedDBClient.instance
  }

  // 创建不同的客户端实例
  public static createInstance(options: {
    dbName: string
    storeName: string
  }): IndexedDBClient {
    const instance = new IndexedDBClient()
    instance.configure(options)
    return instance
  }

  public async open(): Promise<IDBDatabase> {
    if (!this.dbName || !this.storeName) {
      throw new Error("configuring database first")
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = request.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { autoIncrement: true })
        }
      }
      request.onerror = (event) => {
        reject(
          `open database failed: ${(event.target as IDBOpenDBRequest).error}`
        )
      }
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }
    })
  }

  public async deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName)

      request.onsuccess = () => {
        console.log(`数据库 ${this.dbName} 已删除`)
        resolve()
      }

      request.onerror = (event) => {
        // @ts-ignore
        reject(`删除数据库失败: ${event.target.error}`)
      }
    })
  }

  public async clearStore(): Promise<void> {
    return this.executeTransaction("readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = resolve
        request.onerror = (event) =>
          reject(`clear store failed: ${(event.target as IDBRequest).error}`)
      })
    })
  }

  // 插入记录
  public async create(data: any): Promise<void> {
    return this.executeTransaction("readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.add(data)
        request.onsuccess = resolve
        request.onerror = (event) =>
          reject(`insert failed: ${(event.target as IDBRequest).error}`)
      })
    })
  }

  // 根据 ID 查找记录
  public async find(id: number): Promise<any> {
    return this.executeTransaction("readonly", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(id)
        // @ts-ignore
        request.onsuccess = (event) => resolve(event.target.result)
        request.onerror = (event) =>
          reject(`find failed: ${(event.target as IDBRequest).error}`)
      })
    })
  }

  // 更新或插入记录
  public async update(data: { id: number; [key: string]: any }): Promise<void> {
    return this.executeTransaction("readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(data)
        request.onsuccess = resolve
        request.onerror = (event) =>
          reject(`update failed: ${(event.target as IDBRequest).error}`)
      })
    })
  }

  // 根据 ID 删除记录
  public async remove(id: number): Promise<void> {
    return this.executeTransaction("readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.delete(id)
        request.onsuccess = resolve
        request.onerror = (event) =>
          reject(`delete failed: ${(event.target as IDBRequest).error}`)
      })
    })
  }

  public async deleteTopNRecords(n: number): Promise<void> {
    return this.executeTransaction("readwrite", (store) => {
      const allRecords = store.getAllKeys()
      return new Promise((resolve, reject) => {
        allRecords.onsuccess = async (event) => {
          // @ts-ignore
          const keys = event.target.result as number[]
          const keysToDelete = keys.slice(0, n)
          const deletePromises = keysToDelete.map((key) => {
            return new Promise((delResolve, delReject) => {
              const delRequest = store.delete(key)
              delRequest.onsuccess = delResolve
              delRequest.onerror = (event) =>
                delReject(
                  `Delete failed: ${(event.target as IDBRequest).error}`
                )
            })
          })
          try {
            await Promise.all(deletePromises) // 等待所有删除操作完成
            resolve(true)
          } catch (error) {
            reject(error)
          }
        }
        allRecords.onerror = (event) => {
          reject(
            `Fetch all records failed: ${(event.target as IDBRequest).error}`
          )
        }
      })
    })
  }

  // 获取所有记录
  public async findAll<T = any>(): Promise<T[]> {
    return this.executeTransaction("readonly", (store) => {
      const result: any[] = []
      return new Promise((resolve, reject) => {
        const request = store.getAll()
        // @ts-ignore
        request.onsuccess = (event) => resolve(event.target.result as T[])
        request.onerror = (event) =>
          reject(`Find all failed: ${(event.target as IDBRequest).error}`)
      })
    })
  }

  // 获取所有记录（分片读取，带callback）
  public async findAllInChunks<T = any>(
    chunkSize: number,
    callback: (chunk: T[]) => void
  ): Promise<boolean> {
    const allRecords: T[] = []

    // 内部函数，用于异步读取一批记录
    const fetchChunk = async (offset: number): Promise<boolean> => {
      return this.executeTransaction("readonly", (store) => {
        return new Promise((resolve, reject) => {
          const cursorRequest = store.openCursor() // 打开游标
          let count = 0 // 记录当前批次计数

          cursorRequest.onsuccess = (event) => {
            // @ts-ignore
            const cursor = event.target.result
            if (cursor) {
              allRecords.push(cursor.value) // 将当前记录添加到数组中
              count++

              // 如果当前批次记录数达到chunkSize，就调用callback并结束当前批次
              if (count === chunkSize) {
                callback(allRecords.slice(-chunkSize)) // 传递当前批次数据
                resolve(false) // 继续处理下一批
                return
              }

              cursor.continue() // 继续游标，读取下一个记录
            } else {
              // 游标已到达末尾，处理剩余记录
              if (allRecords.length > 0) {
                callback(allRecords.slice(-count)) // 传递最后一批数据
              }
              resolve(true) // 结束读取
            }
          }

          cursorRequest.onerror = (event) =>
            reject(
              `Find all chunk failed: ${(event.target as IDBRequest).error}`
            )
        })
      })
    }

    // 从第一条记录开始读取
    let hasMoreChunks = false
    do {
      hasMoreChunks = await fetchChunk(0) // 每次调用fetchChunk
    } while (!hasMoreChunks)

    return true // 完成所有读取
  }

  // 统一的事务执行方法
  private executeTransaction(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => Promise<any>
  ): Promise<any> {
    if (!this.db) {
      throw new Error("database is not opened")
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, mode)
      const store = transaction.objectStore(this.storeName)
      callback(store).then(resolve).catch(reject)
    })
  }
}
