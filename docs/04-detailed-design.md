# 04 — 詳細設計

各レイヤーの実装レベルの仕様。Claude Codeはこれを実装参考にする。
**注**：コード片はTypeScript疑似コード。実装時に型や細部を調整してよい。

---

## レイヤー1：予防的CSS注入

### 目的

Interstitialが表示されても、ユーザーが「先に進めなくなる」状態を防ぐ。
広告を消せなくても、**無視できる状態**にする。

### 注入タイミング

`document_start`。manifest の `content_scripts.css` 経由で自動注入される。
ページ側のCSSより先に基盤を作る。

### 注入CSS（`src/assets/layer1.css`）

```css
/* ============================================================
   InterstitialBlocker — Layer 1: Preventive CSS
   目的: Interstitialが表示されてもユーザーが操作を続けられる状態を維持
   ============================================================ */

/* スクロールロック解除：html/body */
html, body {
  overflow: auto !important;
  overflow-y: auto !important;
  overflow-x: auto !important;
  position: static !important;
  height: auto !important;
  max-height: none !important;
}

/* body に対する固定化攻撃の無効化（よくあるクラス名） */
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

/* pointer-events でコンテンツがクリックできなくなる攻撃の無効化 */
html, body, main, article {
  pointer-events: auto !important;
}

/* 明白なInterstitial系クラス名 */
/* 慎重。汎用的な "ad" 単独では誤爆する。複合条件のみ */
[id*="interstitial" i],
[class*="interstitial" i] {
  display: none !important;
}
```

### 注意

- `[id*="ad" i]` のような広い条件は絶対に書かない（`sidebar`, `head`, `headline` 等にマッチする）
- `interstitial` は非常に特徴的な単語なので OK
- 足りないと感じても、ここで対処しようとせずレイヤー2以降に任せる

---

## レイヤー2：視覚特徴検出 + 閉じるボタンクリック

### 2.1 MutationObserverの起動

`content/layer2-detector.ts`

```typescript
let scheduleCheckTimeout: number | null = null
const pendingTargets = new Set<Element>()

export function startDetector(): void {
  // DOMContentLoaded を待たない
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // 追加された要素
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          pendingTargets.add(node as Element)
        }
      }
      // 属性変更（display:none → block など）
      if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
        pendingTargets.add(mutation.target as Element)
      }
    }
    
    // debounce: 50ms 以内の変更をまとめて処理
    if (scheduleCheckTimeout === null) {
      scheduleCheckTimeout = window.setTimeout(() => {
        scheduleCheckTimeout = null
        processBatch()
      }, 50)
    }
  })
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  })
}

function processBatch(): void {
  const targets = Array.from(pendingTargets)
  pendingTargets.clear()
  
  for (const el of targets) {
    if (!el.isConnected) continue
    const score = scoreAsInterstitial(el)
    if (score >= getScoreThreshold()) {
      handleInterstitial(el, score)
    }
  }
}
```

### 2.2 スコアリング関数

`content/layer2-detector.ts`

