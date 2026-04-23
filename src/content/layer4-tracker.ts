import { getMaxWaitForCloseButton, log, recordResolution } from './utils'
import { findCloseButton, forceClick } from './close-button'
import { isStillVisible } from './layer2-detector'
import { forceRemove } from './layer3-remover'

interface TrackingInfo {
  attempts: number
  observer: MutationObserver
  timeoutId: number
}

const tracked = new WeakMap<Element, TrackingInfo>()

export function trackInterstitial(el: Element, score: number, detectedAt: number): void {
  if (tracked.has(el)) return

  const info: TrackingInfo = {
    attempts: 0,
    observer: null!,
    timeoutId: 0,
  }

  const cleanup = () => {
    info.observer.disconnect()
    clearTimeout(info.timeoutId)
    tracked.delete(el)
  }

  info.observer = new MutationObserver(() => {
    if (info.attempts > 20) {
      cleanup()
      if (isStillVisible(el)) forceRemove(el, score, detectedAt, 'max-attempts-exceeded')
      return
    }

    info.attempts++

    const closeBtn = findCloseButton(el)
    if (closeBtn) {
      forceClick(closeBtn)
      setTimeout(() => {
        if (isStillVisible(el)) {
          forceRemove(el, score, detectedAt, 'delayed-click-ineffective')
        } else {
          recordResolution(el, score, detectedAt, 'close-button-click-delayed')
        }
        cleanup()
      }, 500)
    }
  })

  info.observer.observe(el, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden'],
  })

  info.timeoutId = window.setTimeout(() => {
    if (isStillVisible(el)) {
      log('Layer 4 timeout — falling back to force-remove')
      forceRemove(el, score, detectedAt, 'tracking-timeout')
    }
    cleanup()
  }, getMaxWaitForCloseButton())

  tracked.set(el, info)
  log('Layer 4 tracking started for element:', el)
}
