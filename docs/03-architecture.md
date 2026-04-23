# 03 — 概要設計（アーキテクチャ）

## 全体像

Chrome / Firefox の拡張機能として実装する。中核はcontent scriptで、4層の防御機構を持つ。

```
┌────────────────────────────────────────────────────────────────┐
│                       ブラウザ拡張機能                          │
│                                                                │
│  ┌──────────────────┐      ┌────────────────────────────────┐ │
│  │ service-worker   │◄────►│       popup UI                 │ │
│  │ (background)     │      │  - ON/OFFトグル                │ │
│  │  - 設定永続化     │      │  - ホワイトリスト管理          │ │
│  │  - メッセージ中継 │      │  - 検出履歴表示                │ │
│  └────────▲─────────┘      └────────────────────────────────┘ │
│           │                                                   │
│           │ chrome.storage / runtime.sendMessage              │
│           │                                                   │
│  ┌────────▼────────────────────────────────────────────────┐ │
│  │              content script (全ページ + 全iframe)        │ │
│  │                                                         │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐          │ │
│  │  │ Layer 1   │  │ Layer 2   │  │ Layer 4   │          │ │
│  │  │ CSS注入    │──│ 検出 +    │──│ 遅延対応  │          │ │
│  │  │ (予防)     │  │ Click      │  │ (継続監視)│          │ │
│  │  └───────────┘  └─────┬─────┘  └─────┬─────┘          │ │
│  │                       │              │                 │ │
│  │                       ▼              ▼                 │ │
│  │                 ┌──────────────────────┐               │ │
│  │                 │ Layer 3: 強制除去    │               │ │
│  │                 │ (display:none)        │               │ │
│  │                 └──────────────────────┘               │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## コンポーネント一覧

### 1. content script（中核）

ページ内で動作する本体。全iframeにも注入する（`all_frames: true`）。

**責務**：
- Interstitialの検出
- 閉じるボタンの探索とクリック
- 強制除去
- service-worker とのメッセージ通信

**構成ファイル**（予定）：
- `content/index.ts` — エントリポイント、各レイヤーの起動
- `content/layer1-css.ts` — CSS注入制御
- `content/layer2-detector.ts` — MutationObserver + スコアリング
- `content/layer3-remover.ts` — 強制除去
- `content/layer4-tracker.ts` — 継続監視
- `content/close-button.ts` — 閉じるボタン探索
- `content/utils.ts` — 共通ユーティリティ

### 2. service-worker（background）

ブラウザ拡張のバックグラウンドで動作。

**責務**：
- 設定の永続化（`chrome.storage.sync`）
- content script / popup 間のメッセージ中継
- ホワイトリスト管理
- 拡張機能のインストール時初期化

### 3. popup UI

拡張アイコンをクリックしたときに表示されるUI。

**責務**：
- 拡張のオン/オフトグル
- 現在のサイトをホワイトリストに追加/削除
- 直近の検出履歴表示
- スコア閾値の調整（上級者向け）

### 4. 事前注入CSS

`layer1.css` として manifest に登録、`document_start` で注入。

---

## データフロー

### ページロード時

```
1. document_start
   └─ manifest経由でlayer1.cssが注入される
   └─ content script がロードされる
   
2. content script 初期化
   └─ chrome.storage から設定を読み込み
   └─ 現在のURLがホワイトリストに含まれていないか確認
   └─ (含まれていれば何もせず終了)
   
3. MutationObserver 起動
   └─ document.documentElement を監視
   └─ DOMContentLoaded も待たず、DOM変化を即座に捕捉
```

### Interstitial検出時

```
1. DOM変化イベント
   └─ scheduleCheck() で 50-100ms debounce
   
2. 要素のスコアリング
   └─ scoreAsInterstitial(element) → 数値
   └─ 閾値（例: 7）以上なら Interstitial 候補
   
3. 閉じるボタン探索
   └─ findCloseButton(container) → HTMLElement | null
   
4a. 閉じるボタンあり
    └─ forceClick(button)
    └─ 1.5秒後に要素がまだ表示されているかチェック
        └─ 消えていれば: 完了、履歴に記録
        └─ 残っていれば: Layer 3（強制除去）
        
4b. 閉じるボタンなし
    └─ Layer 4（継続監視）
        └─ サブツリー変更を監視
        └─ 閉じるボタン出現を待つ（最大8秒）
        └─ タイムアウトで Layer 3 へ
```

---

## 設定スキーマ

`chrome.storage.sync` に保存する設定：

```typescript
interface Settings {
  enabled: boolean                    // 拡張のオン/オフ
  scoreThreshold: number              // スコア閾値（デフォルト 7）
  maxWaitForCloseButton: number       // Layer4のタイムアウト（デフォルト 8000ms）
  clickVerificationDelay: number      // クリック後の確認待ち時間（デフォルト 1500ms）
  whitelist: string[]                 // ホワイトリストに登録されたドメイン
  enableLogging: boolean              // console ログのオン/オフ
  detectionHistory: DetectionRecord[] // 直近の検出履歴（最大100件）
}

interface DetectionRecord {
  timestamp: number
  url: string
  domain: string
  score: number
  resolvedBy: 'close-button-click' | 'force-remove' | 'timeout' | 'cancelled'
  duration: number  // 検出から消去までの ms
}
```

---

## メッセージプロトコル

content script ↔ service-worker ↔ popup の間のメッセージ。

```typescript
type Message =
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'DETECTION_OCCURRED'; record: DetectionRecord }
  | { type: 'IS_WHITELISTED'; domain: string }
  | { type: 'ADD_TO_WHITELIST'; domain: string }
  | { type: 'REMOVE_FROM_WHITELIST'; domain: string }
  | { type: 'GET_HISTORY' }
  | { type: 'CLEAR_HISTORY' }
```

---

## 拡張機能の manifest（概要）

```json
{
  "manifest_version": 3,
  "name": "InterstitialBlocker",
  "version": "0.1.0",
  "description": "Automatically dismiss interstitial ads without blocking other content",
  "permissions": ["storage", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/index.js"],
    "css": ["assets/layer1.css"],
    "run_at": "document_start",
    "all_frames": true,
    "match_about_blank": true
  }],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": { ... }
  }
}
```

注：`activeTab` を使うか `<all_urls>` を使うかは議論の余地がある。自動検出が目的なので `<all_urls>` が必要。

---

## 使用ライブラリ（推奨）

最小限に抑える方針。

- **TypeScript**：型安全性
- **Vite** + **@crxjs/vite-plugin**：拡張機能のビルド
- **Preact**（popup のみ、React より軽量）：不要なら素のDOM操作でもOK
- テスト：**Vitest** + **jsdom**

**使わないもの**：
- jQuery
- 汎用DOM操作ライブラリ（native DOMで十分）
- Redux等の状態管理（popup に不要）

---

## ブラウザ互換性

| 機能 | Chrome | Firefox | Edge |
|------|--------|---------|------|
| Manifest V3 | ✅ | ✅ (v109+) | ✅ |
| `chrome.scripting.insertCSS` (origin: USER) | ✅ | ⚠️ (一部挙動差) | ✅ |
| service_worker | ✅ | ⚠️ (Firefox は background.scripts 互換が推奨) | ✅ |

Firefox対応はMVP後のステップ。まずはChrome優先。
