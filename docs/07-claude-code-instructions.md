# 07 — Claude Code への作業指示書

このドキュメントは、Claude Code（CLIで動作するコーディングエージェントとしてのClaude）が、
このプロジェクトを自走して実装できるようにするための指示書です。

---

## あなたの役割

あなたは**Claude Code**として、このプロジェクトの実装を担当します。
前任のClaude（web版）がユーザーの安川氏と設計ディスカッションを行い、この設計書一式を作成しました。
あなたはそれを引き継いで、実装を進めます。

---

## 作業開始時のチェックリスト

**必ず以下を最初に実行してください：**

1. [ ] `README.md` を読む
2. [ ] `docs/01-project-purpose.md` を読む — **最重要**。プロジェクトの「やらないこと」を理解する
3. [ ] `docs/02-approach-overview.md` を読む — 採用/不採用の理由を理解する
4. [ ] `docs/03-architecture.md` を読む — 全体像を把握
5. [ ] `docs/04-detailed-design.md` を読む — 実装の詳細
6. [ ] `docs/05-edge-cases-and-risks.md` を読む — 気をつけること
7. [ ] `docs/06-development-plan.md` を読む — 開発フェーズ
8. [ ] ユーザー（安川氏）に「設計書を読みました。Phase 0 から始めます」と報告

---

## 絶対に守るべき原則

### 原則1：スコープを逸脱しない

このプロジェクトは **Interstitial広告だけ** を対象にする広告ブロッカーではないプロジェクトです。

以下のような提案・実装は **絶対にしない**：

- ❌ 広告ドメインのブロックリスト導入
- ❌ バナー広告やサイドバー広告の除去
- ❌ EasyList等の既存ブロックリストの参照
- ❌ ネットワークレベルのフィルタリング
- ❌ トラッカー（アナリティクス等）のブロック

これらは「似たような機能があった方が便利かも」と思っても、**プロジェクトの性格を変えてしまう**ので
絶対にやりません。提案する場合も、ユーザーに明示的に許可を取ってから。

### 原則2：DOMパターン辞書を作らない

過去プロジェクトの反省から、**広告ネットワークごとのセレクタ辞書は作りません**。
たとえば以下のようなコードは **避ける**：

```typescript
// ❌ 悪い例：広告ネットワーク依存のパターン
const AD_SELECTORS = [
  '.google-ads-interstitial',
  'div[data-ad-network="doubleclick"]',
  // ...
]
```

**代わりに、視覚的特徴によるスコアリングを使う**：

```typescript
// ✅ 良い例：ネットワーク非依存
function scoreAsInterstitial(el) {
  // position, z-index, size, 背景色などから判定
}
```

ただし、既知の誤爆・見逃しパターンをフィクスチャとしてテストに追加するのはOK。
それはデバッグとリグレッション防止のためで、運用ロジックには組み込まない。

### 原則3：Phase順に進める

開発計画（`06-development-plan.md`）で定めたPhase順に進めます。

- Phase 0（セットアップ）を飛ばして Phase 2 から始めない
- Phase 2（検出ロジック）を Phase 4（強制除去）より先に完成させる
- 各Phaseの完了条件を満たしたら、ユーザーに報告して次フェーズの確認を取る

### 原則4：動作する状態を保つ

各Phaseの終わりには、必ずビルドが通り、拡張機能として読み込める状態にする。
「途中で動かないけどPhase 5までガッと書く」ようなことはしない。

### 原則5：設計変更は確認を取る

設計書で決まったことと違う実装をする必要があると感じたら、実装する前にユーザーに確認する。

例：
- 「スコア閾値を7ではなく5にした方が良いと思うのですが、変更していいですか？」
- 「Layer 3 の強制除去で `display: none` ではなく `el.remove()` を使う方が良いと思うのですが、これは設計書と違うので確認させてください」

---

## 実装時の具体的な指針

### TypeScriptの型について

- `any` は原則使わない。どうしても必要な場合はコメントで理由を書く
- DOM要素は `HTMLElement` か `Element` を適切に使い分ける
- 設定オブジェクトは `04-detailed-design.md` の `Settings` インターフェースを使う

### ログとデバッグ

- `console.log` は `[InterstitialBlocker]` プレフィックスを付ける
- 設定の `enableLogging` で制御できるようにする
- 本番ビルドでも過度に削らない（ユーザーがデバッグできる状態を保つ）

### エラーハンドリング

- `chrome.runtime.sendMessage` など、popup が閉じていると失敗する呼び出しは `.catch(() => {})` で握り潰す
- MutationObserver 内でエラーが起きても、Observer が止まらないように try-catch で囲む
- ページ側のスクリプトが要素を書き換えた結果として発生するエラーは吸収する

### パフォーマンス