```typescript
export function scoreAsInterstitial(el: Element): number {
  if (!(el instanceof HTMLElement)) return 0
  if (!el.isConnected) return 0
  
  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const style = getComputedStyle(el)
  
  let score = 0
  
  // --- ポジティブ要素 ---
  
  // 視覚特性
  if (['fixed', 'absolute'].includes(style.position)) score += 2
  
  const zIndex = parseInt(style.zIndex || '0', 10)
  if (zIndex >= 1000) score += 2
  if (zIndex >= 9999) score += 1
  
  // サイズ（ビューポート占有率）
  if (vw > 0 && vh > 0) {
    const coverage = (rect.width * rect.height) / (vw * vh)
    if (coverage >= 0.5) score += 2
    if (coverage >= 0.8) score += 2
  }
  
  // 位置（ビューポート左上から始まっている）
  if (rect.top <= 10 && rect.left <= 10 && 
      rect.width >= vw * 0.9 && rect.height >= vh * 0.9) {
    score += 2
  }
  
  // 半透明オーバーレイ背景
  const bg = style.backgroundColor
  if (bg.startsWith('rgba(') && !bg.endsWith(', 0)')) {
    score += 1
  }
  
  // DOM構造ヒント（広告特有）
  if (el.querySelector('iframe')) score += 2
  
  const idClass = (el.id + ' ' + el.className).toLowerCase()
  if (/\b(ad|ads|advert|sponsor|promo)\b/.test(idClass)) score += 1
  if (/interstitial|overlay|popup|modal-ad/.test(idClass)) score += 2
  
  // body のスクロールロック状態
  const bodyStyle = getComputedStyle(document.body)
  if (bodyStyle.overflow === 'hidden' || bodyStyle.position === 'fixed') {
    score += 1
  }
  
  // --- ネガティブ要素（正規モーダルっぽさ）---
  
  // フォーム系は正規モーダルの可能性
  if (el.querySelector('form')) score -= 2
  if (el.querySelector('input[type="password"]')) score -= 10  // ログイン確定
  if (el.querySelector('input[type="email"]')) score -= 3
  
  // クッキー同意 / GDPR系
  const text = (el.textContent || '').slice(0, 500).toLowerCase()
  if (/cookie|consent|gdpr|privacy.policy/.test(text)) score -= 5
  
  // 画像ライトボックス特徴
  const images = el.querySelectorAll('img')
  if (images.length === 1 && el.childElementCount <= 3) {
    const img = images[0]
    if (img.naturalWidth > 400) score -= 2  // 大きな単一画像はlightbox
  }
  
  // 年齢確認 / 利用規約
  if (/age.verification|terms.of.service|利用規約|年齢確認/.test(text)) score -= 5
  
  return score
}
```

### 2.3 閉じるボタン探索

`content/close-button.ts`

```typescript
export function findCloseButton(container: Element): HTMLElement | null {
  // --- 優先度1: 明示的なaria/title属性 ---
  const aria = container.querySelector<HTMLElement>([
    '[aria-label*="close" i]',
    '[aria-label*="dismiss" i]',
    '[aria-label*="skip" i]',
    '[aria-label*="閉じる"]',
    '[aria-label*="とじる"]',
    '[aria-label*="閉"]',
    '[title*="close" i]',
    '[title*="dismiss" i]',
    '[title="×"]'
  ].join(','))
  if (aria && isClickable(aria)) return aria
  
  // --- 優先度2: data-dismiss 系 ---
  const dataDismiss = container.querySelector<HTMLElement>([
    '[data-dismiss]',
    '[data-close]',
    '[data-action="close"]',
    '[data-role="close"]'
  ].join(','))
  if (dataDismiss && isClickable(dataDismiss)) return dataDismiss
  
  // --- 優先度3: テキストが × のみ ---
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(
    'button, a, [role="button"], div, span, i'
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
      if (isSmall && isTopRight && isClickable(el)) return el
    }
  }
  
  // --- 優先度4: 右上に配置されたクリック可能要素 ---
  const topRightCandidates: { el: HTMLElement; score: number }[] = []
  
  for (const el of candidates) {
    if (!isClickable(el)) continue
    
    const rect = el.getBoundingClientRect()
    const isTopRight = 
      rect.right > parentRect.right - 80 &&
      rect.top < parentRect.top + 80 &&
      rect.width < 80 && rect.height < 80
    
    if (isTopRight) {
      // 右上の角に近いほど高スコア
      const cornerDistance = Math.hypot(
        parentRect.right - rect.right,
        rect.top - parentRect.top
      )
      topRightCandidates.push({ el, score: 100 - cornerDistance })
    }
  }
  
  topRightCandidates.sort((a, b) => b.score - a.score)
  return topRightCandidates[0]?.el ?? null
}

function isClickable(el: HTMLElement): boolean {
  if (el.tagName === 'BUTTON' || el.tagName === 'A') return true
  if (el.getAttribute('role') === 'button') return true
  if (el.onclick !== null) return true
  const style = getComputedStyle(el)
  if (style.cursor === 'pointer') return true
  return false
}
```

### 2.4 クリック送信

`content/close-button.ts`

