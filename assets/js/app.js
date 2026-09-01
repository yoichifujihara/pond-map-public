/* ============================================================
   石川県 ため池マップ 公開版
   ------------------------------------------------------------
   ・外部ライブラリは Leaflet のみ（サイト内に配置）
   ・外部通信は国土地理院の地図タイルのみ
   ・JSONの値は createElement / textContent で表示（innerHTML未使用）
   ============================================================ */

(function () {
  'use strict';

  /* ==========================================================
     1. 設定
     必要に応じてこの部分だけを書き換えれば調整できます。
     ========================================================== */

  var CONFIG = {

    /* ため池データ（同一サイト内のファイル） */
    dataUrl: 'data/noto_ponds.json',

    /* 背景地図：国土地理院 淡色地図 */
    tileUrl: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
    tileAttribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>',

    /* 地図右下のライブラリ表記。
       Leaflet 1.9 の既定表記には装飾用の旗の画像が含まれるため、
       文字のみの表記に差し替えています。 */
    attributionPrefix: '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>',

    tileMinZoom: 5,
    tileMaxZoom: 18,

    /* 初期表示時の最大ズーム（データ範囲に合わせて自動調整） */
    initialMaxZoom: 12,
    /* 市町で絞り込んだときの最大ズーム */
    cityMaxZoom: 14,
    /* 1か所を選択したときのズーム */
    focusZoom: 16,

    /* 緯度経度の妥当性チェック範囲（日本国内相当）。
       この範囲外の地点は異常値として表示から除外します。 */
    validArea: { latMin: 30, latMax: 46, lonMin: 128, lonMax: 146 },

    /* データを読み込めなかった場合に地図が真っ白にならないための表示位置。
       通常の初期表示は、データの緯度経度から自動計算します。 */
    fallbackCenter: [37.10, 136.95],
    fallbackZoom: 9,

    /* ため池を示す円の見た目 */
    markerStyle: {
      radius: 5,
      color: '#0b3d6b',
      weight: 1,
      opacity: 1,
      fillColor: '#2f7fd0',
      fillOpacity: 0.85
    },

    /* ポップアップに表示する数値項目。
       ------------------------------------------------------
       ※ 項目名（label）と単位（unit）は元データからは確定できないため、
          正式な項目名・単位が判明した場合はここを書き換えてください。
          unit は '' のままであれば単位を表示しません。
       ------------------------------------------------------ */
    numericFields: [
      { key: 'dam_h', label: '堤高',   unit: '' },
      { key: 'crest', label: '堤頂長', unit: '' },
      { key: 'vol',   label: '貯水量', unit: '' },
      { key: 'area',  label: '面積',   unit: '' }
    ],

    /* ポップアップに表示する外部地図へのリンク。
       ------------------------------------------------------
       ※ URLの形式はここに固定して記述しています。
          JSONから使用するのは lat / lon の数値だけです。
          いずれも「通常のリンク」であり、ページを開いただけでは
          これらのサイトへ通信しません。利用者がリンクを
          クリックしたときにだけ、新しいタブで開きます。
          外部のJavaScript・CSS・API・iframeは使用していません。
       ------------------------------------------------------ */
    externalLinks: [
      {
        label: '地理院地図',
        title: '地理院地図（国土地理院）を新しいタブで開きます',
        url: function (lat, lon) {
          return 'https://maps.gsi.go.jp/#17/' + lat + '/' + lon + '/';
        }
      },
      {
        label: 'Googleマップ',
        title: 'Googleマップを新しいタブで開きます',
        url: function (lat, lon) {
          return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lon;
        }
      },
      {
        label: 'ハザードマップ',
        title: '重ねるハザードマップ（国土交通省）を新しいタブで開きます',
        url: function (lat, lon) {
          return 'https://disaportal.gsi.go.jp/maps/index.html?ll=' + lat + ',' + lon + '&z=15';
        }
      }
    ],

    /* 外部地図リンクの見出し */
    externalLinksLabel: '外部地図で確認',

    /* 値がない場合の表示 */
    emptyText: '－',

    /* 名称検索の候補一覧に表示する最大件数 */
    maxResults: 100
  };


  /* ==========================================================
     2. 状態
     ========================================================== */

  var map = null;
  var pondLayer = null;

  /* entries[i] = { rec: 元レコード, cityName: 検索用市町名,
                    nameKey: 検索用ため池名, marker: circleMarker } */
  var entries = [];
  var visibleEntries = [];
  var initialBounds = null;

  var elCitySelect = document.getElementById('city-select');
  var elNameInput = document.getElementById('name-input');
  var elSearchButton = document.getElementById('search-button');
  var elClearButton = document.getElementById('clear-button');
  var elStatus = document.getElementById('status');
  var elResults = document.getElementById('results');
  var elResultList = document.getElementById('result-list');


  /* ==========================================================
     3. 小さな共通処理
     ========================================================== */

  /* city から括弧より前の現在市町名を取り出す（検索・絞り込み用）
     例： 七尾市（鹿島郡中島町） → 七尾市                       */
  function toCityName(city) {
    var s = (city === null || city === undefined) ? '' : String(city);
    var i = s.search(/[（(]/);
    if (i >= 0) {
      s = s.slice(0, i);
    }
    return s.trim();
  }

  /* 検索用にそろえた文字列にする
     ・全角英数と半角英数の違いを吸収（NFKC正規化）
     ・大文字小文字の違いを吸収                                */
  function toSearchKey(value) {
    var s = (value === null || value === undefined) ? '' : String(value);
    if (typeof s.normalize === 'function') {
      s = s.normalize('NFKC');
    }
    return s.toLowerCase();
  }

  /* 文字列項目の表示値（空なら「－」） */
  function displayText(value) {
    if (value === null || value === undefined) {
      return CONFIG.emptyText;
    }
    var s = String(value).trim();
    return s === '' ? CONFIG.emptyText : s;
  }

  /* 数値項目の表示値（空なら「－」、単位が設定されていれば付ける） */
  function displayNumber(value, unit) {
    if (value === null || value === undefined || value === '') {
      return CONFIG.emptyText;
    }
    if (typeof value === 'number' && !isFinite(value)) {
      return CONFIG.emptyText;
    }
    return String(value) + (unit ? unit : '');
  }

  /* 緯度経度が数値であり、妥当な範囲に収まっているか */
  function hasValidCoords(rec) {
    var a = CONFIG.validArea;
    var lat = rec.lat;
    var lon = rec.lon;
    if (typeof lat !== 'number' || !isFinite(lat)) { return false; }
    if (typeof lon !== 'number' || !isFinite(lon)) { return false; }
    if (lat < a.latMin || lat > a.latMax) { return false; }
    if (lon < a.lonMin || lon > a.lonMax) { return false; }
    return true;
  }

  /* メッセージ表示 */
  function setStatus(message, isError) {
    elStatus.textContent = message;
    if (isError) {
      elStatus.classList.add('is-error');
    } else {
      elStatus.classList.remove('is-error');
    }
  }


  /* ==========================================================
     4. ポップアップ（DOMを組み立てて渡す。HTML文字列は作らない）
     ========================================================== */

  function appendRow(dl, label, value) {
    var dt = document.createElement('dt');
    dt.textContent = label;
    var dd = document.createElement('dd');
    dd.textContent = value;
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  /* 外部地図へのリンク（通常の <a> 要素。window.open は使用しない） */
  function buildExternalLinks(lat, lon) {
    /* 検証済みの数値のみを、桁を固定した文字列にして使用する */
    var la = lat.toFixed(6);
    var lo = lon.toFixed(6);

    var wrap = document.createElement('div');
    wrap.className = 'pond-links';

    var label = document.createElement('span');
    label.className = 'pond-links-label';
    label.textContent = CONFIG.externalLinksLabel;
    wrap.appendChild(label);

    var list = document.createElement('div');
    list.className = 'pond-links-list';

    for (var i = 0; i < CONFIG.externalLinks.length; i++) {
      var def = CONFIG.externalLinks[i];
      var a = document.createElement('a');
      a.textContent = def.label;
      a.title = def.title;
      a.href = def.url(la, lo);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.referrerPolicy = 'no-referrer';
      list.appendChild(a);
    }

    wrap.appendChild(list);
    return wrap;
  }

  function buildPopupContent(rec) {
    var box = document.createElement('div');
    box.className = 'pond-popup';

    var title = document.createElement('h2');
    title.className = 'pond-name';
    title.textContent = displayText(rec.name);
    box.appendChild(title);

    var dl = document.createElement('dl');
    /* 市町はポップアップでは元の値をそのまま表示する */
    appendRow(dl, '市町', displayText(rec.city));
    appendRow(dl, '所在地', displayText(rec.addr));

    for (var i = 0; i < CONFIG.numericFields.length; i++) {
      var f = CONFIG.numericFields[i];
      appendRow(dl, f.label, displayNumber(rec[f.key], f.unit));
    }
    box.appendChild(dl);

    box.appendChild(buildExternalLinks(rec.lat, rec.lon));

    return box;
  }


  /* ==========================================================
     5. 地図の初期化
     ========================================================== */

  function createMap() {
    map = L.map('map', {
      preferCanvas: true,
      minZoom: CONFIG.tileMinZoom,
      maxZoom: CONFIG.tileMaxZoom
    });

    map.setView(CONFIG.fallbackCenter, CONFIG.fallbackZoom);
    map.attributionControl.setPrefix(CONFIG.attributionPrefix);

    L.tileLayer(CONFIG.tileUrl, {
      minZoom: CONFIG.tileMinZoom,
      maxZoom: CONFIG.tileMaxZoom,
      attribution: CONFIG.tileAttribution
    }).addTo(map);

    pondLayer = L.layerGroup().addTo(map);
  }


  /* ==========================================================
     6. データ読み込みと地点作成
     ========================================================== */

  function extractPonds(json) {
    if (json && Object.prototype.toString.call(json.ponds) === '[object Array]') {
      return json.ponds;
    }
    if (Object.prototype.toString.call(json) === '[object Array]') {
      return json;
    }
    return null;
  }

  function buildEntries(records) {
    var skipped = 0;

    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (!rec || typeof rec !== 'object') {
        skipped++;
        continue;
      }
      if (!hasValidCoords(rec)) {
        skipped++;
        continue;
      }

      var marker = L.circleMarker([rec.lat, rec.lon], CONFIG.markerStyle);
      /* ポップアップの中身は開いたときに組み立てる */
      marker.bindPopup(makePopupBuilder(rec));

      entries.push({
        rec: rec,
        cityName: toCityName(rec.city),
        nameKey: toSearchKey(rec.name),
        marker: marker
      });
    }

    return skipped;
  }

  function makePopupBuilder(rec) {
    return function () {
      return buildPopupContent(rec);
    };
  }

  /* 市町プルダウンをデータから作る（データ内の出現順） */
  function fillCitySelect() {
    var seen = {};
    for (var i = 0; i < entries.length; i++) {
      var name = entries[i].cityName;
      if (name === '' || Object.prototype.hasOwnProperty.call(seen, name)) {
        continue;
      }
      seen[name] = true;
      var option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      elCitySelect.appendChild(option);
    }
  }


  /* ==========================================================
     7. 表示の切り替え
     ========================================================== */

  function boundsOf(list) {
    var points = [];
    for (var i = 0; i < list.length; i++) {
      points.push([list[i].rec.lat, list[i].rec.lon]);
    }
    return points.length > 0 ? L.latLngBounds(points) : null;
  }

  function fitTo(bounds, maxZoom) {
    if (!bounds) { return; }
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: maxZoom });
  }

  /* 市町の選択内容に合わせて地図上の地点を入れ替える */
  function showCity(cityName, moveMap) {
    pondLayer.clearLayers();
    visibleEntries = [];

    for (var i = 0; i < entries.length; i++) {
      if (cityName === '' || entries[i].cityName === cityName) {
        pondLayer.addLayer(entries[i].marker);
        visibleEntries.push(entries[i]);
      }
    }

    if (moveMap) {
      if (cityName === '') {
        fitTo(initialBounds, CONFIG.initialMaxZoom);
      } else {
        fitTo(boundsOf(visibleEntries), CONFIG.cityMaxZoom);
      }
    }

    if (cityName === '') {
      setStatus('全 ' + visibleEntries.length + ' か所のため池を表示しています。', false);
    } else {
      setStatus(cityName + '：' + visibleEntries.length + ' か所を表示しています。', false);
    }
  }

  function clearResults() {
    while (elResultList.firstChild) {
      elResultList.removeChild(elResultList.firstChild);
    }
    elResults.hidden = true;
  }

  /* 1か所へ移動してポップアップを開く */
  function focusEntry(entry) {
    map.setView([entry.rec.lat, entry.rec.lon], CONFIG.focusZoom);
    entry.marker.openPopup();
  }

  /* 候補一覧を作る（すべて createElement / textContent） */
  function renderResults(matched) {
    clearResults();

    for (var i = 0; i < matched.length && i < CONFIG.maxResults; i++) {
      var entry = matched[i];

      var button = document.createElement('button');
      button.type = 'button';

      var nameSpan = document.createElement('span');
      nameSpan.textContent = displayText(entry.rec.name);
      button.appendChild(nameSpan);

      var subSpan = document.createElement('span');
      subSpan.className = 'result-sub';
      subSpan.textContent = displayText(entry.rec.city) + '　' + displayText(entry.rec.addr);
      button.appendChild(subSpan);

      button.addEventListener('click', makeResultHandler(entry));

      var li = document.createElement('li');
      li.appendChild(button);
      elResultList.appendChild(li);
    }

    elResults.hidden = false;
  }

  function makeResultHandler(entry) {
    return function () {
      focusEntry(entry);
    };
  }


  /* ==========================================================
     8. 操作
     ========================================================== */

  function onCityChange() {
    clearResults();
    showCity(elCitySelect.value, true);
  }

  function onSearch() {
    var keyword = toSearchKey(elNameInput.value).trim();
    var cityName = elCitySelect.value;

    /* 名称が空のときは市町の絞り込みだけを行う */
    if (keyword === '') {
      clearResults();
      showCity(cityName, true);
      return;
    }

    var matched = [];
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (cityName !== '' && entry.cityName !== cityName) { continue; }
      if (entry.nameKey.indexOf(keyword) >= 0) { matched.push(entry); }
    }

    if (matched.length === 0) {
      clearResults();
      setStatus('該当するため池はありませんでした。', false);
      return;
    }

    if (matched.length === 1) {
      renderResults(matched);
      focusEntry(matched[0]);
      setStatus('該当 1 か所です。', false);
      return;
    }

    renderResults(matched);
    if (matched.length > CONFIG.maxResults) {
      setStatus('該当 ' + matched.length + ' か所のうち、はじめの ' +
        CONFIG.maxResults + ' か所を一覧に表示しています。', false);
    } else {
      setStatus('該当 ' + matched.length + ' か所です。一覧から選んでください。', false);
    }
  }

  function onClear() {
    elCitySelect.value = '';
    elNameInput.value = '';
    clearResults();
    map.closePopup();
    showCity('', true);
  }


  /* ==========================================================
     9. 起動
     ========================================================== */

  function start(json) {
    var records = extractPonds(json);
    if (!records) {
      setStatus('ため池データの形式が正しくありません。', true);
      return;
    }

    var skipped = buildEntries(records);

    if (entries.length === 0) {
      setStatus('表示できるため池データがありませんでした。', true);
      return;
    }

    initialBounds = boundsOf(entries);
    fillCitySelect();

    elCitySelect.addEventListener('change', onCityChange);
    elSearchButton.addEventListener('click', onSearch);
    elClearButton.addEventListener('click', onClear);
    elNameInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        onSearch();
      }
    });

    showCity('', true);

    if (skipped > 0) {
      setStatus('全 ' + entries.length + ' か所のため池を表示しています。' +
        '（位置情報が正しくない ' + skipped + ' 件は表示していません）', false);
    }
  }

  function fail(message) {
    setStatus(message, true);
  }

  function init() {
    createMap();

    /* 同一サイト内のJSONのみを読み込む（URLは固定） */
    fetch(CONFIG.dataUrl, { credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(start)
      .catch(function () {
        fail('ため池データを読み込めませんでした。時間をおいて再度お試しください。');
      });
  }

  init();

}());
