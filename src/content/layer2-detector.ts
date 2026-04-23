import { getScoreThreshold, getClickVerificationDelay, log, logDetection, recordResolution } from './utils'
import { findCloseButton, forceClick } from './close-button'
import { trackInterstitial } from './layer4-tracker'
import { forceRemove } from './layer3-remover'

const processedElements = new WeakSet<Element>()
const pendingTargets = new Set<Element>()
let scheduleCheckTimeout: number | null = null

let lastUserClickAt = 0

function trackUserClicks(): void {
  document.addEventListener('click', () => {
    lastUserClickAt = Date.now()
  }, { capture: true, passive: true })
}

function wasRecentlyTriggeredByUser(): boolean {
  return Date.now() - lastUserClickAt < 2000
}

export function scoreAsInterstitial(el: Element): number {
  if (!(el instanceof HTMLElement)) return 0
  if (!el.isConnected) return 0

  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (rect.width < 200 || rect.height < 200) return 0
  if (el.hidden) return 0

  const style = getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return 0

  let score = 0

  // --- Positive signals ---

  if (style.position === 'fixed' || style.position === 'absolute') score += 2

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

  const text = (el.textContent || '').slice(0, 500).toLowerCase()
  if (/cookie|consent|gdpr|privacy.policy/.test(text)) score -= 5

  const images = el.querySelectorAll('img')
  if (images.length === 1 && el.childElementCount <= 3) {
    const img = images[0] as HTMLImageElement
    if (img.naturalWidth > 400) score -= 2
  }

  if (/age.verification|terms.of.service|利用規約|年齢確認/.test(text)) score -= 5

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

function handleInterstitial(el: Element, score: number): void {
  const detectedAt = Date.now()
  logDetection(el, score)

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

  if (wasRecentlyTriggeredByUser()) {
    log('Skipping batch — recent user click detected')
    return
  }

  for (const el of targets) {
    if (!el.isConnected) continue
    if (processedElements.has(el)) continue

    const score = scoreAsInterstitial(el)
    if (score >= getScoreThreshold()) {
      processedElements.add(el)
      handleInterstitial(el, score)
    }
  }
}

export function startDetector(): void {
  trackUserClicks()

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
