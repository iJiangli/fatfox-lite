/* newtab.js — Fatfox Lite 新标签页主逻辑 */
(function () {
  'use strict';

  var L = window.Lunar;
  var STORAGE_KEY = 'fatfoxLite.settings';
  var FEEDBACK_URL = 'https://github.com/iJiangli/fatfox-lite/issues/new';

  var ENGINES = {
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
    baidu: { name: '百度', url: 'https://www.baidu.com/s?wd=' },
    google: { name: 'Google', url: 'https://www.google.com/search?q=' },
    duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    sogou: { name: '搜狗', url: 'https://www.sogou.com/web?query=' },
    so360: { name: '360', url: 'https://www.so.com/s?q=' }
  };

  var DEFAULT_SETTINGS = {
    wallpaper: {
      type: 'video',
      src: 'assets/wallpapers/cherry.mp4',
      poster: 'assets/wallpapers/cherry.jpg'
    },
    maskOpacity: 0,
    clock: {
      show: true,
      showSeconds: true,
      hour12: false,
      showDate: true,
      showLunar: true
    },
    search: { engine: 'bing' },
    icons: [
      { title: 'browserleaks', url: 'https://browserleaks.com/' },
      { title: 'cloudflare', url: 'https://1.1.1.1/' },
      { title: '在线PS', url: 'https://www.uupoop.com/' },
      { title: 'muse', url: 'https://musetransfer.com/' },
      { title: 'status', url: 'https://status.deepseek.com/' }
    ],
    dock: [
      { title: 'GitHub', url: 'https://github.com/' },
      { title: 'B站', url: 'https://www.bilibili.com/' },
      { title: '知乎', url: 'https://www.zhihu.com/' },
      { title: 'YouTube', url: 'https://www.youtube.com/' },
      { title: '网易云', url: 'https://music.163.com/' }
    ],
    note: { enabled: true, text: '' }
  };

  var settings = null;
  var saveTimer = null;

  /* ---------------- 存储 ---------------- */

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function mergeSettings(base, incoming) {
    var out = clone(base);
    if (!incoming || typeof incoming !== 'object') return out;
    Object.keys(incoming).forEach(function (k) {
      var v = incoming[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = mergeSettings(out[k], v);
      } else if (v !== undefined) {
        out[k] = v;
      }
    });
    return out;
  }

  function loadSettings() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(STORAGE_KEY, function (res) {
          var stored = res && res[STORAGE_KEY];
          settings = mergeSettings(DEFAULT_SETTINGS, stored);
          resolve(settings);
        });
      } catch (e) {
        settings = clone(DEFAULT_SETTINGS);
        resolve(settings);
      }
    });
  }

  function saveSettings() {
    try {
      var payload = {};
      payload[STORAGE_KEY] = settings;
      chrome.storage.local.set(payload);
    } catch (e) {
      /* 忽略：无 chrome API 时用内存态 */
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveSettings();
    }, 250);
  }

  /* ---------------- 工具 ---------------- */

  function $(id) {
    return document.getElementById(id);
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return '';
    }
  }

  function initialOf(title, url) {
    var s = (title || hostOf(url) || '?').trim();
    return s.charAt(0);
  }

  function faviconUrl(url, size) {
    try {
      return chrome.runtime.getURL('/_favicon/?pageUrl=' + encodeURIComponent(url) + '&size=' + (size || 64));
    } catch (e) {
      return '';
    }
  }

  // 直连站点自己的 /favicon.ico —— 扩展里 _favicon 失效时（或直接用网页预览时）兜底
  function siteFavicon(url) {
    try {
      return new URL(/^[a-z]+:\/\//i.test(url) ? url : 'https://' + url).origin + '/favicon.ico';
    } catch (e) {
      return '';
    }
  }

  function openUrl(url, newTab) {
    if (!url) return;
    var full = /^[a-z]+:\/\//i.test(url) ? url : 'https://' + url;
    if (newTab) {
      window.open(full, '_blank', 'noopener');
    } else {
      location.href = full;
    }
  }

  /* ---------------- 时钟 ---------------- */

  function renderClock() {
    var now = new Date();
    var clock = settings.clock;
    var clockEl = $('clock');
    clockEl.hidden = !clock.show;
    if (!clock.show) return;

    var h = now.getHours();
    var suffix = '';
    if (clock.hour12) {
      suffix = h < 12 ? ' AM' : ' PM';
      h = h % 12;
      if (h === 0) h = 12;
    }
    var time = clock.hour12 ? String(h) : pad2(h);
    time += ':' + pad2(now.getMinutes());
    if (clock.showSeconds) time += ':' + pad2(now.getSeconds());
    $('clockTime').textContent = time + suffix;

    var dateParts = [];
    if (clock.showDate) {
      dateParts.push(
        now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日'
      );
      dateParts.push('星期' + L.weekdays[now.getDay()]);
    }
    $('clockDate').textContent = dateParts.join(' ');
    $('clockDate').hidden = dateParts.length === 0;

    var lunarText = '';
    if (clock.showLunar && L) {
      var fest = L.festivalOf(now);
      lunarText = fest || L.lunarDateText(now);
    }
    $('clockLunar').textContent = lunarText;
    $('clockDot').textContent = lunarText && dateParts.length ? '·' : '';
  }

  /* ---------------- 搜索 ---------------- */

  function renderSearch() {
    var engine = ENGINES[settings.search.engine] || ENGINES.bing;
    $('searchEngineLabel').textContent = engine.name;
  }

  function doSearch() {
    var q = $('searchInput').value.trim();
    if (!q) return;
    var engine = ENGINES[settings.search.engine] || ENGINES.bing;
    location.href = engine.url + encodeURIComponent(q);
  }

  /* ---------------- 图标 / Dock ---------------- */

  function buildTile(item, cls) {
    var el = document.createElement('a');
    el.className = cls;
    el.href = /^[a-z]+:\/\//i.test(item.url) ? item.url : 'https://' + item.url;
    el.dataset.title = item.title || hostOf(item.url);
    el.title = item.title || '';

    var isIcon = cls === 'icon-item';
    var tile = document.createElement(isIcon ? 'div' : 'span');
    if (isIcon) tile.className = 'icon-tile';

    // 初始就放字母兜底，favicon 加载成功后再替换，避免空白方块
    var fb = document.createElement('span');
    fb.className = 'fallback';
    fb.textContent = initialOf(item.title, item.url);
    tile.appendChild(fb);

    var src = faviconUrl(item.url, 64) || siteFavicon(item.url);
    if (src) {
      var icon = document.createElement('img');
      icon.alt = '';
      // 先试扩展的 _favicon 缓存，失败再直连站点 favicon.ico，仍失败就留着字母兜底
      icon.onerror = function () {
        var alt = siteFavicon(item.url);
        if (alt && icon.src !== alt) {
          icon.src = alt;
          return;
        }
        if (icon.parentNode) icon.remove();
        if (fb.parentNode !== tile) tile.appendChild(fb);
      };
      icon.onload = function () {
        if (fb.parentNode === tile) tile.removeChild(fb);
        if (!icon.parentNode) tile.appendChild(icon);
      };
      icon.src = src;
    }

    el.appendChild(tile);
    if (isIcon) {
      var label = document.createElement('span');
      label.className = 'icon-label';
      label.textContent = item.title || hostOf(item.url);
      el.appendChild(label);
    }
    return el;
  }

  function renderIcons() {
    var box = $('icons');
    box.textContent = '';
    (settings.icons || []).forEach(function (item) {
      box.appendChild(buildTile(item, 'icon-item'));
    });
  }

  function renderDock() {
    var box = $('dock');
    box.textContent = '';
    (settings.dock || []).forEach(function (item) {
      box.appendChild(buildTile(item, 'dock-item'));
    });
  }

  /* ---------------- 便签 ---------------- */

  var noteSaveTimer = null;

  function renderNote() {
    var card = $('noteCard');
    card.hidden = !settings.note.enabled;
    if (!settings.note.enabled) return;
    var body = $('noteBody');
    body.setAttribute('data-placeholder', '在这里记点什么…');
    if (body.textContent !== settings.note.text) {
      body.textContent = settings.note.text || '';
    }
  }

  function bindNote() {
    var body = $('noteBody');
    body.addEventListener('input', function () {
      settings.note.text = body.textContent;
      if (noteSaveTimer) clearTimeout(noteSaveTimer);
      noteSaveTimer = setTimeout(function () {
        noteSaveTimer = null;
        saveSettings();
        var tip = $('noteTip');
        tip.classList.add('show');
        setTimeout(function () {
          tip.classList.remove('show');
        }, 1200);
      }, 400);
    });
    body.addEventListener('paste', function (ev) {
      ev.preventDefault();
      var text = (ev.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
  }

  /* ---------------- 壁纸 ---------------- */

  function renderWallpaper() {
    var wp = $('wallpaper');
    var w = settings.wallpaper || DEFAULT_SETTINGS.wallpaper;
    wp.textContent = '';

    if (w.type === 'video' && w.src) {
      var v = document.createElement('video');
      v.src = w.src;
      if (w.poster) v.poster = w.poster;
      v.autoplay = true;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      v.addEventListener('error', function () {
        wp.textContent = '';
        wp.style.backgroundImage = w.poster ? 'url("' + w.poster + '")' : '';
      });
      wp.appendChild(v);
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    } else if (w.src) {
      wp.style.backgroundImage = 'url("' + w.src + '")';
    } else {
      wp.style.backgroundImage = '';
    }

    document.documentElement.style.setProperty('--mask-opacity', (settings.maskOpacity || 0) / 100);
  }

  /* ---------------- 设置面板 ---------------- */

  var PAGES = [
    { id: 'wallpaper', title: '壁纸', render: renderPageWallpaper },
    { id: 'icons', title: '图标', render: renderPageIcons },
    { id: 'search', title: '搜索', render: renderPageSearch },
    { id: 'clock', title: '时间', render: renderPageClock },
    { id: 'note', title: '便签', render: renderPageNote },
    { id: 'data', title: '重置', render: renderPageData },
    { id: 'about', title: '问题反馈', render: renderPageAbout }
  ];
  var currentPage = 'wallpaper';

  function openModal(page) {
    currentPage = page || currentPage;
    $('modal').hidden = false;
    renderNav();
    renderPage();
  }

  function closeModal() {
    $('modal').hidden = true;
  }

  function renderNav() {
    var nav = $('modalNav');
    nav.textContent = '';
    PAGES.forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'nav-item' + (p.id === currentPage ? ' active' : '') + (p.id === 'data' ? '' : '');
      b.type = 'button';
      b.textContent = p.title;
      b.addEventListener('click', function () {
        currentPage = p.id;
        renderNav();
        renderPage();
      });
      nav.appendChild(b);
    });
  }

  function renderPage() {
    var page = PAGES.filter(function (p) {
      return p.id === currentPage;
    })[0] || PAGES[0];
    $('modalTitle').textContent = page.title;
    var box = $('modalContent');
    box.textContent = '';
    page.render(box);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function field(labelText, control, hint) {
    var f = el('div', 'field');
    if (labelText) f.appendChild(el('label', 'field-label', labelText));
    f.appendChild(control);
    if (hint) f.appendChild(el('div', 'field-hint', hint));
    return f;
  }

  /* --- 壁纸页 --- */
  function renderPageWallpaper(box) {
    var wrap = el('div');
    var cur = el('div', 'wp-card active');
    var w = settings.wallpaper;
    if (w.type === 'video') {
      var v = document.createElement('video');
      v.src = w.src;
      if (w.poster) v.poster = w.poster;
      v.muted = true;
      v.loop = true;
      v.autoplay = true;
      v.playsInline = true;
      cur.appendChild(v);
      cur.appendChild(el('span', 'tag', '视频'));
    } else if (w.src) {
      var img = document.createElement('img');
      img.src = w.src;
      cur.appendChild(img);
    } else {
      cur.textContent = '默认背景';
    }
    var grid = el('div', 'wp-grid');
    grid.appendChild(cur);
    wrap.appendChild(field('当前壁纸', grid));

    var btnRow = el('div', 'btn-row');
    var pickVideo = el('button', 'btn', '选择本地视频');
    pickVideo.type = 'button';
    pickVideo.addEventListener('click', function () {
      pickFile('video/*');
    });
    var pickImage = el('button', 'btn', '选择本地图片');
    pickImage.type = 'button';
    pickImage.addEventListener('click', function () {
      pickFile('image/*');
    });
    var reset = el('button', 'btn', '恢复默认');
    reset.type = 'button';
    reset.addEventListener('click', function () {
      settings.wallpaper = clone(DEFAULT_SETTINGS.wallpaper);
      saveSettings();
      renderWallpaper();
      renderPage();
    });
    btnRow.appendChild(pickVideo);
    btnRow.appendChild(pickImage);
    btnRow.appendChild(reset);
    wrap.appendChild(field('更换', btnRow, '选择本地视频/图片；或把图片复制到剪贴板后，在面板里直接 Ctrl+V 粘贴；也可以在下框粘贴图片直链。'));

    // 粘贴图片 URL 直链
    var urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.placeholder = '粘贴图片/视频直链，如 https://…/pic.jpg';
    urlInput.value = /^(data:|blob:)/.test(w.src || '') ? '' : (w.src || '');
    var urlGo = el('button', 'btn primary', '应用链接');
    urlGo.type = 'button';
    function applyUrl() {
      var u = urlInput.value.trim();
      if (!u) return;
      var isVideo = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u);
      settings.wallpaper = { type: isVideo ? 'video' : 'image', src: u };
      saveSettings();
      renderWallpaper();
      renderPage();
    }
    urlGo.addEventListener('click', applyUrl);
    urlInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        applyUrl();
      }
    });
    var urlRow = el('div', 'url-row');
    urlRow.appendChild(urlInput);
    urlRow.appendChild(urlGo);
    wrap.appendChild(field('壁纸直链', urlRow, '粘贴图片或视频的直链后点「应用链接」，也可以直接回车。'));

    var range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '80';
    range.step = '5';
    range.value = String(settings.maskOpacity || 0);
    var out = el('span', '', (settings.maskOpacity || 0) + '%');
    var rangeRow = el('div');
    rangeRow.style.display = 'flex';
    rangeRow.style.alignItems = 'center';
    rangeRow.style.gap = '12px';
    rangeRow.appendChild(range);
    rangeRow.appendChild(out);
    range.addEventListener('input', function () {
      settings.maskOpacity = Number(range.value);
      out.textContent = range.value + '%';
      document.documentElement.style.setProperty('--mask-opacity', settings.maskOpacity / 100);
      scheduleSave();
    });
    wrap.appendChild(field('遮罩浓度', rangeRow, '给壁纸压一层黑色，提高文字可读性。'));

    box.appendChild(wrap);
  }

  function pickFile(accept) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        settings.wallpaper = {
          type: accept.indexOf('video') === 0 ? 'video' : 'image',
          src: String(reader.result)
        };
        saveSettings();
        renderWallpaper();
        renderPage();
      };
      reader.readAsDataURL(file);
    });
    input.click();
  }

  /* --- 图标页 --- */
  function renderEntryList(box, listKey, label) {
    var list = settings[listKey] || [];
    var wrap = el('div');
    wrap.appendChild(el('label', 'field-label', label));
    var listBox = el('div', 'entry-list');

    if (!list.length) {
      listBox.appendChild(el('div', 'empty-hint', '还没有条目'));
    }

    list.forEach(function (item, i) {
      var row = el('div', 'entry');
      var thumb = el('div', 'entry-thumb');
      var img = document.createElement('img');
      img.alt = '';
      img.onerror = function () {
        var alt = siteFavicon(item.url);
        if (alt && img.src !== alt) {
          img.src = alt;
          return;
        }
        img.remove();
        thumb.appendChild(el('span', 'fallback', initialOf(item.title, item.url)));
      };
      img.src = faviconUrl(item.url, 32) || siteFavicon(item.url);
      thumb.appendChild(img);
      row.appendChild(thumb);

      var meta = el('div', 'entry-meta');
      meta.appendChild(el('div', 'entry-title', item.title || hostOf(item.url)));
      meta.appendChild(el('div', 'entry-url', item.url));
      row.appendChild(meta);

      var acts = el('div', 'entry-actions');
      var up = el('button', 'mini-btn', '↑');
      up.type = 'button';
      up.title = '上移';
      up.addEventListener('click', function () {
        if (i === 0) return;
        var arr = settings[listKey];
        var t = arr[i - 1];
        arr[i - 1] = arr[i];
        arr[i] = t;
        saveSettings();
        renderPage();
        if (listKey === 'icons') renderIcons();
        else renderDock();
      });
      var del = el('button', 'mini-btn del', '✕');
      del.type = 'button';
      del.title = '删除';
      del.addEventListener('click', function () {
        settings[listKey].splice(i, 1);
        saveSettings();
        renderPage();
        if (listKey === 'icons') renderIcons();
        else renderDock();
      });
      acts.appendChild(up);
      acts.appendChild(del);
      row.appendChild(acts);

      listBox.appendChild(row);
    });

    wrap.appendChild(listBox);

    var addRow = el('div', 'btn-row');
    addRow.style.marginTop = '14px';

    var titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = '名称';
    titleInput.style.flex = '0 0 130px';
    var urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'https://example.com';
    urlInput.style.flex = '1 1 200px';
    var addBtn = el('button', 'btn primary', '添加');
    addBtn.type = 'button';

    function addEntry() {
      var url = urlInput.value.trim();
      if (!url) return;
      settings[listKey].push({
        title: titleInput.value.trim() || hostOf(url) || url,
        url: url
      });
      saveSettings();
      titleInput.value = '';
      urlInput.value = '';
      renderPage();
      if (listKey === 'icons') renderIcons();
      else renderDock();
    }

    addBtn.addEventListener('click', addEntry);
    urlInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        addEntry();
      }
    });

    addRow.appendChild(titleInput);
    addRow.appendChild(urlInput);
    addRow.appendChild(addBtn);
    wrap.appendChild(addRow);
    box.appendChild(wrap);
  }

  function renderPageIcons(box) {
    renderEntryList(box, 'icons', '快捷图标（新标签页中间那排）');
    var hr = el('div');
    hr.style.height = '10px';
    box.appendChild(hr);
    renderEntryList(box, 'dock', '底部 Dock');
  }

  /* --- 搜索页 --- */
  function renderPageSearch(box) {
    var wrap = el('div');
    var sel = document.createElement('select');
    Object.keys(ENGINES).forEach(function (k) {
      var opt = document.createElement('option');
      opt.value = k;
      opt.textContent = ENGINES[k].name;
      if (settings.search.engine === k) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function () {
      settings.search.engine = sel.value;
      saveSettings();
      renderSearch();
    });
    wrap.appendChild(field('默认搜索引擎', sel, '点击搜索框左边的引擎名也能快速切换。'));
    box.appendChild(wrap);
  }

  /* --- 时间页 --- */
  function renderPageClock(box) {
    var wrap = el('div');
    var items = [
      { key: 'show', label: '显示时钟' },
      { key: 'showSeconds', label: '显示秒' },
      { key: 'hour12', label: '12 小时制' },
      { key: 'showDate', label: '显示公历日期与星期' },
      { key: 'showLunar', label: '显示农历 / 节日' }
    ];
    items.forEach(function (it) {
      var row = el('label', 'check-row');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!settings.clock[it.key];
      cb.addEventListener('change', function () {
        settings.clock[it.key] = cb.checked;
        saveSettings();
        renderClock();
      });
      row.appendChild(cb);
      row.appendChild(el('span', '', it.label));
      wrap.appendChild(row);
    });
    box.appendChild(field('时间显示', wrap));
  }

  /* --- 便签页 --- */
  function renderPageNote(box) {
    var wrap = el('div');
    var row = el('label', 'check-row');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!settings.note.enabled;
    cb.addEventListener('change', function () {
      settings.note.enabled = cb.checked;
      saveSettings();
      renderNote();
    });
    row.appendChild(cb);
    row.appendChild(el('span', '', '在新标签页显示便签'));
    wrap.appendChild(row);
    box.appendChild(field('便签', wrap, '便签内容自动保存到本机，不会上传。清空便签：'));

    var clear = el('button', 'btn danger', '清空便签内容');
    clear.type = 'button';
    clear.addEventListener('click', function () {
      settings.note.text = '';
      $('noteBody').textContent = '';
      saveSettings();
    });
    box.appendChild(clear);
  }

  /* --- 数据页 --- */
  function renderPageData(box) {
    var wrap = el('div');

    var exportBtn = el('button', 'btn', '导出设置');
    exportBtn.type = 'button';
    exportBtn.addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fatfox-lite-settings.json';
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
      }, 1000);
    });

    var importBtn = el('button', 'btn', '导入设置');
    importBtn.type = 'button';
    importBtn.addEventListener('click', function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            var obj = JSON.parse(String(r.result));
            settings = mergeSettings(DEFAULT_SETTINGS, obj);
            saveSettings();
            applyAll();
            renderPage();
          } catch (e) {
            alert('JSON 解析失败：' + e.message);
          }
        };
        r.readAsText(f);
      });
      input.click();
    });

    var resetBtn = el('button', 'btn danger', '恢复全部默认设置');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', function () {
      if (!confirm('确定恢复默认？当前的图标、Dock、便签内容都会丢失。')) return;
      settings = clone(DEFAULT_SETTINGS);
      saveSettings();
      applyAll();
      renderPage();
    });

    var row = el('div', 'btn-row');
    row.appendChild(exportBtn);
    row.appendChild(importBtn);
    row.appendChild(resetBtn);
    wrap.appendChild(field('备份与恢复', row, '导出为 JSON 文件，换电脑时可以导回来。'));
    box.appendChild(wrap);
  }

  /* --- 关于 / 反馈 --- */
  function renderPageAbout(box) {
    var wrap = el('div');

    var info = el('div');
    info.style.lineHeight = '1.9';
    info.appendChild(el('div', '', 'Fatfox Lite 新标签页 v0.1.0'));
    info.appendChild(el('div', '', '本地运行，不联网、无追踪、无 AI。'));
    wrap.appendChild(field('关于', info));

    var fb = el('button', 'btn primary', '去 GitHub 提意见 / 反馈 Bug');
    fb.type = 'button';
    fb.addEventListener('click', function () {
      window.open(FEEDBACK_URL, '_blank', 'noopener');
    });
    wrap.appendChild(field('问题反馈', fb, FEEDBACK_URL));

    box.appendChild(wrap);
  }

  /* ---------------- 初始化 ---------------- */

  function applyAll() {
    renderWallpaper();
    renderClock();
    renderSearch();
    renderIcons();
    renderDock();
    renderNote();
  }

  function bindEvents() {
    $('searchForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      doSearch();
    });

    // 剪贴板粘贴图片：在设置面板内检测到图片即可设为壁纸
    document.addEventListener('paste', function (ev) {
      var items = (ev.clipboardData || {}).items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') === 0) {
          var file = items[i].getAsFile();
          if (!file) continue;
          var reader = new FileReader();
          reader.onload = function () {
            settings.wallpaper = { type: 'image', src: String(reader.result) };
            saveSettings();
            renderWallpaper();
            renderPage();
          };
          reader.readAsDataURL(file);
          ev.preventDefault();
          return;
        }
      }
    });

    $('searchEngineLabel').addEventListener('click', function () {
      var keys = Object.keys(ENGINES);
      var i = keys.indexOf(settings.search.engine);
      settings.search.engine = keys[(i + 1) % keys.length];
      saveSettings();
      renderSearch();
      $('searchInput').focus();
    });

    $('btnSettings').addEventListener('click', function () {
      openModal();
    });
    $('btnClose').addEventListener('click', closeModal);
    $('modal').addEventListener('click', function (ev) {
      if (ev.target === $('modal')) closeModal();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !$('modal').hidden) closeModal();
      if (ev.key === '/' && document.activeElement !== $('searchInput') && document.activeElement !== $('noteBody')) {
        ev.preventDefault();
        $('searchInput').focus();
      }
    });

    // 图标徽标更新（切回标签页时刷新时钟）
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) renderClock();
    });
  }

  function start() {
    loadSettings().then(function () {
      applyAll();
      bindEvents();
      bindNote();
      setInterval(renderClock, 1000);
      renderClock();
      $('searchInput').focus();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
