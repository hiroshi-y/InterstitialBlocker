import type { Settings, DetectionRecord } from './types'

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  scoreThreshold: 7,
  maxWaitForCloseButton: 8000,
  clickVerificationDelay: 1500,
  whitelist: [],
  enableLogging: true,
  detectionHistory: [],
}

let currentSettings: Settings | null = null

export async function loadSettings(): Promise<Settings> {
  if (currentSettings) return currentSettings
  try {
    const stored = await chrome.storage.sync.get('settings')
    currentSettings = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) }
  } catch {
    currentSettings = { ...DEFAULT_SETTINGS }
  }
  return currentSettings
}

export function getSettings(): Settings {
  return currentSettings ?? DEFAULT_SETTINGS
}

export function getScoreThreshold(): number {
  return currentSettings?.scoreThreshold ?? DEFAULT_SETTINGS.scoreThreshold
}

export function getClickVerificationDelay(): number {
  return currentSettings?.clickVerificationDelay ?? DEFAULT_SETTINGS.clickVerificationDelay
}

export function getMaxWaitForCloseButton(): number {
  return currentSettings?.maxWaitForCloseButton ?? DEFAULT_SETTINGS.maxWaitForCloseButton
}

export function isWhitelisted(): boolean {
  const domain = location.hostname
  return currentSettings?.whitelist?.includes(domain) ?? false
}

export function log(...args: unknown[]): void {
  if (!currentSettings?.enableLogging) return
  console.log('[InterstitialBlocker]', ...args)
}

export function logDetection(el: Element, score: number): void {
  if (!currentSettings?.enableLogging) return
  console.log('[InterstitialBlocker] Detected:', {
    score,
    element: el,
    tag: el.tagName,
    id: el.id,
    classes: el.className,
    rect: el.getBoundingClientRect(),
    url: location.href,
  })
}

export function recordResolution(
  el: Element,
  score: number,
  detectedAt: number,
  resolvedBy: DetectionRecord['resolvedBy'],
): void {
  const record: DetectionRecord = {
    timestamp: Date.now(),
    url: location.href,
    domain: location.hostname,
    score,
    resolvedBy,
    duration: Date.now() - detectedAt,
  }

  log('Resolved:', { resolvedBy, score, duration: record.duration })

  chrome.runtime.sendMessage({ type: 'DETECTION_OCCURRED', record }).catch(() => {})
}
