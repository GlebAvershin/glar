import { readFileSync, createReadStream, existsSync } from "node:fs"
import solidPlugin from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "url"

const theme = fileURLToPath(new URL("./public/oc-theme-preload.js", import.meta.url))

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  if (process.env.OPENCODE_CHANNEL === "latest") return "prod"
  return "dev"
})()

/**
 * @type {import("vite").PluginOption}
 */
export default [
  {
    name: "opencode-desktop:config",
    config() {
      return {
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
          },
        },
        define: {
          "import.meta.env.VITE_OPENCODE_CHANNEL": JSON.stringify(channel),
        },
        worker: {
          format: "es",
        },
      }
    },
  },
  {
    // Tesseract.js OCR core'ы названы `*.wasm.js`. Vite dev-сервер отдаёт их с
    // Content-Type: text/html (из-за `.wasm` в имени попадают не в статику, а в
    // SPA-fallback). importScripts() в web-worker'е строго требует JS-MIME →
    // падает NetworkError, и весь локальный OCR сканов (ТЗ-04) не работает.
    // Отдаём эти файлы сами с text/javascript. Только dev — в prod статику
    // отдаёт electron, MIME по расширению корректен.
    name: "opencode-desktop:tesseract-wasm-js-mime",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0]
        if (/^\/tesseract\/.+\.wasm\.js$/.test(url)) {
          const filePath = fileURLToPath(new URL("./public" + url, import.meta.url))
          if (existsSync(filePath)) {
            res.setHeader("Content-Type", "text/javascript")
            createReadStream(filePath).pipe(res)
            return
          }
        }
        next()
      })
    },
  },
  {
    name: "opencode-desktop:theme-preload",
    transformIndexHtml(html) {
      return html.replace(
        '<script id="oc-theme-preload-script" src="/oc-theme-preload.js"></script>',
        `<script id="oc-theme-preload-script">${readFileSync(theme, "utf8")}</script>`,
      )
    },
  },
  tailwindcss(),
  solidPlugin(),
]
