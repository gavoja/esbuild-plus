import 'dotenv/config'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

const ROOT = './target'
const HOSTNAME = 'localhost'
const PORT = 3000
const ORIGIN = `http://${HOSTNAME}:${PORT}`
const DEFAULT_MIME_TYPE = 'application/octet-stream'

const MIME_TYPES = {
  '.css': 'text/css',
  '.eot': 'application/vnd.ms-fontobject',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.otf': 'application/font-otf',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'application/font-ttf',
  '.txt': 'text/plain',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'application/font-woff',
  '.woff2': 'application/font-woff2',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}

export const CLIENT_SCRIPT = `
(() => {
  let error = false

  const es = new EventSource('/events')

  es.addEventListener('init', () => {})
  es.addEventListener('reload', () => location.reload())

  es.onopen = () => {
    console.log('[ebp] Connected to server.')
    if (error) {
      console.log('[ebp] Reconnected to server, reloading...')
      location.reload()
      error = false
    }
  }

  es.onerror = () => {
    console.error('[ebp] Connection error, attempting to reconnect...')
    error = true
  }
})();
`

const clients = new Set()

const server = http.createServer(async (req, res) => {
  try {
    // Live reload event stream endpoint.
    if (req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      })

      sendEvent(res, 'init', String(Date.now()))
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }

    const reqUrl = new URL(decodeURIComponent(req.url), ORIGIN)

    let filePath = `${ROOT}${reqUrl.pathname}`
    if (filePath === '/' || filePath.endsWith('/')) {
      filePath = filePath.replace(/\/$/, '') + '/index.html'
    }

    // Verify file exists.
    const stat = await fs.stat(filePath).catch(() => null)
    if (!stat || !stat.isFile()) {
      res.statusCode = 404
      res.end('Not found')
      return
    }

    // Stream file.
    const mimeType = MIME_TYPES[path.extname(filePath)] || DEFAULT_MIME_TYPE
    res.writeHead(200, { 'Content-Type': mimeType })
    const stream = createReadStream(filePath)
    stream.pipe(res)
    stream.on('error', () => res.end())
  } catch (err) {
    console.error(err)
    res.statusCode = 500
    res.end('Server error')
  }
})

function sendEvent (res, event, data) {
  event && res.write(`event: ${event}\n`)
  res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`)
}

export function reloadClients () {
  for (const res of clients) {
    sendEvent(res, 'reload', {})
  }
}

export function serve () {
  server.listen(PORT)
  if (server.listening) {
    console.log(`[ebp] Listening at ${ORIGIN}.`)
  } else {
    console.log('[ebp] Unable to start server. Is the port 3000 available?')
  }
}
