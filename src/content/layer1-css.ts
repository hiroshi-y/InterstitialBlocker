import { log } from './utils'

const LAYER1_CSS = `
/* InterstitialBlocker — Layer 1: Preventive CSS */

html, body {
  overflow: auto !important;
  overflow-y: auto !important;
  overflow-x: auto !important;
  position: static !important;
  height: auto !important;
  max-height: none !important;
}

html.no-scroll, body.no-scroll,
html.modal-open, body.modal-open,
html.overflow-hidden, body.overflow-hidden,
html.locked, body.locked,
html.noscroll, body.noscroll,
html.scroll-lock, body.scroll-lock {
  overflow: auto !important;
  position: static !important;
  height: auto !important;
}

html, body, main, article {
  pointer-events: auto !important;
}

[id*="interstitial" i],
[class*="interstitial" i] {
  display: none !important;
}
`

let styleElement: HTMLStyleElement | null = null

export function injectLayer1Css(): void {
  if (styleElement) return

  styleElement = document.createElement('style')
  styleElement.textContent = LAYER1_CSS
  styleElement.setAttribute('data-interstitial-blocker', 'layer1')

  const target = document.head || document.documentElement
  target.appendChild(styleElement)
  log('Layer 1 CSS injected')
}

export function removeLayer1Css(): void {
  if (styleElement) {
    styleElement.remove()
    styleElement = null
    log('Layer 1 CSS removed')
  }
}
