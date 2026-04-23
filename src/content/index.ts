import { loadSettings, isWhitelisted, log } from './utils'
import { injectLayer1Css } from './layer1-css'
import { startDetector } from './layer2-detector'

function isSmallIframe(): boolean {
  if (window.self === window.top) return false
  const MIN_SIZE = 500
  return window.innerWidth < MIN_SIZE || window.innerHeight < MIN_SIZE
}

async function main() {
  const settings = await loadSettings()

  if (!settings.enabled) {
    log('Extension is disabled')
    return
  }

  if (isWhitelisted()) {
    log('Site is whitelisted:', location.hostname)
    return
  }

  if (isSmallIframe()) return

  injectLayer1Css()
  startDetector()
}

main().catch(console.error)
