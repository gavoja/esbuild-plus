import { context as esbuildContext } from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import watch from './watch.js'

const HOST = 'localhost'
const PORT = 3000
const BANNER = `
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
})()
`

let clients = []

function sendEvent (res, event, data) {
  if (event) {
    res.write(`event: ${event}\n`)
  }

  res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`)
}

function reloadClients () {
  clients.forEach(res => sendEvent(res, 'reload', {}))
}

function serverReloadPlugin () {
  return {
    name: 'server-reload-plugin',
    setup (buildHandler) {
      buildHandler.onEnd(() => {
        console.log('[ebp] Build completed.')
        reloadClients()
      })
    }
  }
}

function svgImportPlugin () {
  return {
    name: 'svg-plugin',
    setup (build) {
      build.onResolve({ filter: /\.svg/ }, args => ({
        path: path.join(args.resolveDir, args.path),
        namespace: 'svg'
      }))
      build.onLoad({ filter: /.*/, namespace: 'svg' }, async args => {
        const buf = await fs.readFile(args.path)
        return {
          contents: buf.toString('utf8'),
          loader: 'text'
        }
      })
    }
  }
}

async function main () {
  const isDev = process.argv.includes('--dev') || process.argv.includes('-d')

  // Resolve entry points.
  const entryPoints = Iterator.from(await fs.readdir('./src'))
    .filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.tsx'))
    .toArray()
  console.log('[ebp] Entry points:', entryPoints.join(', '))

  // Set up esbuild context.
  const ctx = await esbuildContext({
    entryPoints: entryPoints.map(f => `./src/${f}`),
    outdir: './target',
    plugins: [svgImportPlugin(), serverReloadPlugin()],
    format: 'esm',
    bundle: true,
    minify: !isDev,
    sourcemap: isDev ? 'inline' : false,
    banner: { js: BANNER }
  })

  // Clean up.
  await fs.rm('./target', { recursive: true, force: true })
  fs.cp('./static', './target', { recursive: true, force: true })
  console.log('[ebp] Static files copied.')

  if (!isDev) {
    await ctx.rebuild()
    await ctx.dispose()
    return
  }

  // Handle static file changes.
  watch('./static', () => {
    fs.cp('./static', './target', { recursive: true })
    console.log('[ebp] Static files copied.')
    reloadClients()
  })

  // Handle source file changes.
  await ctx.watch()

  // Start esbuild's static server (internal) on an ephemeral port
  const server = await ctx.serve({ servedir: './target', host: HOST, port: 0 })

  // Create a proxy server that exposes /events and forwards other requests to esbuild's server.
  const proxy = http.createServer((req, res) => {
    if (req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      })

      // send initial server-id and heartbeat
      sendEvent(res, 'init', String(Date.now()))

      clients.push(res)

      req.on('close', () => {
        clients = clients.filter(c => c !== res)
      })

      return
    }

    // Proxy other requests to the esbuild server
    const options = {
      hostname: HOST,
      port: server.port,
      path: req.url,
      method: req.method,
      headers: req.headers
    }

    const proxyReq = http.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
      proxyRes.pipe(res)
    })

    req.pipe(proxyReq)
    proxyReq.on('error', () => {
      res.statusCode = 502
      res.end('Bad Gateway')
    })
  })

  proxy.listen(PORT, HOST, () => {
    console.log(`[ebp] Serving target at http://${HOST}:${PORT}.`)
    console.log(`[ebp] Proxying to esbuild at http://${HOST}:${server.port}.`)
  })

  console.log('[ebp] Watching for changes...')
}

main()
