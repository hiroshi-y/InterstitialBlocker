# 05 — エッジケースとリスク管理

実装中に遭遇する可能性の高い問題と、その対処方針。

---

## 誤検出リスク（False Positive）

### リスク5-1：ログインモーダルを誤爆

**状況**：ユーザーがログインしようとしているときに、モーダルを閉じてしまう。

**対策**：
- スコアリングで `input[type="password"]` を含む要素は強くネガティブ（-10）
- `input[type="email"]` も弱めのネガティブ（-3）
- `form` を含む場合もネガティブ（-2）
- ドメイン由来のスクリプトから生成された要素は、iframe内要素より安全寄り

### リスク5-2：クッキー同意バナーを誤爆

**状況**：GDPR系の同意バナーを勝手に閉じてしまうと法的な問題の温床になる可能性。

**対策**：
- テキスト検査：`cookie`, `consent`, `gdpr`, `privacy policy`, `利用規約` などを含む場合、スコアから-5
- クッキー同意は多くの場合フッター固定で、ビューポート全体は覆わないので、サイズ閾値でも弾ける

### リスク5-3：年齢確認・利用規約モーダル

**状況**：酒類サイトの年齢確認や、初回訪問時の利用規約モーダルを閉じてしまう。

**対策**：
- テキスト検査：`age verification`, `terms of service`, `年齢確認`, `利用規約` を含む場合、強めにネガティブ（-5）
- これらは法的に必須のモーダルなので、少しでも疑わしければ触らない

### リスク5-4：画像ライトボックス

**状況**：ユーザーが画像をクリックして開いたライトボックスを閉じてしまう。

**対策**：
- 単一の大きな画像 + 少ない子要素 → 画像ライトボックスの特徴
- 「最近ユーザーがクリックした要素からトリガーされた」要素は、ユーザー起因のモーダルの可能性が高い
- → ユーザークリックイベントを記録し、その直後に出現した要素は処理をスキップ（例：2秒以内）

```typescript
let lastUserClickAt = 0

document.addEventListener('click', () => {
  lastUserClickAt = Date.now()
}, { capture: true, passive: true })

function wasRecentlyTriggeredByUser(): boolean {
  return Date.now() - lastUserClickAt < 2000
}
```

検出処理の冒頭で `if (wasRecentlyTriggeredByUser()) return` を入れる。

### リスク5-5：チャットボットウィジェット

**状況**：サイトのサポートチャットが大きく開いたときに誤爆。

**対策**：
- これらは通常、右下に固定配置されるので、ビューポート占有率が小さい
- サイズ閾値で自然に弾ける

### リスク5-6：ニュースレターサブスクライブ

**状況**：メール登録を求めるポップアップは広告と見分けにくい。

**対策**：
- `input[type="email"]` を含む場合はネガティブ
- ただし、これは実質的にInterstitialと同じ「ユーザーを止める」ものなので、消してもユーザーの利益になる可能性が高い
- → スコアリングで軽度のペナルティ（-3）に留め、閾値ギリギリで判断

---

## 見逃しリスク（False Negative）

### リスク5-7：非常に低いz-index、あるいはz-indexなしのInterstitial

**対策**：
- z-indexが付いていなくても、`position: fixed` + 画面占有率が高ければスコアが十分つく
- z-indexだけに頼らない

### リスク5-8：Shadow DOM内のInterstitial

**状況**：Web Componentsを使った広告で、閉じるボタンがShadow DOM内にある。

**対策**：
- `element.shadowRoot` が存在する場合、そこも探索対象にする
- 閉じるボタン探索関数にShadow DOM対応を追加
- 今回は段階2の機能としてもよい（MVPでは未対応でも可）

```typescript
function querySelectorDeep(root: Element | Document, selector: string): Element | null {
  const direct = root.querySelector(selector)
  if (direct) return direct
  
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT)
  let node: Node | null
  while (node = walker.nextNode()) {
    if ((node as Element).shadowRoot) {
      const found = querySelectorDeep((node as Element).shadowRoot!.host, selector)
      if (found) return found
    }
  }
  return null
}
```

