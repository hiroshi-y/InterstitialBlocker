# 06 — 開発計画

## フェーズ分け

開発は段階的に進める。各フェーズで動作する成果物を持つこと。

---

## Phase 0：プロジェクトセットアップ（半日〜1日）

### 成果物
- 初期化されたプロジェクト（`package.json`, `tsconfig.json`, ビルド設定）
- 最小の manifest.json
- "Hello World" level の content script（console.log だけ出す）
- 拡張機能としてブラウザに読み込める状態

### タスク
- [ ] `npm init` → TypeScript / Vite / @crxjs/vite-plugin セットアップ
- [ ] ディレクトリ構造を `README.md` の通り作成
- [ ] `manifest.json` を最小構成で作成
- [ ] `src/content/index.ts` に `console.log('InterstitialBlocker loaded')` だけ書く
- [ ] `npm run build` でビルド可能を確認
- [ ] Chrome の `chrome://extensions` で「パッケージ化されていない拡張機能を読み込む」で動作確認
- [ ] 簡単なテストページ（`tests/fixtures/hello.html`）を開いて、コンソールにログが出るか確認

### 完了条件
- 拡張機能がChromeに読み込まれ、任意のページでcontent scriptが動作する

---

## Phase 1：レイヤー1（予防的CSS）実装（半日）

### 成果物
- `src/assets/layer1.css` が完成
- manifest経由で自動注入される

### タスク
- [ ] `src/assets/layer1.css` を `04-detailed-design.md` の内容で作成
- [ ] `manifest.json` の `content_scripts.css` に追加
- [ ] scroll lock するテストページを作成（`tests/fixtures/scroll-lock-test.html`）
- [ ] 拡張有効時に scroll lock が解除されることを確認

### 完了条件
- 意図的に `body { overflow: hidden }` を設定したページでも、拡張有効時はスクロールできる

---

## Phase 2：レイヤー2 検出ロジックの骨格（2-3日）

### 成果物
- MutationObserver が起動
- スコアリング関数が動作
- ログにスコアが出力される（この段階では除去はしない）

### タスク
- [ ] `src/content/utils.ts` の設定読み込み、ログ関数を実装
- [ ] `src/content/layer2-detector.ts` の MutationObserver を実装
- [ ] `scoreAsInterstitial` 関数を実装
- [ ] デバッグモードで検出候補のスコアを console.log で出す
- [ ] `tests/fixtures/` にInterstitialを模した複数のHTMLを作成：
  - `simple-modal.html`（基本のオーバーレイ）
  - `google-adsense-like.html`（iframeベース）
  - `scroll-lock-modal.html`（body スクロールロック付き）
  - `cookie-banner.html`（誤爆しないか検証用）
  - `login-modal.html`（誤爆しないか検証用）
  - `lightbox.html`（誤爆しないか検証用）
- [ ] 各フィクスチャでスコアが期待値付近になるか手動確認

### 完了条件
- 複数のフィクスチャでスコアリングが適切に動作（Interstitialは高スコア、非Interstitialは低スコア）

### テスト観点
- 閾値 7 前後で Interstitial / 非Interstitial が分離できるか
- 誤爆する非Interstitialがあれば、その原因を分析してネガティブ条件を追加

---

## Phase 3：閉じるボタン探索とクリック（2日）

### 成果物
- `findCloseButton` と `forceClick` が動作
- レイヤー2の検出から閉じるボタンクリックまでの一連の流れが完成

### タスク
- [ ] `src/content/close-button.ts` を実装
- [ ] `handleInterstitial` を実装（検出 → 閉じるボタン探索 → クリック）
- [ ] `isStillVisible` を実装
- [ ] フィクスチャの各Interstitialで閉じるボタンが自動クリックされることを確認
- [ ] クリック後1.5秒で消えないケースのテスト（閉じるボタンが存在しないフィクスチャを用意）

### 完了条件
- `simple-modal.html` と `google-adsense-like.html` で、閉じるボタンが自動クリックされる

### 実サイトでの検証
- いくつかの実サイト（ニュースサイト等）でInterstitialが自動閉じされるか確認
- 誤爆がないか確認

---

## Phase 4：レイヤー3 強制除去（1日）

### 成果物
- 閉じるボタンがない/効かない場合のフォールバック動作

