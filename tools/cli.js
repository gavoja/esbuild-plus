#!/usr/bin/env node
/* global Iterator */
import { context as esbuildContext } from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'
import { CLIENT_SCRIPT, reloadClients, serve } from './server.js'
import watch from './watch.js'

const IS_DEV = process.argv.includes('--dev')
const FORMAT = process.argv.includes('--iife') ? 'iife' : 'esm'

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
  // Resolve entry points.
  const entryPoints = Iterator.from(await fs.readdir('./src'))
    .filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.tsx'))
    .toArray()
  console.log('[ebp] Entry point(s):', entryPoints.join(', '))

  // Set up esbuild context.
  const ctx = await esbuildContext({
    entryPoints: entryPoints.map(f => `./src/${f}`),
    outdir: './target',
    plugins: [svgImportPlugin(), serverReloadPlugin()],
    format: FORMAT,
    bundle: true,
    minify: !IS_DEV,
    sourcemap: IS_DEV ? 'inline' : false,
    banner: IS_DEV ? { js: CLIENT_SCRIPT } : undefined,
    define: { IS_DEV: JSON.stringify(IS_DEV) }
  })

  // Clean up.
  await fs.rm('./target', { recursive: true, force: true })
  fs.cp('./static', './target', { recursive: true, force: true }).then(() =>
    console.log('[ebp] Static files copied.')
  )

  // Production.
  if (!IS_DEV) {
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
  console.log('[ebp] Watching for changes...')

  serve()
}

main()