```typescript
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
    buttons: 1
  }
  
  try {
    el.dispatchEvent(new PointerEvent('pointerdown', eventInit))
    el.dispatchEvent(new MouseEvent('mousedown', eventInit))
    el.dispatchEvent(new PointerEvent('pointerup', eventInit))
    el.dispatchEvent(new MouseEvent('mouseup', eventInit))
    el.dispatchEvent(new MouseEvent('click', eventInit))
  } catch (e) {
    // フォールバック
    el.click()
  }
}
```

### 2.5 検出後のハンドリング

`content/layer2-detector.ts`

```typescript
const processedElements = new WeakSet<Element>()

function handleInterstitial(el: Element, score: number): void {
  if (processedElements.has(el)) return
  processedElements.add(el)
  
  logDetection(el, score)
  
  const closeBtn = findCloseButton(el)
  
  if (closeBtn) {
    forceClick(closeBtn)
    
    // クリック後の確認
    setTimeout(() => {
      if (isStillVisible(el)) {
        // クリックが効かなかった → Layer 3
        forceRemove(el, 'click-failed')
      } else {
        recordResolution(el, 'close-button-click')
      }
    }, getClickVerificationDelay())
  } else {
    // 閉じるボタンが見つからない → Layer 4
    trackInterstitial(el, score)
  }
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
```

---

## レイヤー3：強制除去

`content/layer3-remover.ts`

```typescript
export function forceRemove(el: Element, reason: string): void {
  if (!(el instanceof HTMLElement)) return
  
  // 1. display: none で非表示
  el.style.setProperty('display', 'none', 'important')
  el.style.setProperty('visibility', 'hidden', 'important')
  el.style.setProperty('opacity', '0', 'important')
  el.style.setProperty('pointer-events', 'none', 'important')
  
  // 2. body のスクロールロックが残っていたら解除
  unlockBodyScroll()
  
  // 3. 広告スクリプトがstyleを上書きしてくる可能性への対策
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
    attributeFilter: ['style', 'class']
  })
  
  // 4. 一定時間後にガード解除（メモリリーク防止）
  setTimeout(() => styleGuard.disconnect(), 15000)
  
  recordResolution(el, 'force-remove', { reason })
}

function unlockBodyScroll(): void {
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('position')
  document.documentElement.style.removeProperty('overflow')
  document.documentElement.style.removeProperty('position')
  
  for (const cls of ['no-scroll', 'modal-open', 'overflow-hidden', 'locked', 'noscroll']) {
    document.body.classList.remove(cls)
    document.documentElement.classList.remove(cls)
  }
}
```

**設計判断**：
- `el.remove()` は使わない（ページのJSが要素を参照している可能性、広告トラッカーのリトライ動作を誘発する可能性）
- `display: none` + style監視ガードで対応

---

## レイヤー4：遅延表示対策（継続監視）

`content/layer4-tracker.ts`

```typescript
interface TrackingInfo {
  detectedAt: number
  attempts: number
  observer: MutationObserver
  timeoutId: number
}

const tracked = new WeakMap<Element, TrackingInfo>()

export function trackInterstitial(el: Element, score: number): void {
  if (tracked.has(el)) return
  
  const info: TrackingInfo = {
    detectedAt: Date.now(),
    attempts: 0,
    observer: null as any,
    timeoutId: 0
  }
  
  info.observer = new MutationObserver(() => {
    if (info.attempts > 20) {
      cleanup()
      if (isStillVisible(el)) forceRemove(el, 'max-attempts-exceeded')
      return
    }
    
    info.attempts++
    
    const closeBtn = findCloseButton(el)
    if (closeBtn) {
      forceClick(closeBtn)
      setTimeout(() => {
        if (isStillVisible(el)) {
          forceRemove(el, 'click-ineffective')
        } else {
          recordResolution(el, 'close-button-click-delayed')
        }
        cleanup()
      }, 500)
    }
  })
  
  info.observer.observe(el, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden']
  })
  
  // 最大待機時間
  info.timeoutId = window.setTimeout(() => {
    if (isStillVisible(el)) {
      forceRemove(el, 'tracking-timeout')
    }
    cleanup()
  }, getMaxWaitForCloseButton())
  
  const cleanup = () => {
    info.observer.disconnect()
    clearTimeout(info.timeoutId)
    tracked.delete(el)
  }
  
  tracked.set(el, info)
}
```

