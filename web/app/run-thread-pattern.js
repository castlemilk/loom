import { homeURL } from '../site'
import { readPattern, ring } from './thread-pattern'

// A fresh frame and worker for each run isolate edits from the page and each other.
export function runPattern(source, signal) {
  return runPlayground({ source, helper: ring.toString() }, signal).then(readPattern)
}

export function runPlayground(input, signal) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    const channel = new MessageChannel()
    frame.hidden = true
    frame.title = 'Pattern runner'
    frame.sandbox = 'allow-scripts'
    frame.src = homeURL + 'playground/runner.html'
    function dispose() {
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      channel.port1.close()
      channel.port2.close()
      frame.remove()
    }
    function abort() { dispose(); reject(new DOMException('Superseded edit', 'AbortError')) }
    const timeout = setTimeout(() => {
      dispose()
      reject(new Error('The runner could not load. Edit the pattern to retry.'))
    }, 10000)
    if (signal.aborted) return abort()
    signal.addEventListener('abort', abort, { once: true })
    channel.port1.onmessage = ({ data }) => {
      dispose()
      try {
        if (typeof data?.error === 'string') throw new Error(data.error)
        resolve(data?.value)
      } catch (error) { reject(error) }
    }
    frame.onload = () => frame.contentWindow?.postMessage(input, '*', [channel.port2])
    document.body.append(frame)
  })
}
