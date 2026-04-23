import { log } from './utils'

export function findCloseButton(container: Element): HTMLElement | null {
  if (!(container instanceof HTMLElement)) return null

  // --- Priority 1: explicit aria/title attributes ---
  const aria = container.querySelector<HTMLElement>([
    '[aria-label*="close" i]',
    '[aria-label*="dismiss" i]',
    '[aria-label*="skip" i]',
    '[aria-label*="閉じる"]',
    '[aria-label*="とじる"]',
    '[aria-label*="閉"]',
    '[title*="close" i]',
    '[title*="dismiss" i]',
    '[title="×"]',
  ].join(','))
  if (aria && isClickable(aria)) {
    log('Close button found via aria/title:', aria)
    return aria
  }

  // --- Priority 2: data-dismiss attributes ---
  const dataDismiss = container.querySelector<HTMLElement>([
    '[data-dismiss]',
    '[data-close]',
    '[data-action="close"]',
    '[data-role="close"]',
  ].join(','))
  if (dataDismiss && isClickable(dataDismiss)) {
    log('Close button found via data-dismiss:', dataDismiss)
    return dataDismiss
  }

  // --- Priority 3: text content is × only ---
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(
    'button, a, [role="button"], div, span, i, svg'
  ))

  const parentRect = container.getBoundingClientRect()

  for (const el of candidates) {
    const text = (el.textContent || '').trim()
    if (/^[×✕╳✖⨯xX]$/.test(text)) {
      const rect = el.getBoundingClientRect()
      const isSmall = rect.width < 60 && rect.height < 60
      const isTopRight =
        rect.right > parentRect.right - 100 &&
        rect.top < parentRect.top + 100
      if (isSmall && isTopRight && isClickable(el)) {
        log('Close button found via × text:', el)
        return el
      }
    }
  }

  // --- Priority 4: top-right clickable element ---
  const topRightCandidates: { el: HTMLElement; score: number }[] = []

  for (const el of candidates) {
    if (!isClickable(el)) continue

    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue

    const isTopRight =
      rect.right > parentRect.right - 80 &&
      rect.top < parentRect.top + 80 &&
      rect.width < 80 && rect.height < 80

    if (isTopRight) {
      const cornerDistance = Math.hypot(
        parentRect.right - rect.right,
        rect.top - parentRect.top
      )
      topRightCandidates.push({ el, score: 100 - cornerDistance })
    }
  }

  topRightCandidates.sort((a, b) => b.score - a.score)
  if (topRightCandidates.length > 0) {
    log('Close button found via top-right position:', topRightCandidates[0].el)
    return topRightCandidates[0].el
  }

  return null
}

function isClickable(el: HTMLElement): boolean {
  if (el.tagName === 'BUTTON' || el.tagName === 'A') return true
  if (el.getAttribute('role') === 'button') return true
  if (el.onclick !== null) return true
  const style = getComputedStyle(el)
  if (style.cursor === 'pointer') return true
  return false
}

export function forceClick(el: HTMLElement): void {
  const rect = el.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2

  const eventInit: MouseEventInit = {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: 1,
  }

  try {
    el.dispatchEvent(new PointerEvent('pointerdown', eventInit))
    el.dispatchEvent(new MouseEvent('mousedown', eventInit))
    el.dispatchEvent(new PointerEvent('pointerup', eventInit))
    el.dispatchEvent(new MouseEvent('mouseup', eventInit))
    el.dispatchEvent(new MouseEvent('click', eventInit))
    log('forceClick dispatched on:', el)
  } catch {
    el.click()
    log('forceClick fallback (.click()) on:', el)
  }
}
