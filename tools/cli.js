#!/usr/bin/env node
/* global Iterator */
import { context as esbuildContext } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import watch from './watch.js'
import { CLIENT_SCRIPT, reloadClients, serve } from './server.js'

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
      build.onLoad({ filter: /.*/, namespace: 'svg' }, args => {
        const buf = fs.readFileSync(args.path)
        return {
          contents: buf.toString('utf8'),
          loader: 'text'
        }
      })
    }
  }
}

function copyStatic () {
  fs.rmSync('./target', { recursive: true, force: true })
  fs.cpSync('./static', './target', { recursive: true, force: true })
  console.log('[ebp] Static files copied.')
}

async function main () {
  // Resolve entry points.
  const entryPoints = Iterator.from(fs.readdirSync('./src'))
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
  copyStatic()

  // Production.
  if (!IS_DEV) {
    await ctx.rebuild()
    await ctx.dispose()
    return
  }

  // Handle static file changes.
  watch('./static', () => {
    copyStatic()
    reloadClients()
  })

  // Handle source file changes.
  await ctx.watch()
  console.log('[ebp] Watching for changes...')

  serve()
}

main()
