# SECURITY.md
# 石川県 ため池マップ 公開版 — セキュリティ説明書

本書は、石川県の情報システム・セキュリティ担当者向けに、
本コンテンツの構成とセキュリティ上の性質を説明するものです。

- 対象：石川県 ため池マップ 公開版
- 形態：静的Webコンテンツ（HTML / CSS / JavaScript / JSON）
- 使用ライブラリ：Leaflet 1.9.4（サイト内に配置）

---

## 1. 構成の概要

| 項目 | 内容 |
| --- | --- |
| サイト形態 | 完全な静的Webサイト |
| サーバサイド処理 | **なし**（PHP・Python・Node.js等を使用しない） |
| データベース | **なし** |
| 認証・ログイン | **なし** |
| Cookie | **使用しない** |
| LocalStorage / SessionStorage / IndexedDB | **使用しない** |
| 利用者情報の収集 | **なし**（フォーム送信・問い合わせ機能なし） |
| 個人情報の取り扱い | **なし** |
| 位置情報（Geolocation API / GPS） | **使用しない** |
| ファイルアップロード | **なし** |
| アクセス解析・タグマネージャ | **なし** |
| SNS連携・埋め込み | **なし** |
| Service Worker / PWA | **なし** |
| 外部JavaScript | **なし**（CDN不使用） |
| 外部CSS・外部Webフォント | **なし**（OS標準フォントのみ） |
| iframe | **なし**（外部地図の埋め込みなし） |
| 外部地図サイトへのリンク | **あり**（通常の `<a>` リンクのみ。クリック時のみ遷移。→ 2-2） |
| APIキー・トークン・秘密情報 | **一切含まない** |

サーバ側で必要なのは静的ファイルの配信のみです。
書き込み可能なディレクトリ、実行権限、追加のミドルウェアは不要です。

---

## 2. 外部通信

「ページ表示時に自動的に発生する通信」と「利用者のクリックによる遷移」を
明確に区別しています。

### 2-1. ページ表示時に自動的に発生する通信

**背景地図タイルの取得 1 件のみ**です。

| 通信先 | 用途 | 種別 | 送信内容 |
| --- | --- | --- | --- |
| `https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png` | 国土地理院 淡色地図（背景地図） | 画像（GET） | タイル座標のみ。利用者の入力値・個人情報は送信しない |

上記以外の外部ドメインへは、スクリプト・スタイル・画像・
XHR / fetch・WebSocket のいずれの方法でも通信しません。

### 2-2. 外部リンク（利用者がクリックした場合のみ遷移）

各ため池のポップアップに、次の3サイトへの**通常の `<a>` リンク**があります。

| リンク先 | サイト名 | URL形式（コード内で固定） |
| --- | --- | --- |
| `maps.gsi.go.jp` | 地理院地図（国土地理院） | `https://maps.gsi.go.jp/#17/{lat}/{lon}/` |
| `www.google.com/maps` | Googleマップ | `https://www.google.com/maps/search/?api=1&query={lat},{lon}` |
| `disaportal.gsi.go.jp` | 重ねるハザードマップ（国土交通省） | `https://disaportal.gsi.go.jp/maps/index.html?ll={lat},{lon}&z=15` |

これらは次の構成です。

- **iframe 埋め込みではありません**（ページ内に `<iframe>` は 1 つも存在しません）
- **API連携ではありません**（Google Maps JavaScript API / Embed API / SDK いずれも不使用）
- **外部JavaScriptを読み込みません**
- **外部CSSを読み込みません**
- **ページ表示時に自動通信しません**（Google および disaportal への通信は 0 件）
- **利用者がリンクをクリックした場合のみ**、新しいタブで遷移します
- **APIキーは使用しません**

各リンクには次の属性を付与しています。

```html
target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"
```

`rel="noopener"` により遷移先から元ページ（`window.opener`）を操作できません。
`rel="noreferrer"` と `referrerpolicy="no-referrer"` により、
**遷移先へリファラ（閲覧中ページのURL）を送信しません**。
`window.open()` は使用せず、通常の `<a>` 要素のみを使用しています。

