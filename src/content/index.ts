import { loadSettings, isWhitelisted, log } from './utils'
import { injectLayer1Css } from './layer1-css'
import { startDetector } from './layer2-detector'

function isSmallIframe(): boolean {
  if (window.self === window.top) return false
  const MIN_SIZE = 500
  return window.innerWidth < MIN_SIZE || window.innerHeight < MIN_SIZE
}

const EXCLUDED_DOMAINS = [
  'checkout.stripe.com',
  'js.stripe.com',
  'hooks.stripe.com',
  'pay.google.com',
  'www.paypal.com',
  'www.sandbox.paypal.com',
  'secure.checkout.visa.com',
  'masterpass.com',
  'id.apple.com',
  'accounts.google.com',
  'login.microsoftonline.com',
  'auth0.com',
]

function isExcludedDomain(): boolean {
  const host = location.hostname
  return EXCLUDED_DOMAINS.some(d => host === d || host.endsWith('.' + d))
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

  if (isExcludedDomain()) {
    log('Excluded domain:', location.hostname)
    return
  }

  injectLayer1Css()
  startDetector()
}

main().catch(console.error)