### タスク
- [ ] `src/content/layer3-remover.ts` を実装
- [ ] `forceRemove` + style guard Observer
- [ ] `unlockBodyScroll` の実装
- [ ] 閉じるボタンがないInterstitialフィクスチャで強制除去されることを確認
- [ ] 広告スクリプトがstyleを上書きしてくるケースのシミュレーション

### 完了条件
- 閉じるボタンなしフィクスチャで、自動的に display:none される

---

## Phase 5：レイヤー4 遅延表示対応（1日）

### 成果物
- 初期検出時に閉じるボタンがない場合、継続監視する

### タスク
- [ ] `src/content/layer4-tracker.ts` を実装
- [ ] サブツリー変更の監視
- [ ] 最大8秒でタイムアウト → レイヤー3
- [ ] 遅延で閉じるボタンが出るフィクスチャを作成（`setTimeout` で後から追加）
- [ ] 正常に閉じるボタンがクリックされることを確認

### 完了条件
- 遅延表示フィクスチャでも、閉じるボタンが出現次第クリックされる

---

## Phase 6：service-worker と設定永続化（1日）

### 成果物
- 設定の読み書き
- 検出履歴の保存

### タスク
- [ ] `src/background/service-worker.ts` を実装
- [ ] `chrome.storage.sync` への読み書き
- [ ] content script ↔ service-worker のメッセージング
- [ ] `DETECTION_OCCURRED` メッセージで履歴が保存されることを確認

### 完了条件
- 検出履歴がブラウザを再起動しても保持されている

---

## Phase 7：popup UI（1-2日）

### 成果物
- 拡張アイコンクリックで開くpopup
- オン/オフトグル
- ホワイトリスト管理
- 検出履歴表示

### タスク
- [ ] `src/popup/popup.html` を作成
- [ ] `src/popup/popup.ts` で状態管理
- [ ] `src/popup/popup.css` でスタイリング
- [ ] 現在のドメインを表示
- [ ] 「このサイトで無効化」トグル
- [ ] 「拡張全体のオン/オフ」トグル
- [ ] 直近10件の検出履歴表示
- [ ] 設定変更が即座に反映されることを確認

### 完了条件
- popupから拡張を制御でき、変更が content script に即時反映される

---

## Phase 8：実サイトでのQA（継続的）

### タスク
- [ ] 50-100のメジャーサイトで手動テスト
- [ ] Interstitialが検出・処理されるかのチェックリスト作成
- [ ] 誤爆がないかのチェックリスト作成
- [ ] 問題があった場合、スコアリング関数やネガティブ条件を調整
- [ ] 調整結果をテストフィクスチャ化

### サイト例（検証対象）
- 主要ニュースサイト（CNN, BBC, 日経, 朝日 等）
- テックメディア（TechCrunch, Engadget 等）
- まとめサイト
- レシピサイト
- 天気予報サイト
- ブログプラットフォーム（medium, note 等）

---

## Phase 9：Firefox対応（MVP後）

### タスク
- [ ] Firefox の MV3 互換性確認
- [ ] `chrome.*` → `browser.*` の吸収（webextension-polyfill）
- [ ] Firefox での動作確認
- [ ] 必要に応じて manifest を調整

---

## 将来的な拡張機能（バックログ）

- Shadow DOM 対応
- スコア閾値の自動学習
- サイトごとのカスタム設定（ドメイン別に閾値を変える）
- ユーザーが「これは誤爆」をクリックで学習させるフィードバック機構
- Interstitial検出時の短時間フラッシュ表示（UIフィードバック）
- エクスポート/インポート機能（設定とホワイトリストの移行）

---

## 進捗管理

各Phaseの完了時に：
1. 動作確認のスクリーンショット or 動画を撮る
2. `docs/progress.md` に記録
3. コミットメッセージを `[Phase N] ...` 形式で統一

---

## Claude Codeへの注意

- **一度に全部作らない**。Phase 0 から順に、動作する状態を保ちながら進める
- **Phase 2 の段階では除去しない**。スコアリングが安定してから Phase 3 に進む
- 各Phaseの完了条件を満たしたら、ユーザーに報告して次フェーズの許可を取る
- フィクスチャを充実させることが誤検出防止のカギ
