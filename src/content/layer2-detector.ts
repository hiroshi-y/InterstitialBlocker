import { getScoreThreshold, getClickVerificationDelay, log, logDetection, recordResolution } from './utils'
import { findCloseButton, forceClick } from './close-button'
import { trackInterstitial } from './layer4-tracker'
import { forceRemove } from './layer3-remover'

const processedElements = new WeakSet<Element>()
const pendingTargets = new Set<Element>()
let scheduleCheckTimeout: number | null = null

let lastUserClickAt = 0
let lastClickedElement: EventTarget | null = null
let lastUrl = location.href

function trackUserClicks(): void {
  document.addEventListener('click', (e) => {
    lastUserClickAt = Date.now()
    lastClickedElement = e.target
  }, { capture: true, passive: true })
}

function resetClickOnNavigation(): void {
  const check = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      lastUserClickAt = 0
      lastClickedElement = null
      log('URL changed, reset click tracking')
    }
  }
  window.addEventListener('popstate', check)
  window.addEventListener('hashchange', check)

  const origPushState = history.pushState.bind(history)
  history.pushState = (...args) => {
    origPushState(...args)
    check()
  }
  const origReplaceState = history.replaceState.bind(history)
  history.replaceState = (...args) => {
    origReplaceState(...args)
    check()
  }
}

function wasRecentlyTriggeredByUser(el: Element): boolean {
  if (Date.now() - lastUserClickAt > 2000) return false

  if (!lastClickedElement || !(lastClickedElement instanceof Element)) return false

  // If the clicked element is inside or is a parent of the detected element,
  // it's likely a user-triggered modal (e.g. lightbox)
  if (el.contains(lastClickedElement) || lastClickedElement.closest?.('[data-lightbox]')) {
    return true
  }

  // If the click was on a navigation link, don't skip
  const clickedEl = lastClickedElement as HTMLElement
  const isNavClick =
    clickedEl.tagName === 'A' ||
    clickedEl.closest?.('a') !== null ||
    clickedEl.closest?.('nav') !== null
  if (isNavClick) return false

  // For other clicks, check if the new element appeared near the click target
  if (lastClickedElement.contains(el) || el.contains(lastClickedElement)) {
    return true
  }

  return false
}

export function scoreAsInterstitial(el: Element): number {
  if (!(el instanceof HTMLElement)) return 0
  if (!el.isConnected) return 0

  const tag = el.tagName
  if (tag === 'BODY' || tag === 'HTML') return 0
  if (tag === 'MAIN' || tag === 'HEADER' || tag === 'FOOTER' || tag === 'NAV') return 0
  if (tag === 'UL' || tag === 'OL' || tag === 'LI' || tag === 'TABLE' ||
      tag === 'P' || tag === 'H1' || tag === 'H2' || tag === 'H3' ||
      tag === 'FORM' || tag === 'VIDEO' || tag === 'IMG' || tag === 'PICTURE' ||
      tag === 'CANVAS' || tag === 'SVG') return 0

  const role = el.getAttribute('role')
  if (role === 'application' || role === 'navigation' || role === 'search' ||
      role === 'tabpanel' || role === 'toolbar' || role === 'menu' ||
      role === 'menubar' || role === 'tablist') return 0

  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (rect.width < 200 || rect.height < 200) return 0
  if (el.hidden) return 0

  const style = getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return 0
  if (parseFloat(style.opacity) < 0.05) return 0
  if (style.pointerEvents === 'none' && parseFloat(style.opacity) < 0.5) return 0

  if (style.position !== 'fixed' && style.position !== 'absolute') return 0

  const mapSelector = '.gm-style, [class*="mapbox"], [class*="leaflet"]'
  if (el.closest(mapSelector) || el.querySelector(mapSelector) ||
      el.parentElement?.querySelector(mapSelector)) return 0

  let score = 0

  // --- Positive signals ---

  score += 2

  const zIndex = parseInt(style.zIndex || '0', 10)
  if (zIndex >= 1000) score += 2
  if (zIndex >= 9999) score += 1

  if (vw > 0 && vh > 0) {
    const coverage = (rect.width * rect.height) / (vw * vh)
    if (coverage >= 0.5) score += 2
    if (coverage >= 0.8) score += 2
  }

  if (
    rect.top <= 10 && rect.left <= 10 &&
    rect.width >= vw * 0.9 && rect.height >= vh * 0.9
  ) {
    score += 2
  }

  const bg = style.backgroundColor
  if (bg.startsWith('rgba(') && !bg.endsWith(', 0)')) {
    score += 1
  }

  if (el.querySelector('iframe')) score += 2

  const idClass = (el.id + ' ' + el.className).toLowerCase()
  if (/\b(ad|ads|advert|sponsor|promo)\b/.test(idClass)) score += 1
  if (/interstitial|overlay|popup|modal-ad/.test(idClass)) score += 2

  const bodyStyle = getComputedStyle(document.body)
  if (bodyStyle.overflow === 'hidden' || bodyStyle.position === 'fixed') {
    score += 1
  }

  // --- Negative signals (legitimate modals) ---

  if (el.querySelector('form')) score -= 2
  if (el.querySelector('input[type="password"]')) score -= 10
  if (el.querySelector('input[type="email"]')) score -= 3
  if (el.querySelector('input[type="text"], input[type="search"], input:not([type]), [role="searchbox"], [role="combobox"], [contenteditable="true"]')) score -= 5

  const text = (el.textContent || '').slice(0, 500).toLowerCase()
  if (/cookie|consent|gdpr|privacy.policy/.test(text)) score -= 5

  const images = el.querySelectorAll('img')
  if (images.length === 1 && el.childElementCount <= 3) {
    const img = images[0] as HTMLImageElement
    if (img.naturalWidth > 400) score -= 2
  }

  if (/age.verification|terms.of.service|利用規約|年齢確認/.test(text)) score -= 5

  if (/\b(banner|creative.container|clickthrough|ad-?slot|ad-?unit|ad-?container)\b/.test(idClass)) score -= 3

  if (window.self !== window.top) score -= 3

  if (el.querySelector('iframe[src*="stripe.com"], iframe[src*="paypal"], iframe[src*="three-ds"], iframe[src*="3ds"], iframe[src*="securepay"]')) score -= 15
  if (el.hasAttribute('data-react-aria-top-layer')) score -= 5

  const hasAdIndicator =
    /\b(ad|ads|advert|sponsor|promo)\b/.test(idClass) ||
    /interstitial|overlay|popup|modal-ad/.test(idClass) ||
    el.querySelector('iframe') !== null ||
    el.hasAttribute('data-ad-status') ||
    el.hasAttribute('data-vignette-loaded') ||
    el.querySelector('[data-ad-status], [data-vignette-loaded], ins.adsbygoogle') !== null

  if (!hasAdIndicator) score = Math.min(score, getScoreThreshold() - 1)

  return score
}

