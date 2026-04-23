import { loadSettings, isWhitelisted, log } from './utils'
import { startDetector } from './layer2-detector'

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

  startDetector()
}

main().catch(console.error)