URL は `assets/js/app.js` の `externalLinks` にコード内固定で記述しており、
JSON から使用するのは**検証済みの `lat` / `lon` の数値のみ**です。
数値は `toFixed(6)` により桁を固定した文字列に変換してから埋め込むため、
URL に含まれるのは数字・小数点・符号のみです。
JSON 側の値でリンク先ドメインを差し替えることはできません。

同一オリジンで読み込むファイルは次のとおりです。

- `index.html`
- `assets/css/style.css`
- `assets/js/app.js`
- `assets/vendor/leaflet/leaflet.css`
- `assets/vendor/leaflet/leaflet.js`
- `assets/vendor/leaflet/images/*.png`（Leaflet付属画像）
- `data/noto_ponds.json`

`fetch()` の呼び出しは `data/noto_ponds.json` の 1 か所のみで、
URL はソースコード中に固定されています。
URL パラメータやユーザー入力から通信先を組み立てる処理はありません。

> 庁内ネットワークからの公開検証時は、`cyberjapandata.gsi.go.jp`
> への HTTPS 通信が許可されている必要があります。

---

## 3. Leaflet の取り扱い

- バージョン：**Leaflet 1.9.4**
- ライセンス：BSD 2-Clause License（`LICENSES/leaflet-license.txt`）
- 配置：`assets/vendor/leaflet/` にサイト内配置。CDNからは読み込みません。
- 入手元：Leaflet 公式配布物（`leaflet.js` / `leaflet.css` および付属画像）
- 改変：`leaflet.js` 末尾の `//# sourceMappingURL=leaflet.js.map` の
  1 行のみ削除しています。ソースマップファイルを同梱しないため、
  この行が残っていると開発者ツール使用時に 404 が発生するためです。
  それ以外のコードは公式配布物と同一です。
- MarkerCluster 等の追加プラグインは使用していません。

---

## 4. スクリプトの安全性

以下は**使用していません**。

- `eval()`
- `new Function()`
- `setTimeout` / `setInterval` への文字列渡し
- `document.write()`
- JSONP
- 動的な `<script>` 要素の生成
- `innerHTML` / `outerHTML` / `insertAdjacentHTML`
- `document.location` 等への外部由来値の代入
- `window.open()`（外部地図へは通常の `<a>` リンクのみを使用）
- `<iframe>`（外部サイトの埋め込みは一切なし）

### JSON値の画面表示

`data/noto_ponds.json` に含まれる文字列（ため池名・市町名・所在地）は、
**HTML文字列へ連結せず**、すべて次の方法で表示しています。

```js
var dd = document.createElement('dd');
dd.textContent = value;          // textContent のみを使用
```

Leaflet のポップアップについても、HTML文字列ではなく
`document.createElement()` で組み立てた **DOM要素**を渡しています
（`assets/js/app.js` の `buildPopupContent()`）。
検索結果一覧も同様に DOM 生成のみで構築しています。

このため、JSON 側に HTML やスクリプトに見える文字列が混入しても、
すべて文字として表示されるだけで、実行されることはありません。

外部地図へのリンクについても同様に、`document.createElement('a')` で生成し、
`textContent` / `href` / `target` / `rel` / `referrerPolicy` を個別に設定しています
（`assets/js/app.js` の `buildExternalLinks()`）。
HTML文字列の組み立ては行っていません。

なお、Leaflet へ HTML 文字列として渡しているのは、地図右下の出典表示
（国土地理院へのリンク、および Leaflet へのリンク）の 2 つの固定文字列だけです。
いずれも `assets/js/app.js` の先頭に定数として記述しており、
JSON・利用者入力・URL 由来の値は一切含みません。

### 利用者入力の取り扱い

利用者が入力できるのは「ため池名」の検索文字列のみです。
入力値は次の用途にのみ使用します。

1. `String.prototype.normalize('NFKC')` と `toLowerCase()` による正規化
2. `String.prototype.indexOf()` による部分一致判定

入力値を、HTML・URL・正規表現・コードとして解釈する処理はありません。
サーバへ送信することもありません。

### URLパラメータ

