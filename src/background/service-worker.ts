import type { Settings, DetectionRecord, Message } from '../content/types'

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  scoreThreshold: 7,
  maxWaitForCloseButton: 8000,
  clickVerificationDelay: 1500,
  whitelist: [],
  enableLogging: true,
  detectionHistory: [],
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get('settings')
  if (!stored.settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS })
  }
  console.log('[InterstitialBlocker] Extension installed, settings initialized')
})

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse)
  return true
})

async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get('settings')
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) }
}

async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ settings })
}

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'GET_SETTINGS': {
      return await getSettings()
    }
    case 'UPDATE_SETTINGS': {
      const current = await getSettings()
      const updated = { ...current, ...message.settings }
      await saveSettings(updated)
      return updated
    }
    case 'DETECTION_OCCURRED': {
      const settings = await getSettings()
      const history: DetectionRecord[] = [
        message.record,
        ...settings.detectionHistory,
      ].slice(0, 100)
      await saveSettings({ ...settings, detectionHistory: history })
      return { ok: true }
    }
    case 'IS_WHITELISTED': {
      const settings = await getSettings()
      return { whitelisted: settings.whitelist.includes(message.domain) }
    }
    case 'ADD_TO_WHITELIST': {
      const settings = await getSettings()
      if (!settings.whitelist.includes(message.domain)) {
        settings.whitelist.push(message.domain)
        await saveSettings(settings)
      }
      return { ok: true }
    }
    case 'REMOVE_FROM_WHITELIST': {
      const settings = await getSettings()
      settings.whitelist = settings.whitelist.filter(d => d !== message.domain)
      await saveSettings(settings)
      return { ok: true }
    }
    case 'GET_HISTORY': {
      const settings = await getSettings()
      return settings.detectionHistory
    }
    case 'CLEAR_HISTORY': {
      const settings = await getSettings()
      settings.detectionHistory = []
      await saveSettings(settings)
      return { ok: true }
    }
    default:
      return { error: 'Unknown message type' }
  }
}