export function isStillVisible(el: Element): boolean {
  if (!el.isConnected) return false
  if (!(el instanceof HTMLElement)) return false
  const style = getComputedStyle(el)
  if (style.display === 'none') return false
  if (style.visibility === 'hidden') return false
  if (parseFloat(style.opacity) < 0.01) return false
  const rect = el.getBoundingClientRect()
  if (rect.width < 10 || rect.height < 10) return false
  return true
}

function isKnownAdElement(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  const idClass = (el.id + ' ' + el.className).toLowerCase()
  if (tag === 'INS' && /adsbygoogle/.test(idClass)) return true
  if (el.hasAttribute('data-ad-status')) return true
  if (el.hasAttribute('data-vignette-loaded')) return true
  return false
}

function handleInterstitial(el: Element, score: number): void {
  const detectedAt = Date.now()
  logDetection(el, score)

  if (isKnownAdElement(el)) {
    log('Known ad element detected, force-removing immediately')
    forceRemove(el, score, detectedAt, 'known-ad-element')
    return
  }

  const closeBtn = findCloseButton(el)

  if (closeBtn) {
    forceClick(closeBtn)

    setTimeout(() => {
      if (isStillVisible(el)) {
        log('Close click ineffective, falling back to force-remove')
        forceRemove(el, score, detectedAt, 'click-failed')
      } else {
        recordResolution(el, score, detectedAt, 'close-button-click')
      }
    }, getClickVerificationDelay())
  } else {
    log('No close button found, starting tracker (Layer 4)')
    trackInterstitial(el, score, detectedAt)
  }
}

function processBatch(): void {
  const targets = Array.from(pendingTargets)
  pendingTargets.clear()

  for (const el of targets) {
    if (!el.isConnected) continue
    if (processedElements.has(el)) continue

    if (wasRecentlyTriggeredByUser(el)) {
      log('Skipping element — likely user-triggered:', el.tagName, el.id || el.className)
      continue
    }

    const score = scoreAsInterstitial(el)
    if (score >= getScoreThreshold()) {
      processedElements.add(el)
      handleInterstitial(el, score)
    }
  }
}

export function startDetector(): void {
  trackUserClicks()
  resetClickOnNavigation()

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          pendingTargets.add(node as Element)
        }
      }
      if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
        pendingTargets.add(mutation.target as Element)
      }
    }

    if (scheduleCheckTimeout === null) {
      scheduleCheckTimeout = window.setTimeout(() => {
        scheduleCheckTimeout = null
        try {
          processBatch()
        } catch (e) {
          log('Error in processBatch:', e)
        }
      }, 50)
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  })

  log('Layer 2 detector started')
}