URL のクエリ文字列・ハッシュを読み取る処理はありません。
URL から外部リソースを読み込むこともありません。

---

## 5. データの検証

`data/noto_ponds.json` の各レコードについて、表示前に次を確認しています。

- `lat` が有限の数値であること
- `lon` が有限の数値であること
- 緯度が 30〜46 の範囲内であること
- 経度が 128〜146 の範囲内であること（日本国内相当）

条件を満たさないレコードは**その1件のみを表示対象から除外**し、
処理を継続します。1件の不正データでページ全体が停止することはありません。

数値項目（`dam_h` / `crest` / `vol` / `area`）が `null` の場合は
「－」と表示します。

---

## 6. Content Security Policy（CSP）

`index.html` の `<head>` 内に `<meta http-equiv="Content-Security-Policy">`
として、次のポリシーを設定済みです。

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data: https://cyberjapandata.gsi.go.jp;
connect-src 'self';
font-src 'self';
object-src 'none';
frame-src 'none';
base-uri 'none';
form-action 'none'
```

- インライン `<script>`、インライン `<style>`、
  `onclick` 等のインラインイベントハンドラは**一切使用していません**。
  そのため `'unsafe-inline'` / `'unsafe-eval'` は不要です。
- `img-src` の `data:` は Leaflet が内部で使用する
  空画像（`data:image/gif;base64,...`）のために必要です。
- `connect-src 'self'` により、`fetch()` の通信先は同一オリジンに限定されます。
- **外部リンク（2-2）の追加にあたって、CSPは一切緩めていません。**
  通常の `<a>` によるページ遷移は、外部スクリプト・スタイル・画像・iframe の
  読み込みとは異なり、`script-src` / `connect-src` / `img-src` / `frame-src`
  のいずれの制限も受けません。したがって `maps.gsi.go.jp`、`www.google.com`、
  `disaportal.gsi.go.jp` は**CSPに追加していません**。
  仮に将来これらを iframe や API で読み込もうとしても、
  現在のCSPがそれを拒否します。

### Webサーバ側で設定していただきたいHTTPヘッダー（推奨）

`<meta>` によるCSPは有効ですが、HTTPヘッダーで設定すると
`frame-ancestors` など `<meta>` では指定できない項目も有効になります。
可能であれば、Webサーバ側で以下のヘッダーの設定をご検討ください。

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://cyberjapandata.gsi.go.jp; connect-src 'self'; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: SAMEORIGIN
Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=(), usb=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

補足

- `frame-ancestors` は、他サイトへの iframe 埋め込みを防ぎます。
  県の別ページに埋め込む場合は `'self'` のままで問題ありません。
- `Referrer-Policy: no-referrer` により、地図タイル取得時に
  閲覧中ページのURLが国土地理院側へ送信されなくなります。
- `Strict-Transport-Security` は、サイト全体をHTTPSで運用している場合のみ
  設定してください。
- 上記ヘッダーはサイト全体の既存ポリシーと競合する場合があります。
  既存設定を優先し、必要に応じて調整してください。
- 本コンテンツは `<meta>` のCSPだけでも動作します。
  ヘッダーを設定しない場合でも公開に支障はありません。

### MIMEタイプ

`.json` が `application/json` として配信されることをご確認ください。
一部のサーバでは既定で設定されていない場合があります。

---

## 7. 掲載情報について

掲載しているのは、農業用ため池の名称・市町・所在地・
位置（緯度経度）および数値諸元です。
個人名、連絡先、その他の個人情報は含みません。

ため池の位置情報の公開範囲については、
本書の対象外（所管部署のご判断）となります。

---

## 8. 更新・保守

- データ更新は `data/noto_ponds.json` の差し替えのみです。
  プログラムの変更は不要です。
- Leaflet に脆弱性情報が公表された場合は、
  `assets/vendor/leaflet/` 配下のファイルを
  公式配布物の新しいバージョンへ差し替えてください。
  最新情報は https://github.com/Leaflet/Leaflet/releases をご確認ください。
- ビルド作業（npm 等）は不要です。ソースコードがそのまま配信物です。

以上
