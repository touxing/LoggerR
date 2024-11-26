# LoggerR
A logger for Browser. It using indexedDB to store logs.


## Using

```sh
pnpm install @hotsuitor/logger
```


```sh
import {Logger} from 'logger'
```

## Methods

```ts
interface Logger {
    log(level: LogLevel, message: string): void {}
    debug(message: string) {}
    info(message: string) {}
    warn(message: string) {}
    error(message: string) {}
}
```

## example

```ts
import { Logger } from 'logger'

// 省略其他代码

// 记录错误信息，可以结合 window.addEventlistener('error', () => {})
Logger.error(
    JSON.stringify({
    message: err.message,
    stack: err.stack,
    })
)
```

## other

Press `F12` opening browser develop panel.
Switch to `Console`.
You will see the initialized info. such like:

`logDB集合压缩后的大小: 0.00 MB, 记录条数: 0, `

To switch `Application`, you will see the logDB collection of IndexDB.
logDB is the log store.
