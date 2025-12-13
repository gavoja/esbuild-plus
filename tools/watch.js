import { watch as nodeWatch } from 'node:fs'
import path from 'node:path'

const DEBOUNCE = 100

let previousDir = ''

export default function watch (pathToWatch, callback) {
  const payload = new Set()
  let timeout

  nodeWatch(pathToWatch, { recursive: true }, (eventType, filename) => {
    // Deduplicate parent folder changes.
    if (!filename || (previousDir === filename && eventType === 'change')) {
      return
    }

    previousDir = path.dirname(filename)
    payload.add(path.resolve(pathToWatch, filename))

    // Handle bulk changes in batches.
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      const batch = [...payload].toSorted() // Ensure consistent order for stability.
      callback(batch)
      payload.clear()
    }, DEBOUNCE)
  })
}
