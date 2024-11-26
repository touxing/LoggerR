import { dbConfig, logConfig } from "./config"
import { DBLogger } from "./DBLogger"
import { ILogger, LogLevel, LogoLevelStringMap } from "./ILogger"
import MonitorWorker from "web-worker:./monitor.worker.ts"
import DownloadWorker from "web-worker:./download.worker.ts"

export enum LoggerType {
  DB = "db",
  // File = 'file',
  // Console = 'console',
}

type ILoggerTool = DBLogger
class Logger implements ILogger {
  private readonly _logger: ILogger
  private static instance: Logger | null = null
  private monitorWorker: Worker
  private downloadWorker: Worker
  private tool: ILoggerTool
  private constructor(_logger: ILogger) {
    this._logger = _logger
    this.tool = DBLogger.getInstance()
    // OPTION: rollup 打包 worker 路径需要 plugin 处理，
    // 这里使用import导入，避免打包时丢失 worker 文件
    /* this.monitorWorker = new Worker(
      new URL("./monitor.worker.ts", import.meta.url).href,
      {
        type: "module",
      }
    ) */
    /*   this.downloadWorker = new Worker(
      new URL("./download.worker.ts", import.meta.url).href,
      {
        type: "module",
      }
    ) */
    this.monitorWorker = new MonitorWorker()
    this.downloadWorker = new DownloadWorker()
    this.getLogSize()
  }

  public static getInstance() {
    if (!Logger.instance) {
      Logger.instance = new Logger(DBLogger.getInstance())
    }
    return Logger.instance
  }

  format(level: LogLevel, message: string): string {
    return `[${new Date().toLocaleString().replace(/\//g, "-")}] ${
      LogoLevelStringMap[level]
    }: ${message
      .toString()
      .replace(/(?<=data:image\/\w+;base64,)(.*?)(?=")/, "<no record>")}`
      .replace(/\n/g, " ")
      .trim()
  }

  log(level: LogLevel, message: string): void {
    this._logger.log(level, this.format(level, message))
  }
  debug(message: string) {
    this._logger.log(LogLevel.Debug, this.format(LogLevel.Debug, message))
  }
  info(message: string) {
    this._logger.log(
      LogLevel.Information,
      this.format(LogLevel.Information, message)
    )
  }
  warn(message: string) {
    this._logger.log(LogLevel.Warning, this.format(LogLevel.Warning, message))
  }
  error(message: string) {
    this._logger.log(LogLevel.Error, this.format(LogLevel.Error, message))
  }
  writeFormat(message: string) {
    return message.replace(/\\+"/g, "") + "\n"
  }

  async getLogSize() {
    this.monitorWorker.onmessage = (event) => {
      const { totalSizeInMB, count, totalCompressedSizeInMB, error } =
        event.data
      if (error) {
        console.error(error)
        this.error(error)
      }
    }
    // 发送数据库名和集合名到 Worker
    this.monitorWorker.postMessage({ ...dbConfig })
  }

  async deleteTopNLogs(n: number) {
    this.tool.deleteTopNRecords(n)
  }

  async download() {
    let allLog: any[] | undefined
    try {
      console.log(
        "%c打包日志中，请稍候...",
        "background: lightblue; color: black; font-size: 16px; padding: 4px; border-radius: 3px;"
      )
      allLog = await this.tool.getAllLogs()
    } catch (error) {
      console.error(error)
    }
    return new Promise<void>((resolve, reject) => {
      this.downloadWorker.onmessage = (event) => {
        const { url, error } = event.data
        if (error) {
          console.error(error)
          return
        }
        const a = document.createElement("a")
        a.download = logConfig.filename
        a.href = url
        // a.click() 直接用click下载会内存加载大量数据，导致浏览器卡死奔溃
        window.open(a.href, "_blank")
        URL.revokeObjectURL(url)
        console.log(
          "%c打包日志完成，如未弹出下载窗口，请检查弹出窗口是否被浏览器拦截",
          "background: yellow; color: black; font-size: 16px; padding: 4px;"
        )
        resolve()
      }
      this.downloadWorker.onerror = reject
      this.downloadWorker.postMessage({ logs: allLog })
    })
  }
}

export default Logger.getInstance()
