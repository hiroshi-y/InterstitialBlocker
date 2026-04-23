# 手動テストチェックリスト

拡張機能を有効にした状態で、以下のサイトを順に開いて動作を確認する。
各サイトで 30秒〜1分 程度滞在し、ページ遷移も試す。

## 確認観点

各サイトで以下を記録する：

- **Interstitial が出たか** — 出た場合、自動で消えたか
- **誤爆がないか** — 正規のモーダル（ログイン、クッキー同意等）が勝手に消えていないか
- **ページが壊れていないか** — レイアウト崩れ、スクロール異常、クリックできない箇所がないか
- **コンソールログ** — `[InterstitialBlocker]` のログ内容（Detected のスコアと対象）

## Layer 1 CSS の副作用確認

Layer 1 の予防的CSSは全ページに適用される。以下に注意：

- [ ] `position: static !important` により、意図的な `position: fixed/absolute` の body レイアウトが崩れていないか
- [ ] `overflow: auto !important` により、意図的にスクロールを隠しているページのレイアウトが崩れていないか
- [ ] `[class*="interstitial"]` で正規コンテンツが非表示になっていないか

## テスト対象サイト

### ニュースサイト

- [ ] CNN (cnn.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] BBC (bbc.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] 日経 (nikkei.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] 朝日新聞 (asahi.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] Yahoo! Japan (yahoo.co.jp) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] Yahoo! News (news.yahoo.co.jp) — Interstitial: ___  誤爆: ___  レイアウト: ___

### テック系メディア

- [ ] TechCrunch (techcrunch.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] The Verge (theverge.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] GIGAZINE (gigazine.net) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] ITmedia (itmedia.co.jp) — Interstitial: ___  誤爆: ___  レイアウト: ___

### ブログ / コンテンツ系

- [ ] Medium (medium.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] note (note.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] Qiita (qiita.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] Zenn (zenn.dev) — Interstitial: ___  誤爆: ___  レイアウト: ___

### 生活系

- [ ] クックパッド (cookpad.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] 食べログ (tabelog.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] tenki.jp (tenki.jp) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] 価格.com (kakaku.com) — Interstitial: ___  誤爆: ___  レイアウト: ___

### 動画 / SNS

- [ ] YouTube (youtube.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] X / Twitter (x.com) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] Reddit (reddit.com) — Interstitial: ___  誤爆: ___  レイアウト: ___

### ECサイト

- [ ] Amazon (amazon.co.jp) — Interstitial: ___  誤爆: ___  レイアウト: ___
- [ ] 楽天 (rakuten.co.jp) — Interstitial: ___  誤爆: ___  レイアウト: ___

### ログイン動作

以下のサイトでログインモーダルが**消されないこと**を確認：

- [ ] GitHub (github.com) — ログインボタン押下 → モーダルが残る
- [ ] Google (accounts.google.com) — ログインフォームが残る

## 問題が見つかった場合

1. 問題のURL、スクリーンショット、コンソールログをメモ
2. 開発者に報告（スコアの値、対象要素のタグ/クラス/IDが重要）
3. 必要に応じてスコアリング関数のネガティブ条件追加、または閾値調整

## 記録テンプレート

```
サイト: ○○○
URL: https://...
結果: OK / NG
詳細:
  - Interstitial 検出: あり/なし → 自動閉じ成功/失敗
  - 誤爆: なし / あり（対象要素: ___）
  - レイアウト崩れ: なし / あり（詳細: ___）
  - コンソールログ: (貼り付け)
```