---

## 共通ユーティリティ

`content/utils.ts`

```typescript
let currentSettings: Settings | null = null

export async function loadSettings(): Promise<Settings> {
  if (currentSettings) return currentSettings
  const stored = await chrome.storage.sync.get('settings')
  currentSettings = stored.settings || DEFAULT_SETTINGS
  return currentSettings
}

export function getScoreThreshold(): number {
  return currentSettings?.scoreThreshold ?? 7
}

export function getClickVerificationDelay(): number {
  return currentSettings?.clickVerificationDelay ?? 1500
}

export function getMaxWaitForCloseButton(): number {
  return currentSettings?.maxWaitForCloseButton ?? 8000
}

export function isWhitelisted(): boolean {
  const domain = location.hostname
  return currentSettings?.whitelist?.includes(domain) ?? false
}

export function logDetection(el: Element, score: number): void {
  if (!currentSettings?.enableLogging) return
  console.log('[InterstitialBlocker] Detected:', {
    score,
    element: el,
    id: el.id,
    classes: el.className,
    rect: el.getBoundingClientRect(),
    url: location.href
  })
}

export function recordResolution(
  el: Element, 
  resolvedBy: DetectionRecord['resolvedBy'],
  extra?: Record<string, unknown>
): void {
  const record: DetectionRecord = {
    timestamp: Date.now(),
    url: location.href,
    domain: location.hostname,
    score: 0,  // 呼び出し側で補完
    resolvedBy,
    duration: 0  // 呼び出し側で補完
  }
  
  chrome.runtime.sendMessage({ type: 'DETECTION_OCCURRED', record })
    .catch(() => {})  // popup が開いていなくても失敗しないように
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  scoreThreshold: 7,
  maxWaitForCloseButton: 8000,
  clickVerificationDelay: 1500,
  whitelist: [],
  enableLogging: false,
  detectionHistory: []
}
```

---

## エントリポイント

`content/index.ts`

```typescript
import { loadSettings, isWhitelisted } from './utils'
import { startDetector } from './layer2-detector'

async function main() {
  const settings = await loadSettings()
  
  if (!settings.enabled) return
  if (isWhitelisted()) return
  
  // Layer 1 の CSS は manifest 経由で自動注入済み
  
  // Layer 2 の検出器を起動
  startDetector()
  
  // Layer 3, 4 は Layer 2 から呼ばれる
}

main().catch(console.error)
```

---

## popup UI

`src/popup/popup.html`

最小機能：
- 現在のドメインが表示される
- 「このサイトで無効化」トグル
- 「拡張全体のオン/オフ」トグル
- 直近の検出履歴（最大10件表示）
- 「詳細設定」リンク（スコア閾値調整、全履歴表示）

素のHTML/CSS/TSで実装可能。Preactを使う場合も複雑な状態管理は不要。

---

## service-worker

`src/background/service-worker.ts`

```typescript
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get('settings')
  if (!stored.settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS })
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse)
  return true  // async response
})

async function handleMessage(message: Message, sender: chrome.runtime.MessageSender) {
  switch (message.type) {
    case 'GET_SETTINGS': {
      const stored = await chrome.storage.sync.get('settings')
      return stored.settings || DEFAULT_SETTINGS
    }
    case 'UPDATE_SETTINGS': {
      const stored = await chrome.storage.sync.get('settings')
      const newSettings = { ...(stored.settings || DEFAULT_SETTINGS), ...message.settings }
      await chrome.storage.sync.set({ settings: newSettings })
      return newSettings
    }
    case 'DETECTION_OCCURRED': {
      const stored = await chrome.storage.sync.get('settings')
      const settings = stored.settings || DEFAULT_SETTINGS
      const history = [message.record, ...settings.detectionHistory].slice(0, 100)
      await chrome.storage.sync.set({ settings: { ...settings, detectionHistory: history } })
      return { ok: true }
    }
    // ... 他のメッセージ
  }
}
```
