# ゆめかわ★ウイルス・ぽっぷ（情報処理科2年 3班）

## 1. 概要

学園祭に来る高校生向けの、ブラウザで遊ぶリズムゲームです。
落ちてくるかわいいウイルスを、音楽に合わせてキー（D・F・J・K）で叩いてやっつけます。

- **解決したい課題**：「ITの展示はむずかしそうで近づきにくい」
- **解決のしかた**：ゆめかわなキャラクター＋知っている曲＋キーを押すだけ。1曲30秒〜1分で遊べる
- ウイルスの名前（ランサム・フィッシング・DDoS）から、セキュリティの言葉に自然にふれられる
- 曲は6曲（★1〜6）：きらきら星・よろこびのうた・ジングルベル・ねこふんじゃった・ジ・エンターテイナー・天国と地獄
- 本日のトップ3（曲ごとのランキング）と、認定証風のリザルト画面

## 2. 開発環境・技術スタック

| 項目 | 内容 |
| --- | --- |
| フロントエンド | HTML5、CSS3、JavaScript（vanilla。フレームワーク・外部ライブラリなし） |
| 描画 | DOM＋CSS（ゲームの更新は `requestAnimationFrame`） |
| 音 | Web Audio API で合成（音声ファイルなし） |
| 保存 | LocalStorage（曲ごとのランキング） |
| サーバー・DB | 使わない（完全ローカル。`index.html` を開くだけ） |
| フォント | M PLUS Rounded 1c を `fonts/` に同梱（SIL OFL 1.1） |
| バージョン管理 | Git・GitHub（ブランチ → プルリクエスト → マージ）、SourceTree |
| AI共創パートナー | Google Gemini、Claude（Anthropic）、Claude Code（Anthropic）、ChatGPT（OpenAI）。班の3人全員が、企画・要件定義・実装・テストの各工程で使用 |

## 3. ディレクトリ構造・起動手順

**Git リポジトリ**：https://github.com/norigoe/terafes_03 【public にしてから提出】

```
terafes_03/
├─ README.md       このファイル（アプリの説明・起動手順）
├─ index.html      4つの画面の入れ物（タイトル・セレクト・プレイ・リザルト）
├─ style.css       全体・タイトル・セレクト・プレイ画面の見た目
├─ chara.css       キャラ（ウイルス3体）の見た目
├─ result.css      リザルト画面（認定証）の見た目
├─ charts.js       曲データ SONGS
├─ ranking.js      ランキングの保存・読み込み
├─ tips.js         セキュリティ豆知識
├─ screens.js      画面の切り替え・キー入力の振り分け
├─ audio.js        伴奏・叩いた音（Web Audio API）
├─ view.js         プレイ画面の部品（レーン・ウイルス・演出）
├─ game.js         譜面・判定・スコア・HP
├─ images/         タイトル画面の絵
├─ fonts/          フォントとライセンス
└─ docs/           企画書・要件定義書・仕様書・テスト仕様書
```

**起動手順**

1. リポジトリをダウンロード（または clone）する
2. `index.html` を Chrome で開く（サーバー不要）
3. タイトル画面で Enter → 数字キーで曲を選ぶ → Space でスタート → D・F・J・K で叩く

## 4. チームと担当

| 名前 | 担当 | ファイル |
| --- | --- | --- |
| 松井（班長） | 画面・ランキング | index.html・style.css・chara.css・screens.js・ranking.js・images/ |
| 岡野 | リザルト画面・豆知識・テスト | result.css・tips.js・テスト仕様書 |
| 中山 | プレイ画面（ゲームの中心）・曲・音 | charts.js・audio.js・view.js・game.js |