### リスク5-9：canvas描画されたInterstitial

**状況**：広告全体がcanvasで描画されており、DOM的には1要素しかない。

**対策**：
- MVPでは非対応
- canvasの存在 + 大画面占有率 + 高z-index ならスコア加点できる
- 閉じるボタンの自動クリックは無理 → レイヤー3で強制除去

### リスク5-10：遅延スクリプトで追加されるInterstitial

**状況**：ページロードから数十秒後に遅延挿入される。

**対策**：
- `MutationObserver` は永続的に動作しているので、いつ挿入されてもキャッチできる
- 要件充足

---

## パフォーマンスリスク

### リスク5-11：MutationObserver の大量イベント

**状況**：動的なWebアプリ（SPA、リアルタイム更新等）で大量のDOM変更が発生。

**対策**：
- `scheduleCheck` で 50-100ms debounce
- `getBoundingClientRect` や `getComputedStyle` は重いので、明らかに小さい要素（pre-check）で絞り込む
- `IntersectionObserver` の併用も検討：画面内に入った要素だけを深く調べる

```typescript
// 軽量な pre-filter
function quickFilter(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (!el.isConnected) return false
  
  // 明らかに小さい要素は除外
  const rect = el.getBoundingClientRect()
  if (rect.width < 200 || rect.height < 200) return false
  
  // 明らかに hidden な要素は除外
  if (el.hidden) return false
  
  return true
}
```

### リスク5-12：メモリリーク

**状況**：WeakMap/WeakSet を使っているが、Observer インスタンスがGCされない。

**対策**：
- 各Observerは必ず disconnect() を呼ぶパスを持つ
- setTimeout で最大時間を設定
- 検出済み要素は `processedElements` (WeakSet) に入れて二重処理を防ぐ

---

## セキュリティ・プライバシーリスク

### リスク5-13：ページスクリプトによる拡張の無効化

**状況**：広告スクリプトが拡張の動作を検出し、妨害してくる。

**対策**：
- content script は独立した world で動作（isolated world）。ページ側からは通常アクセスできない
- ただしDOMへの変更は観察可能
- スタイルガードの Observer を仕込んでおくことで、ページ側の style 上書きを検知して再適用

### リスク5-14：ユーザーデータの外部送信

**方針**：しない。
- 検出履歴は `chrome.storage.sync` に保存（ユーザーのGoogleアカウント内のみ）
- 外部サーバーへの通信なし
- テレメトリも収集しない（開発段階ではオフ）

### リスク5-15：権限の過剰要求

**対策**：
- `<all_urls>` は必要だが、`tabs`, `history`, `cookies` 等は要求しない
- permissions を最小限に

---

## UX リスク

### リスク5-16：ユーザーが「自分でクリックしたい」ケース

**状況**：ユーザーがスクリーンショットを撮りたい、閉じるボタンの位置を確認したい、など。

**対策**：
- popup から「このサイトで無効化」を1クリックで実行できるようにする
- 将来的には「このページでは一時無効化」ボタンも

### リスク5-17：検出ロジックの動作がユーザーに見えない

**対策**：
- popup に「直近の検出履歴」を表示
- 何がいつ検出され、どう処理されたかを見せる
- デバッグモード（console ログ）のトグル

---

## 既知の制約事項（MVPで妥協する）

1. **Shadow DOM 対応**：初期は非対応。発見的に追加していく
2. **Firefox 対応**：MVP後
3. **モバイル対応**：スコープ外
4. **広告インプレッションのカウント保証**：保証しない（「動けば良い」方針）
5. **100% の検出精度**：目指さない。ユーザーが調整できる仕組みで補う

---

## 問題解決フロー（ユーザー報告時）

ユーザーから「誤爆した」「見逃した」という報告があった場合：

1. 問題のURLとスクリーンショットを入手
2. ローカルでデバッグモードを有効にして再現
3. console ログから該当要素のスコアと判定経緯を確認
4. スコアリング関数を調整するか、ネガティブ条件を追加
5. テストケースを `tests/fixtures/` に追加
