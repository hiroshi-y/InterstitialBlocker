import { log, recordResolution } from './utils'

export function forceRemove(el: Element, score: number, detectedAt: number, reason: string): void {
  if (!(el instanceof HTMLElement)) return

  el.style.setProperty('display', 'none', 'important')
  el.style.setProperty('visibility', 'hidden', 'important')
  el.style.setProperty('opacity', '0', 'important')
  el.style.setProperty('pointer-events', 'none', 'important')

  unlockBodyScroll()

  const styleGuard = new MutationObserver(() => {
    if (!el.isConnected) {
      styleGuard.disconnect()
      return
    }
    if (el.style.display !== 'none') {
      el.style.setProperty('display', 'none', 'important')
      el.style.setProperty('visibility', 'hidden', 'important')
    }
  })

  styleGuard.observe(el, {
    attributes: true,
    attributeFilter: ['style', 'class'],
  })

  setTimeout(() => styleGuard.disconnect(), 15000)

  log('Force-removed element:', { reason, element: el })
  recordResolution(el, score, detectedAt, 'force-remove')
}

function unlockBodyScroll(): void {
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('position')
  document.body.style.removeProperty('width')
  document.body.style.removeProperty('top')
  document.documentElement.style.removeProperty('overflow')
  document.documentElement.style.removeProperty('position')

  for (const cls of ['no-scroll', 'modal-open', 'overflow-hidden', 'locked', 'noscroll', 'scroll-lock']) {
    document.body.classList.remove(cls)
    document.documentElement.classList.remove(cls)
  }
}
