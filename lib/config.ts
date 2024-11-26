export const dbConfig = {
  dbName: 'logDB',
  storeName: 'logs',
  version: 1,
  objectStoreNumber: 10,
}

const maxLogCount = 30000
export const logConfig = {
  level: 'debug',
  format: '[{level}] {message}',
  datePattern: 'YYYY-MM-DD HH:mm:ss',
  filename: `log_FE_${new Date().toLocaleDateString().replace(/\//g, '-')}.log`,
  maxSize: 50, // unit: MB, 压缩后的日志数据大小不能超过 50MB
  maxCount: maxLogCount, // 30000 records
  rollingDeleteCount: maxLogCount * 0.2, // 20% of maxCount
  interval: 1000 * 60, // 1000 * 60 * 60 1 hour interval
  chunkSize: 1000, // 1000 records per chunk, 分片读取
}
