export interface Settings {
  enabled: boolean
  scoreThreshold: number
  maxWaitForCloseButton: number
  clickVerificationDelay: number
  whitelist: string[]
  enableLogging: boolean
  detectionHistory: DetectionRecord[]
}

export interface DetectionRecord {
  timestamp: number
  url: string
  domain: string
  score: number
  resolvedBy: 'close-button-click' | 'close-button-click-delayed' | 'force-remove' | 'timeout' | 'cancelled'
  duration: number
}

export type Message =
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'DETECTION_OCCURRED'; record: DetectionRecord }
  | { type: 'IS_WHITELISTED'; domain: string }
  | { type: 'ADD_TO_WHITELIST'; domain: string }
  | { type: 'REMOVE_FROM_WHITELIST'; domain: string }
  | { type: 'GET_HISTORY' }
  | { type: 'CLEAR_HISTORY' }
