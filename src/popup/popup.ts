import type { Settings, DetectionRecord } from '../content/types'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

let currentDomain = ''

async function sendMessage<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>
}

async function getCurrentDomain(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) return ''
  try {
    return new URL(tab.url).hostname
  } catch {
    return ''
  }
}

async function init() {
  currentDomain = await getCurrentDomain()
  const settings = await sendMessage<Settings>({ type: 'GET_SETTINGS' })

  renderDomain()
  renderToggle(settings)
  renderWhitelist(settings)
  renderHistory(settings.detectionHistory)
  renderAdvanced(settings)
  bindEvents()
}

function renderDomain() {
  $('current-domain').textContent = currentDomain || '(不明)'
  const btn = $<HTMLButtonElement>('whitelist-btn')
  btn.disabled = !currentDomain
}

function renderToggle(settings: Settings) {
  const checkbox = $<HTMLInputElement>('enabled-checkbox')
  checkbox.checked = settings.enabled
}

function renderWhitelist(settings: Settings) {
  const btn = $<HTMLButtonElement>('whitelist-btn')
  const isWhitelisted = settings.whitelist.includes(currentDomain)
  btn.textContent = isWhitelisted ? 'このサイトで有効化' : 'このサイトで無効化'
  btn.classList.toggle('btn-active', isWhitelisted)
}

function renderHistory(history: DetectionRecord[]) {
  const list = $('history-list')
  $('history-count').textContent = String(history.length)

  if (history.length === 0) {
    list.innerHTML = '<li class="empty">まだ検出履歴がありません</li>'
    return
  }

  const items = history.slice(0, 10).map(record => {
    const date = new Date(record.timestamp)
    const time = date.toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const resultClass = record.resolvedBy.includes('click') ? 'result-click' : 'result-force'
    const resultLabel = formatResolvedBy(record.resolvedBy)

    return `<li>
      <span class="history-domain">${escapeHtml(record.domain)}</span>
      <span class="history-result ${resultClass}">${resultLabel}</span>
      <br>
      <span class="history-meta">score:${record.score} ${time} (${record.duration}ms)</span>
    </li>`
  })

  list.innerHTML = items.join('')
}

function formatResolvedBy(resolvedBy: string): string {
  switch (resolvedBy) {
    case 'close-button-click': return 'クリック'
    case 'close-button-click-delayed': return '遅延クリック'
    case 'force-remove': return '強制除去'
    case 'timeout': return 'タイムアウト'
    case 'cancelled': return 'キャンセル'
    default: return resolvedBy
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

function renderAdvanced(settings: Settings) {
  $<HTMLInputElement>('threshold-input').value = String(settings.scoreThreshold)
  $<HTMLInputElement>('logging-checkbox').checked = settings.enableLogging
}

function bindEvents() {
  $<HTMLInputElement>('enabled-checkbox').addEventListener('change', async (e) => {
    const enabled = (e.target as HTMLInputElement).checked
    await sendMessage({ type: 'UPDATE_SETTINGS', settings: { enabled } })
  })

  $<HTMLButtonElement>('whitelist-btn').addEventListener('click', async () => {
    if (!currentDomain) return
    const settings = await sendMessage<Settings>({ type: 'GET_SETTINGS' })
    const isWhitelisted = settings.whitelist.includes(currentDomain)

    if (isWhitelisted) {
      await sendMessage({ type: 'REMOVE_FROM_WHITELIST', domain: currentDomain })
    } else {
      await sendMessage({ type: 'ADD_TO_WHITELIST', domain: currentDomain })
    }

    const updated = await sendMessage<Settings>({ type: 'GET_SETTINGS' })
    renderWhitelist(updated)
  })

  $<HTMLButtonElement>('clear-history').addEventListener('click', async () => {
    await sendMessage({ type: 'CLEAR_HISTORY' })
    renderHistory([])
  })

  $<HTMLInputElement>('threshold-input').addEventListener('change', async (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10)
    if (val >= 1 && val <= 20) {
      await sendMessage({ type: 'UPDATE_SETTINGS', settings: { scoreThreshold: val } })
    }
  })

  $<HTMLInputElement>('logging-checkbox').addEventListener('change', async (e) => {
    const enableLogging = (e.target as HTMLInputElement).checked
    await sendMessage({ type: 'UPDATE_SETTINGS', settings: { enableLogging } })
  })
}

init().catch(console.error)
