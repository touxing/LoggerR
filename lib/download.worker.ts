import pako from 'pako'
self.onmessage = async event => {
  const { logs } = event.data
  try {
    const blob = new Blob([logs], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)

    // 返回下载链接到主线程
    self.postMessage({ url })
  } catch (error) {
    self.postMessage({ error: error })
  }
}
