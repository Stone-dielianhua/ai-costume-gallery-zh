/* COSTUME Atlas · adapted from POSE Atlas, © 2026 Anhao, MIT. */
(() => {
  'use strict';

  const PAGE_SIZE = 60;
  // All indexed images are included with the site, including subdirectory deployments.
  const IMAGE_ORIGIN = new URL('./', document.baseURI).href;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const format = value => Number(value).toLocaleString('zh-CN');
  const normalize = value => String(value ?? '').trim().toLowerCase();
  const expandIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/></svg>';
  const TYPES = [
    { value: 'dress', label: '连衣裙', words: ['dress'] },
    { value: 'skirt', label: '半身裙', words: ['skirt'] },
    { value: 'top', label: '上衣 / 针织', words: ['shirt', 'blouse', 'camisole', 'knit', 'sweater', 'hoodie', 'vest', 'turtleneck'] },
    { value: 'outerwear', label: '外套 / 开衫', words: ['coat', 'jacket', 'cardigan'] },
    { value: 'pants', label: '长裤 / 短裤', words: ['pants', 'jeans', 'shorts'] },
    { value: 'lingerie', label: '内衣 / 束身衣', words: ['bra', 'briefs', 'corset', 'robe'] },
    { value: 'swimwear', label: '泳衣', words: ['swimsuit'] }
  ];
  const COLORS = [
    { value: 'white', label: '白色 / 象牙白', words: ['white', 'ivory', 'cream'] },
    { value: 'black', label: '黑色', words: ['black'] },
    { value: 'grey', label: '灰色 / 银色', words: ['grey', 'silver'] },
    { value: 'beige', label: '米色 / 棕色', words: ['beige', 'brown', 'khaki'] },
    { value: 'blue', label: '蓝色 / 藏蓝', words: ['blue', 'navy'] },
    { value: 'green', label: '绿色 / 薄荷绿', words: ['green', 'mint', 'olive'] },
    { value: 'pink', label: '粉色', words: ['pink'] },
    { value: 'red', label: '红色 / 酒红', words: ['red', 'burgundy'] },
    { value: 'yellow', label: '黄色 / 金色', words: ['yellow', 'gold'] },
    { value: 'purple', label: '紫色', words: ['purple', 'lavender'] },
    { value: 'orange', label: '橙色', words: ['orange'] }
  ];
  const state = { category: '', type: '', color: '', query: '', view: 'comfortable', shown: PAGE_SIZE };
  const grid = $('#grid');
  const viewer = $('#viewer');
  const infoDialog = $('#infoDialog');
  const searchInput = $('#searchInput');
  const viewerState = { list: [], index: 0, token: 0, trigger: null };
  let items = [];
  let categories = [];
  let aliases = {};
  let filtered = [];
  let rendered = 0;
  let searchTimer;
  let composing = false;
  let toastTimer;

  const INFO = {
    guide: {
      title: '使用指南',
      html: `<ul>
        <li>选择季节或场景分类，再按<strong>服装类型、颜色</strong>组合筛选。颜色会匹配整套搭配中出现的颜色。</li>
        <li>搜索支持<strong>中文、英文和服装 ID</strong>，例如「蕾丝」「牛仔」「denim」「SPR-0001」。多个关键词用空格分隔，可进一步缩小范围。</li>
        <li>点击卡片查看大图，使用 <strong>← →</strong> 或左右滑动切换服装，按 <strong>Esc</strong> 关闭。点击详情中的关键词可查找相似服装。</li>
        <li>点击<strong>下载原尺寸 PNG</strong>保存原图，可用于 AI 工具的服装参考、图像参考，或服装设计与穿搭灵感。</li>
        <li>图片为<strong>不含人物的 AI 生成服装</strong>，人物、体型与背景请用其他参考图或提示词补足。</li>
      </ul><p>按 <strong>/</strong> 快速搜索。筛选条件会保留在网址中，可直接分享或收藏当前结果。</p>`
    },
    notice: {
      title: '注意事项',
      html: `<ul>
        <li>依原站说明，图片可<strong>免费用于作品制作中的商用、编辑与参考</strong>。</li>
        <li><strong>禁止再分发、转载、转售图片数据本身</strong>，包括原尺寸与加工后版本。</li>
        <li>无需署名（可选）。图片元数据已清除。不提供任何担保，请自行判断使用。</li>
        <li>图片是通过文生图生成的<strong>虚构服装</strong>，不是真实商品照片，未使用真实商品图片。</li>
        <li>原作者表示发布前已与现有品牌做相似性检查，但不保证不侵犯第三方权利。</li>
        <li>因使用本数据产生的问题，本站及译者不承担责任。请勿用于表现真实人物或未成年人、违反公序良俗的用途。</li>
      </ul><p>图片与原始数据版权归 <a href="https://x.com/giaaibusi" target="_blank" rel="noopener noreferrer">ギア</a> 所有，使用条款以 <a href="https://ai-costume-gallery.pages.dev/" target="_blank" rel="noopener noreferrer">原始站点</a> 的说明为准。</p>`
    }
  };

  function imageURL(path) {
    return new URL(path, IMAGE_ORIGIN).href;
  }

  function titleOf(item) {
    // Prefer garment names over a long, disconnected list of accessories.
    const words = item._words;
    const color = item.标签.find(tag => /白|黑|灰|米色|棕|蓝|绿|粉|红|黄色|橙|紫/.test(tag));
    const details = item.标签.filter(tag => ['蕾丝', '碎花', '针织', '牛仔', '百褶', '缎面', '丝绒', '褶边', '皮革'].includes(tag));
    const garment = words.has('dress') ? '连衣裙' : words.has('skirt') ? '半身裙' : words.has('jeans') ? '牛仔裤' : words.has('pants') ? '长裤' : words.has('shorts') ? '短裤' : words.has('swimsuit') ? '泳衣' : words.has('bra') ? '内衣' : words.has('corset') ? '束身衣' : words.has('coat') ? '大衣' : words.has('jacket') ? '夹克' : words.has('camisole') ? '吊带衫' : '服装';
    return [...new Set([color, ...details.slice(0, 1), garment].filter(Boolean))].join(' · ') + '搭配';
  }

  function readURL() {
    const params = new URLSearchParams(location.search);
    const category = params.get('category') || '';
    const type = params.get('type') || '';
    const color = params.get('color') || '';
    state.category = categories.includes(category) ? category : '';
    state.type = TYPES.some(t => t.value === type) ? type : '';
    state.color = COLORS.some(c => c.value === color) ? color : '';
    state.query = (params.get('q') || '').slice(0, 200);
    state.view = params.get('view') === 'compact' ? 'compact' : 'comfortable';
  }

  function writeURL() {
    const url = new URL(location.href);
    for (const key of ['category', 'type', 'color']) {
      if (state[key]) url.searchParams.set(key, state[key]);
      else url.searchParams.delete(key);
    }
    if (state.query.trim()) url.searchParams.set('q', state.query.trim());
    else url.searchParams.delete('q');
    if (state.view === 'compact') url.searchParams.set('view', 'compact');
    else url.searchParams.delete('view');
    history.replaceState(null, '', url);
  }

  function matchesSearch(item, terms) {
    return terms.every(term => {
      if (/^[a-z0-9-]+$/.test(term)) {
        return item.id.toLowerCase().includes(term) || [...item._words].some(word => word.startsWith(term));
      }
      if (item._search.includes(term)) return true;
      return (aliases[term] || []).some(word => item._words.has(word));
    });
  }

  function matchesOptions(item, options, value) {
    if (!value) return true;
    return options.find(option => option.value === value)?.words.some(word => item._words.has(word));
  }

  function syncControls() {
    searchInput.value = state.query;
    $('#searchClear').hidden = !state.query;
    $('#typeSelect').value = state.type;
    $('#colorSelect').value = state.color;
    grid.classList.toggle('compact', state.view === 'compact');
    document.querySelectorAll('[data-category]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.category === state.category));
    });
    document.querySelectorAll('[data-view]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
    });
    const count = [state.type, state.color].filter(Boolean).length + Number(state.view === 'compact');
    $('#filterBadge').textContent = count || '';
    const chips = [];
    if (state.category) chips.push(['category', state.category]);
    if (state.type) chips.push(['type', TYPES.find(t => t.value === state.type).label]);
    if (state.color) chips.push(['color', COLORS.find(c => c.value === state.color).label]);
    if (state.query.trim()) chips.push(['query', `搜索：${state.query.trim()}`]);
    $('#activeFilters').hidden = !chips.length;
    $('#activeFilters').innerHTML = chips.map(([key, label]) => `<button class="filter-chip" type="button" data-clear="${key}" aria-label="移除${esc(label)}筛选">${esc(label)}</button>`).join('');
  }

  function applyFilters(updateURL = true) {
    clearTimeout(searchTimer);
    const terms = normalize(state.query).split(/\s+/).filter(Boolean);
    filtered = items.filter(item =>
      (!state.category || item.分类 === state.category) &&
      matchesOptions(item, TYPES, state.type) &&
      matchesOptions(item, COLORS, state.color) &&
      matchesSearch(item, terms)
    );
    state.shown = PAGE_SIZE;
    syncControls();
    render(true);
    if (updateURL) writeURL();
  }

  function renderTabs() {
    const tabs = [['', '全部', items.length], ...categories.map(category => [category, category, items.filter(item => item.分类 === category).length])];
    $('#categoryTabs').innerHTML = tabs.map(([value, label, count]) => `<button class="line-tab" type="button" data-category="${esc(value)}" aria-pressed="${state.category === value}"><span class="tab-name">${esc(label)}</span><span class="tab-count">${format(count)} 套服装</span></button>`).join('');
  }

  function cardHTML(item, index) {
    return `<button class="costume-card" type="button" data-index="${index}" aria-label="查看 ${esc(item.id)} ${esc(item._title)}大图">
      <span class="card-image">
        <img class="main-image" loading="${index < 10 ? 'eager' : 'lazy'}" decoding="async" src="${esc(imageURL(item.缩略图))}" alt="${esc(item.id + ' ' + item.关键词中文)}" width="320" height="480">
        <span class="image-top"><span class="pose-no">${esc(item.id)}</span><span class="angle-tag">${esc(item.分类)}</span></span>
        <span class="zoom-hint" aria-hidden="true">${expandIcon}</span>
      </span>
      <span class="card-body"><span class="card-title">${esc(item._title)}</span><span class="card-tags">${esc(item.关键词中文)}</span><span class="card-meta"><span class="category">${esc(item.分类)}</span><span class="meta-dot">·</span><span>PNG 原图</span><span class="card-size">${item.宽} × ${item.高}</span></span></span>
    </button>`;
  }

  function render(reset) {
    if (reset) { grid.innerHTML = ''; rendered = 0; }
    if (!filtered.length) {
      grid.innerHTML = '<div class="empty"><div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m20 20-4.2-4.2"/></svg></div><h3>没有符合条件的服装</h3><p>试试减少筛选条件，或搜索「蕾丝」「牛仔」「黑色」。</p><button type="button" data-reset>重置筛选</button></div>';
    } else {
      grid.insertAdjacentHTML('beforeend', filtered.slice(rendered, state.shown).map((item, i) => cardHTML(item, rendered + i)).join(''));
      rendered = Math.min(state.shown, filtered.length);
    }
    $('#resultCount').textContent = `${format(filtered.length)} 套服装`;
    $('#visibleCount').textContent = filtered.length ? `已显示 ${format(rendered)} 套` : '';
    const remaining = filtered.length - rendered;
    $('#loadMore').hidden = remaining <= 0;
    $('#loadMore').textContent = `加载更多（剩余 ${format(remaining)} 套）`;
    grid.setAttribute('aria-busy', 'false');
  }

  function resetFilters() {
    Object.assign(state, { category: '', type: '', color: '', query: '' });
    applyFilters();
  }

  function toast(message) {
    const el = $('#toast');
    (viewer.open ? viewer : infoDialog.open ? infoDialog : document.body).appendChild(el);
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      const input = document.createElement('textarea');
      input.value = text;
      input.className = 'copy-fallback';
      viewer.appendChild(input);
      input.select();
      const success = document.execCommand('copy');
      input.remove();
      toast(success ? message : '复制失败，请手动选择文本');
    }
  }

  function openViewer(index, trigger) {
    if (!filtered[index]) return;
    viewerState.list = filtered.slice();
    viewerState.index = index;
    viewerState.trigger = trigger;
    viewer.showModal();
    document.body.classList.add('modal-open');
    showViewer();
    $('#viewerClose').focus({ preventScroll: true });
  }

  function closeViewer() {
    viewer.close();
  }

  viewer.addEventListener('close', () => {
    viewerState.token++;
    document.body.classList.remove('modal-open');
    $('#viewerImage').removeAttribute('src');
    document.body.appendChild($('#toast'));
    viewerState.trigger?.focus({ preventScroll: true });
  });

  function showViewer() {
    const item = viewerState.list[viewerState.index];
    if (!item) return;
    const token = ++viewerState.token;
    const image = $('#viewerImage');
    const status = $('#imageStatus');
    image.src = imageURL(item.缩略图);
    image.alt = `${item.id} ${item.关键词中文}`;
    status.textContent = '正在加载大图…';
    status.hidden = false;
    const large = new Image();
    large.onload = () => {
      if (token !== viewerState.token) return;
      image.src = large.src;
      status.hidden = true;
    };
    large.onerror = () => {
      if (token === viewerState.token) status.textContent = '大图暂时无法加载，可尝试打开原图';
    };
    large.src = imageURL(item.大图);
    $('#viewerCategory').textContent = `${item.分类} · 服装参考`;
    $('#viewerTitle').textContent = item._title;
    $('#viewerId').textContent = item.id;
    $('#viewerPosition').textContent = `${format(viewerState.index + 1)} / ${format(viewerState.list.length)}`;
    $('#viewerTags').innerHTML = item.标签.map(tag => `<button type="button" class="tag" data-keyword="${esc(tag)}">${esc(tag)}</button>`).join('');
    $('#viewerMeta').innerHTML = `<dt>服装分类</dt><dd>${esc(item.分类)}</dd><dt>原图尺寸</dt><dd>${item.宽} × ${item.高} px</dd><dt>图片格式</dt><dd>PNG · 竖版 2:3</dd><dt>英文关键词</dt><dd class="english-keywords">${esc(item.关键词)}</dd>`;
    $('#downloadImage').href = imageURL(item.原图);
    $('#downloadImage').download = `${item.id}.png`;
    $('#openImage').href = imageURL(item.原图);
    $('#previousImage').disabled = viewerState.index === 0;
    $('#nextImage').disabled = viewerState.index === viewerState.list.length - 1;
    for (const index of [viewerState.index - 1, viewerState.index + 1]) {
      const neighbor = viewerState.list[index];
      if (neighbor) { const preload = new Image(); preload.src = imageURL(neighbor.大图); }
    }
  }

  function stepViewer(direction) {
    const next = viewerState.index + direction;
    if (next < 0 || next >= viewerState.list.length) return;
    viewerState.index = next;
    showViewer();
  }

  let downloading = false;
  $('#downloadImage').addEventListener('click', async event => {
    event.preventDefault();
    if (downloading) return;
    const item = viewerState.list[viewerState.index];
    if (!item) return;
    downloading = true;
    const button = $('#downloadImage');
    button.setAttribute('aria-disabled', 'true');
    $('#downloadLabel').textContent = '正在准备下载…';
    try {
      const response = await fetch(imageURL(item.原图), { signal: AbortSignal.timeout(60000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Invalid image');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `${item.id}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast(`已开始下载 ${item.id}.png`);
    } catch {
      toast('下载暂时失败，请重试或点击「新窗口打开原图」保存');
    } finally {
      downloading = false;
      button.removeAttribute('aria-disabled');
      $('#downloadLabel').textContent = '下载原尺寸 PNG';
    }
  });

  $('#categoryTabs').addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    applyFilters();
  });
  searchInput.addEventListener('input', event => {
    clearTimeout(searchTimer);
    $('#searchClear').hidden = !searchInput.value;
    state.query = searchInput.value;
    if (composing || event.isComposing) return;
    searchTimer = setTimeout(() => applyFilters(), 160);
  });
  searchInput.addEventListener('compositionstart', () => { composing = true; clearTimeout(searchTimer); });
  searchInput.addEventListener('compositionend', () => { composing = false; state.query = searchInput.value; applyFilters(); });
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) {
      state.query = searchInput.value;
      applyFilters();
    }
  });
  $('#searchClear').addEventListener('click', () => {
    state.query = '';
    applyFilters();
    searchInput.focus();
  });
  for (const key of ['type', 'color']) {
    $(`#${key}Select`).addEventListener('change', event => { state[key] = event.target.value; applyFilters(); });
  }
  $('#viewFilter').addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    state.view = button.dataset.view;
    syncControls();
    writeURL();
  });
  $('#filterToggle').addEventListener('click', () => {
    const open = $('#filterPanel').classList.toggle('open');
    $('#filterToggle').setAttribute('aria-expanded', String(open));
  });
  $('#resetFilters').addEventListener('click', resetFilters);
  $('#activeFilters').addEventListener('click', event => {
    const button = event.target.closest('[data-clear]');
    if (!button) return;
    state[button.dataset.clear] = '';
    applyFilters();
  });
  $('#loadMore').addEventListener('click', () => { state.shown += PAGE_SIZE; render(false); });
  grid.addEventListener('click', event => {
    if (event.target.closest('[data-reset]')) { resetFilters(); return; }
    if (event.target.closest('[data-retry]')) { boot(); return; }
    const card = event.target.closest('[data-index]');
    if (card) openViewer(Number(card.dataset.index), card);
  });
  grid.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    if (!image.dataset.retried) {
      image.dataset.retried = 'true';
      image.src = image.src.replace('/thumbs/', '/img/');
    } else {
      const media = image.closest('.card-image');
      media.classList.add('image-unavailable');
      const note = document.createElement('span');
      note.className = 'image-error';
      note.textContent = '图片暂时无法加载，点击重试';
      media.appendChild(note);
    }
  }, true);

  $('#viewerClose').addEventListener('click', closeViewer);
  $('#previousImage').addEventListener('click', () => stepViewer(-1));
  $('#nextImage').addEventListener('click', () => stepViewer(1));
  viewer.addEventListener('click', event => { if (event.target === viewer) closeViewer(); });
  $('#copyId').addEventListener('click', () => copyText($('#viewerId').textContent, '已复制服装 ID'));
  $('#viewerTags').addEventListener('click', event => {
    const tag = event.target.closest('[data-keyword]');
    if (!tag) return;
    Object.assign(state, { category: '', type: '', color: '', query: tag.dataset.keyword });
    closeViewer();
    applyFilters();
    $('#main').scrollIntoView({ block: 'start' });
    searchInput.focus({ preventScroll: true });
  });

  document.addEventListener('keydown', event => {
    if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (viewer.open) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); stepViewer(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); stepViewer(1); }
      return;
    }
    if (infoDialog.open) return;
    if (event.key === '/' && !event.target.closest('input, textarea, select, [contenteditable="true"]')) {
      event.preventDefault();
      searchInput.focus();
    }
  });
  let touchStart = null;
  $('#viewerStage').addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  $('#viewerStage').addEventListener('touchend', event => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) stepViewer(dx < 0 ? 1 : -1);
    touchStart = null;
  }, { passive: true });
  $('#viewerStage').addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

  document.querySelectorAll('[data-info]').forEach(button => button.addEventListener('click', () => {
    const info = INFO[button.dataset.info];
    $('#infoTitle').textContent = info.title;
    $('#infoContent').innerHTML = info.html;
    infoDialog.showModal();
    document.body.classList.add('modal-open');
  }));
  $('#infoClose').addEventListener('click', () => infoDialog.close());
  infoDialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
  infoDialog.addEventListener('click', event => { if (event.target === infoDialog) infoDialog.close(); });
  window.addEventListener('popstate', () => {
    if (viewer.open) closeViewer();
    readURL();
    applyFilters(false);
  });

  async function boot() {
    $('#resultCount').textContent = '正在加载图库…';
    grid.setAttribute('aria-busy', 'true');
    try {
      const responses = await Promise.all([fetch('data/costume-zh.json'), fetch('data/meta-zh.json')]);
      if (responses.some(response => !response.ok)) throw new Error('Data unavailable');
      const [data, meta] = await Promise.all(responses.map(response => response.json()));
      if (!Array.isArray(data) || !Array.isArray(meta.分类)) throw new Error('Invalid data');
      items = data.map(item => {
        item._words = new Set(normalize(item.关键词).split(/\s+/));
        item._search = normalize(`${item.id} ${item.分类} ${item.关键词} ${item.关键词中文} ${item.检索}`);
        item._title = titleOf(item);
        return item;
      });
      categories = meta.分类.map(category => category.名称);
      aliases = meta.同义词 || {};
      for (const [selector, options, label] of [['#typeSelect', TYPES, '全部类型'], ['#colorSelect', COLORS, '全部颜色']]) {
        $(selector).innerHTML = `<option value="">${label}</option>` + options.map(option => `<option value="${option.value}">${option.label}</option>`).join('');
      }
      $('#statTotal').textContent = format(items.length);
      $('#statCats').textContent = format(categories.length);
      readURL();
      renderTabs();
      applyFilters(false);
    } catch {
      $('#resultCount').textContent = '图库加载失败';
      $('#visibleCount').textContent = '';
      $('#loadMore').hidden = true;
      grid.setAttribute('aria-busy', 'false');
      grid.innerHTML = '<div class="empty"><h3>暂时无法读取图库</h3><p>请检查网络连接后重试。</p><button type="button" data-retry>重新加载</button></div>';
    }
  }

  boot();
})();