- `getBoundingClientRect()` と `getComputedStyle()` は同期的に reflow/recalculate を起こす可能性があるので乱発しない
- 軽量な pre-filter で絞り込んでから重い判定をする
- MutationObserver のイベントは debounce する（50-100ms）

### テスト

- フィクスチャは `tests/fixtures/*.html` に配置
- 各Phaseの完了条件に書いてあるフィクスチャは必ず作る
- ユニットテストは Vitest で（スコアリング関数、閉じるボタン探索など）
- 手動テストの手順は `tests/manual-test-checklist.md` に記録

---

## ユーザーとのコミュニケーション

### 報告すべきタイミング

1. 各Phase の開始前（「Phase Nを始めます」）
2. 各Phase の完了後（「Phase N 完了しました。動作確認結果：...」）
3. 設計書と異なる判断をする必要があるとき
4. エッジケースを発見したが対処方針が不明なとき
5. 実装が完了してブラウザで読み込めたとき（スクリーンショットや動画があればベスト）

### 報告しなくていいこと

- 些細な実装詳細の変更（変数名、関数分割等）
- 設計書の範囲内での実装判断
- ユニットテスト追加

### 困ったときの聞き方

✅ 良い聞き方：
> Phase 3 の閉じるボタン探索で、aria-label が付いていないかつテキストも空の閉じるボタン（SVGのみ）に遭遇しました。設計書では「優先度4：右上配置のクリック可能要素」で拾う想定ですが、実装してみると右上に複数のSVG要素があるサイトで誤爆が起きます。以下のA/B案のどちらがよいか判断をお願いします：
> - A案：SVG要素は一律除外
> - B案：SVG要素内のpathの数で判定（×のパスは単純、他は複雑）

❌ 悪い聞き方：
> 閉じるボタンが見つかりません。どうしますか？

---

## コミットとブランチ戦略

- 初期は `main` ブランチ直接でOK（個人開発のため）
- コミットメッセージの先頭に `[Phase N]` をつける
- 例：`[Phase 2] Add MutationObserver and basic scoring function`
- 大きな設計変更時は別ブランチを切る

---

## ディレクトリ構造（再掲）

```
InterstitialBlocker/
├── README.md
├── docs/                        # 設計書（既存、触らない）
├── src/                         # 実装（あなたが作る）
│   ├── manifest.json
│   ├── content/
│   │   ├── index.ts
│   │   ├── layer1-css.ts        # 動的CSS注入が必要なら（基本は layer1.css で OK）
│   │   ├── layer2-detector.ts
│   │   ├── layer3-remover.ts
│   │   ├── layer4-tracker.ts
│   │   ├── close-button.ts
│   │   ├── utils.ts
│   │   └── types.ts
│   ├── background/
│   │   └── service-worker.ts
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   └── assets/
│       ├── layer1.css
│       └── icons/
│           ├── icon-16.png
│           ├── icon-48.png
│           └── icon-128.png
├── tests/
│   ├── fixtures/
│   │   ├── simple-modal.html
│   │   ├── google-adsense-like.html
│   │   ├── scroll-lock-modal.html
│   │   ├── cookie-banner.html
│   │   ├── login-modal.html
│   │   ├── lightbox.html
│   │   └── ...
│   ├── unit/
│   │   ├── scoring.test.ts
│   │   ├── close-button.test.ts
│   │   └── ...
│   └── manual-test-checklist.md
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

---

## Phase 0 のスタート地点

Phase 0 のタスクをそのまま実行してください：

```bash
cd "C:\Users\HiroshiYASUKAWA\Ayudante, Inc. Dropbox\Hiroshi Yasukawa\Docs\Personal\dev\InterstitialBlocker"

# プロジェクト初期化
npm init -y
npm install -D typescript vite @crxjs/vite-plugin @types/chrome
npm install -D vitest jsdom @types/node

# tsconfig.json 作成
npx tsc --init

# ディレクトリ作成
mkdir -p src/content src/background src/popup src/assets/icons
mkdir -p tests/fixtures tests/unit
```

その後：
- `tsconfig.json` を Chrome拡張 + ESM向けに調整
- `vite.config.ts` を `@crxjs/vite-plugin` 使用で作成
- `src/manifest.json` を Manifest V3 で最小構成で作成
- `src/content/index.ts` に `console.log('[InterstitialBlocker] loaded at', location.href)` だけ書く
- `npm run build` で `dist/` が出来ることを確認
- Chrome で `dist/` を「パッケージ化されていない拡張機能として読み込む」

これが出来たらユーザーに報告してPhase 1 へ。

---

## 最後に

このプロジェクトは、ユーザーの日常的な不便を解消するためのものです。
完璧である必要はありませんが、**誤爆でユーザーを困らせない**ことが最優先。

「見逃し」よりも「誤爆」の方が問題です。
迷ったら安全側（何もしない方）に倒してください。

頑張ってください。質問があればいつでもユーザーに聞いてください。
