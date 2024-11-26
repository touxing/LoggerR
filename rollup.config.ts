import typescript from "rollup-plugin-typescript2"
import { RollupOptions } from "rollup"
import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import babel from "@rollup/plugin-babel"
import terser from "@rollup/plugin-terser"
import del from "rollup-plugin-delete"
import workerLoader from "rollup-plugin-web-worker-loader"
import { readFileSync } from "node:fs"
import { URL } from "node:url"

const pkgJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8")
)

const isProduction = process.env.BUILD === "production"

const config: RollupOptions = {
  input: "./lib/index.ts", // 输入文件
  output: [
    {
      // file: pkgJson.main, // 输出文件
      dir: "dist/umd",
      format: "umd", // 输出格式
      name: "Logger", // 在 UMD 中使用的全局变量名称
      sourcemap: true, // 生成 sourcemap
    },
    {
      dir: "dist/esm", // when building multiple chunks, the "output.dir" option must be used, not "output.file".
      format: "esm", //  [plugin off-main-thread] `output.format` must either be "amd" or "esm"
      sourcemap: true,
      entryFileNames: "[name].js",
    },
    {
      dir: "dist/amd",
      format: "amd",
      sourcemap: true,
      entryFileNames: "[name].js",
    },
  ],
  // external: Object.keys(pkgJson.dependencies), // 外部依赖
  watch: {
    include: "./lib/**",
  },
  plugins: [
    del({
      targets: ["dist/*"],
      runOnce: !isProduction,
    }),
    resolve({ browser: true }),
    commonjs(),
    workerLoader(),
    typescript({
      tsconfig: "./tsconfig.json",
    }),
    babel({
      exclude: "node_modules/**",
      presets: ["@babel/preset-env"],
      babelHelpers: "runtime",
    }),
    isProduction && terser(),
  ].filter(Boolean),
}

export default config
