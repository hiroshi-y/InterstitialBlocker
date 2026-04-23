# Privacy Policy / プライバシーポリシー

*Last updated / 最終更新: 2026-04-23*

---

## English

### InterstitialBlocker Privacy Policy

InterstitialBlocker is a browser extension that automatically dismisses interstitial advertisements. This privacy policy explains how the extension handles user data.

#### Data Collection

InterstitialBlocker does **not** collect, transmit, or share any personal data. All processing occurs entirely within your browser.

#### Data Stored Locally

The following data is stored locally on your device using the browser's built-in storage (`chrome.storage.sync`):

- **Extension settings**: Enabled/disabled state, detection sensitivity threshold, and debug logging preference.
- **Whitelist**: A list of domains where you have chosen to disable the extension.
- **Detection history**: A record of recent interstitial detections (up to 100 entries), including the domain, timestamp, detection score, and resolution method. This data is stored solely to help you review the extension's activity.

This data syncs across your browsers only if you are signed into Chrome/Edge sync. It is never sent to any external server.

#### Permissions

- **`<all_urls>` / Host permissions**: Required to detect and dismiss interstitial ads on any website you visit. The extension does not read or modify page content other than interstitial overlays.
- **`storage`**: Used to save your settings and detection history locally.
- **`activeTab` / `tabs`**: Used to display the current domain in the popup and manage per-site whitelist settings.

#### Third-Party Services

InterstitialBlocker does not use any third-party analytics, tracking, or advertising services.

#### Changes to This Policy

If this policy is updated, the changes will be reflected in the extension's repository and store listing.

#### Contact

If you have questions about this privacy policy, please open an issue on the project's GitHub repository.

---

## 日本語

### InterstitialBlocker プライバシーポリシー

InterstitialBlockerは、インターステーシャル広告を自動的に閉じるブラウザ拡張機能です。本ポリシーでは、本拡張機能がユーザーデータをどのように取り扱うかについて説明します。

#### データの収集

InterstitialBlockerは、個人データの収集、送信、共有を**一切行いません**。すべての処理はお使いのブラウザ内で完結します。

#### ローカルに保存されるデータ

以下のデータが、ブラウザの組み込みストレージ（`chrome.storage.sync`）を使用してお使いのデバイスにローカル保存されます：

- **拡張機能の設定**: 有効/無効の状態、検出感度の閾値、デバッグログの設定。
- **ホワイトリスト**: 拡張機能を無効にしたドメインの一覧。
- **検出履歴**: 最近のインターステーシャル検出の記録（最大100件）。ドメイン、タイムスタンプ、検出スコア、解決方法が含まれます。このデータは拡張機能の動作を確認するためにのみ保存されます。

これらのデータは、Chrome/Edgeの同期にサインインしている場合にのみブラウザ間で同期されます。外部サーバーに送信されることはありません。

#### 権限

- **`<all_urls>` / ホスト権限**: 訪問する任意のウェブサイトでインターステーシャル広告を検出・閉じるために必要です。拡張機能はインターステーシャルのオーバーレイ以外のページコンテンツを読み取ったり変更したりしません。
- **`storage`**: 設定と検出履歴をローカルに保存するために使用します。
- **`activeTab` / `tabs`**: ポップアップに現在のドメインを表示し、サイトごとのホワイトリスト設定を管理するために使用します。

#### サードパーティサービス

InterstitialBlockerは、サードパーティのアナリティクス、トラッキング、広告サービスを一切使用しません。

#### ポリシーの変更

本ポリシーが更新された場合、拡張機能のリポジトリおよびストア掲載ページに反映されます。

#### お問い合わせ

本プライバシーポリシーについてご質問がある場合は、プロジェクトのGitHubリポジトリでIssueを作成してください。
