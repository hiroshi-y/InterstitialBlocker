# InterstitialBlocker

デスクトップブラウザ（Chrome / Firefox）向けの拡張機能プロジェクト。
**Interstitial広告のみ**をターゲットに、ユーザーがそれを見なくて済むようにする。

---

## Claude Code への最初の指示

このプロジェクトは、安川氏とClaude（Anthropic）の設計ディスカッションを経て立ち上げられました。
あなた（Claude Code）は、設計書に従って実装を進めてください。

**作業開始前に必ず以下のドキュメントを順に読んでください：**

1. `docs/01-project-purpose.md` — プロジェクトの目的と、**やらないこと**
2. `docs/02-approach-overview.md` — なぜこのアプローチを選んだか
3. `docs/03-architecture.md` — 概要設計（4層アーキテクチャ）
4. `docs/04-detailed-design.md` — 各レイヤーの詳細設計
5. `docs/05-edge-cases-and-risks.md` — 気をつけること
6. `docs/06-development-plan.md` — 開発の進め方（MVP → 拡張）
7. `docs/07-claude-code-instructions.md` — あなた宛ての具体的な作業指示

**最重要の原則：**

- このプロジェクトは**広告ブロッカーではない**。Interstitialだけを対象にする。
- DOMパターンマッチング（広告ネットワークごとのセレクタ辞書）は**採用しない**。過去のプロジェクトで限界に突き当たったため。
- 代わりに、**視覚的特徴（position, z-index, 画面占有率など）によるスコアリング**で判定する。
- 正規のモーダル（ログイン、クッキー同意、ライトボックス等）を**誤爆しないこと**が重要。

---

## プロジェクト構造（予定）

```
InterstitialBlocker/
├── README.md                    # このファイル
├── docs/                        # 設計書一式
│   ├── 01-project-purpose.md
│   ├── 02-approach-overview.md
│   ├── 03-architecture.md
│   ├── 04-detailed-design.md
│   ├── 05-edge-cases-and-risks.md
│   ├── 06-development-plan.md
│   └── 07-claude-code-instructions.md
├── src/                         # ソースコード（Claude Codeが作成）
│   ├── manifest.json
│   ├── content/
│   │   ├── index.ts             # エントリポイント
│   │   ├── layer1-css.ts        # 予防的CSS注入
│   │   ├── layer2-detector.ts   # 視覚特徴検出
│   │   ├── layer3-remover.ts    # 強制除去
│   │   ├── layer4-tracker.ts    # 遅延閉じるボタン対応
│   │   ├── close-button.ts      # 閉じるボタン探索
│   │   └── utils.ts
│   ├── background/
│   │   └── service-worker.ts
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   └── assets/
│       ├── layer1.css           # 事前注入CSS
│       └── icons/
├── tests/                       # テスト
│   └── fixtures/                # 検出テスト用のHTMLモック
├── package.json
├── tsconfig.json
└── vite.config.ts               # or webpack等のビルド設定
```

---

## 開発環境

- Node.js 20+
- TypeScript
- Manifest V3（Chrome）/ MV3互換（Firefox は最新で対応）
- ビルドツールは Vite + `@crxjs/vite-plugin` を推奨

---

## ディスカッション経緯の要約

- 過去プロジェクトでは「ブラウザデバッグポート接続 + DOMパターンマッチング」でフィルタリング → **広告ネットワーク差異とDOM構造変動で限界**
- VPN / Proxy / DNSブロックは「広告ブロッカー」に近づきすぎるため不採用
- 視覚特性（CSS）は広告ネットワーク間で共通しやすい、という観察から**視覚特徴ベースの検出**を採用
- 「閉じるボタンをクリックして消す」+「フォールバックで強制除去」の多層防御

詳細は `docs/02-approach-overview.md` 参照。
