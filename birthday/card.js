/* Personalized animated BIRTHDAY card — recipient view + shared codec (same codec as /christmas/).
   Text arrives inside the link (#m=...), is decoded in the browser and only ever
   inserted with textContent, so a crafted link cannot inject markup. */
(function () {
  'use strict';
  var CFG = window.CARD_CONFIG || {};
  var A = CFG.assetBase || 'assets/';
  var LIMITS = { t: 40, m: 300, s: 60 };

  /* ---------- codec (shared with the editor) ---------- */
  function encode(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function clean(d) {
    d = d && typeof d === 'object' ? d : {};
    function s(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
    return { t: s(d.t, LIMITS.t).trim(), m: s(d.m, LIMITS.m).trim(), s: s(d.s, LIMITS.s).trim() };
  }
  function readHash() {
    var p = new URLSearchParams(location.hash.replace(/^#/, ''));
    var data = {};
    if (p.get('m')) { try { data = decode(p.get('m')); } catch (e) { data = {}; } }
    data = clean(data);
    if (!data.m) data.m = CFG.defaultMessage || '';
    return { data: data, view: p.get('view') || '', autoplay: p.get('autoplay') === '1' };
  }
  window.CardCodec = { encode: encode, decode: decode, clean: clean, limits: LIMITS };

  /* ---------- tiny DOM helper ---------- */
  function el(tag, cls, style, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) e.setAttribute('style', style);
    if (parent) parent.appendChild(e);
    return e;
  }
  function img(src, cls, style, parent) { var i = el('img', cls, style, parent); i.src = src; i.alt = ''; return i; }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(markup, w, h, parent, style) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('width', w); s.setAttribute('height', h); s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('fill', 'none'); s.setAttribute('aria-hidden', 'true');
    if (style) s.setAttribute('style', style);
    s.innerHTML = markup; // static, trusted markup only
    parent.appendChild(s);
    return s;
  }
  var DOTS = '<g fill="#C9B88A"><circle cx="4" cy="4" r="3"/><circle cx="22" cy="4" r="3"/><circle cx="40" cy="4" r="3"/></g>';

  /* ---------- the inside page with the buyer's words ---------- */
  var TWINKLE = '<path d="M8 0l1.8 6.2L16 8l-6.2 1.8L8 16l-1.8-6.2L0 8l6.2-1.8z" fill="#F2C14E"/>';
  function buildInside(parent, data, baseFont, popped) {
    var ins = el('div', 'inside', null, parent);
    var popbox = el('div', 'popbox', null, ins);
    var pop = el('div', 'pop', popped ? 'transform:rotateX(0deg)' : null, popbox);
    el('div', 'popshadow', null, pop);
    img(A + 'cake.webp', 'cake', null, pop);
    [['tw tw1', '#F2C14E', 14, 0.8], ['tw tw2', '#E27D8E', 11, 1.05], ['tw tw3', '#EFA07C', 12, 0.9]].forEach(function (t) {
      var d = el('div', t[0], null, popbox);
      svg(TWINKLE.replace('#F2C14E', t[1]), 16, 16, d, 'display:block;width:' + t[2] + 'px;height:' + t[2] + 'px;animation:dusttwinkle ' + t[3] + 's ease-in-out infinite alternate');
    });
    var txt = el('div', 'txt', 'font-size:' + baseFont + 'px', ins);
    if (data.t) { var g = el('div', 'greet', null, txt); g.textContent = 'Dear ' + data.t + ','; }
    var m = el('div', 'msg', null, txt); m.textContent = data.m;
    if (data.s) { var sg = el('div', 'sign', null, txt); sg.textContent = data.s; }
    svg(DOTS, 44, 8, ins, null).setAttribute('class', 'dots');
    img(A + 'paper.jpg', 'paper', 'opacity:.5', ins);
    el('div', 'gutter-l', null, ins);
    return { root: ins, txt: txt, base: baseFont, pop: pop };
  }
  function fitText(parts) {
    var f = parts.base, t = parts.txt;
    t.style.fontSize = f + 'px';
    var guard = 0;
    while (t.scrollHeight > t.clientHeight + 1 && f > 13 && guard++ < 40) { f -= 1; t.style.fontSize = f + 'px'; }
  }

  /* ---------- layouts (stage units) ---------- */
  var LAYOUTS = {
    land: { W: 1200, H: 900, bgPos: '22% center', area: { x: 80, y: 81, w: 960, h: 700 },
      card: { left: 480, bottom: 180, s: 0.72, hide: 640 }, env: { cx: 720, bottom: 0, s: 1 },
      hintY: 818, hintSize: 15, fadeCover: false, font: 28, shadow: { cx: 820, cy: 800, rx: 310 } },
    port: { W: 600, H: 1100, bgPos: '50% center', area: { x: 0, y: 0, w: 600, h: 984 },
      card: { left: 60, bottom: 229, s: 0.9, hide: 640 }, env: { cx: 300, bottom: 0, s: 1.2 },
      hintY: 1028, hintSize: 22, fadeCover: true, font: 33, shadow: { cx: 300, cy: 990, rx: 270 } }
  };

  /* ---------- recipient view ---------- */
  var stageEl = document.getElementById('stage');
  var ivwrap = document.getElementById('ivwrap');
  var state = { playing: false, timers: [], L: null, parts: null, data: null, built: false };

  function pickLayout() { return (window.innerWidth / window.innerHeight) < 0.9 ? LAYOUTS.port : LAYOUTS.land; }

  function scaleStage() {
    var L = state.L; if (!L) return;
    var s = Math.min(window.innerWidth / L.W, window.innerHeight / L.H);
    stageEl.style.width = L.W + 'px'; stageEl.style.height = L.H + 'px';
    stageEl.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
  }

  function build(data) {
    var L = pickLayout(); state.L = L; state.data = data;
    stageEl.innerHTML = '';
    var W = L.W, H = L.H;
    img(A + 'bg.jpg', 'bg', 'object-position:' + L.bgPos, stageEl);
    svg('<defs><radialGradient id="avig" cx="0.5" cy="0.45" r="0.78"><stop offset="58%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.34"/></radialGradient>' +
      '<filter id="ab10" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="11"/></filter></defs>' +
      '<ellipse cx="' + L.shadow.cx + '" cy="' + L.shadow.cy + '" rx="' + L.shadow.rx + '" ry="26" fill="#1A0505" opacity="0.45" filter="url(#ab10)"/>' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#avig)"/>', W, H, stageEl, 'position:absolute;left:0;top:0');

    // ambient motes (always on)
    var motes = el('div', 'motes', null, stageEl);
    [[0.838, 0.826, 9, .25, -12, -107, 13.3, 6.2], [0.878, 0.691, 9, .23, -37, -62, 13.0, .8], [0.137, 0.671, 8, .28, -20, -129, 13.8, 5.2],
     [0.174, 0.367, 5, .18, 58, -89, 10, 1.9], [0.818, 0.669, 6, .26, -39, -72, 11.6, 5.1], [0.541, 0.564, 9, .29, 20, -101, 14, 6.7]].forEach(function (m) {
      el('div', null, 'position:absolute;left:' + (m[0] * W) + 'px;top:' + (m[1] * H) + 'px;width:' + m[2] + 'px;height:' + m[2] + 'px;border-radius:50%;' +
        'background:radial-gradient(circle,rgba(246,205,130,.75),rgba(255,255,255,0));filter:blur(2px);--mo:' + m[3] + ';--mx:' + m[4] + 'px;--my:' + m[5] + 'px;' +
        'animation:motedrift ' + m[6] + 's ease-in-out ' + m[7] + 's infinite;opacity:0', motes);
    });

    var fxBack = el('div', 'fxback', null, stageEl);
    var area = el('div', 'area', 'left:' + L.area.x + 'px;top:' + L.area.y + 'px;width:' + L.area.w + 'px;height:' + L.area.h + 'px', stageEl);

    // card
    var card = el('div', 'card', 'left:' + L.card.left + 'px;bottom:' + L.card.bottom + 'px', area);
    var persp = el('div', 'persp', null, card);
    var parts = buildInside(persp, data, L.font);
    var cover = el('div', 'cover', null, persp);
    var front = el('div', 'face front', null, cover);
    img(A + 'front.jpg', 'art', null, front);
    img(A + 'paper.jpg', 'paper', 'opacity:.22', front);
    el('div', 'gloss', null, front); el('div', 'edge-l', null, front);
    var back = el('div', 'face back', null, cover);
    el('div', 'frame', null, back);
    svg('<path d="M20 4l4.5 11 11 4.5-11 4.5-4.5 11-4.5-11-11-4.5 11-4.5z" fill="#E27D8E"/>', 40, 40, back, 'display:block');
    img(A + 'paper.jpg', 'paper', 'opacity:.5', back);
    el('div', 'gutter-r', null, back);

    // envelope (outer = scale, inner = fade)
    var envX = L.env.cx - 210;
    var envOuter = el('div', 'envwrap', 'left:' + envX + 'px;bottom:' + L.env.bottom + 'px;transform:scale(' + L.env.s + ')', area);
    var envInner = el('div', null, 'position:absolute;inset:0', envOuter);
    img(A + 'env-body.webp', 'env-body', null, envInner);
    var tag = el('div', 'tag', null, envInner);
    tag.textContent = data.t ? ('For ' + data.t) : 'With love';
    var flapbox = el('div', 'flapbox', null, envInner);
    var flap = el('div', 'flap', null, flapbox);
    img(A + 'env-flap.webp', null, null, flap);
    el('div', 'inner', null, flap);

    var crumOuter = el('div', 'crumwrap', 'left:' + envX + 'px;bottom:' + L.env.bottom + 'px;transform:scale(' + L.env.s + ')', area);
    var crum = el('div', 'crum', null, crumOuter);
    img(A + 'env-crumpled.webp', null, null, crum);

    var fx = el('div', 'fx', null, stageEl);
    var hint = el('div', 'hint', 'top:' + L.hintY + 'px;font-size:' + L.hintSize + 'px;' + (L === LAYOUTS.land ? 'left:' + (L.env.cx + L.area.x - 300) + 'px;right:auto;width:600px' : ''), stageEl);
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    hint.textContent = (coarse ? 'Tap' : 'Click') + ' the envelope to open';

    state.parts = parts;
    state.n = { card: card, cover: cover, front: front, back: back, envInner: envInner, flap: flap, crum: crum, fx: fx, fxBack: fxBack, hint: hint, pop: parts.pop };
    reset();
    scaleStage();
    fitText(parts);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitText(parts); });
  }

  function T(e, v) { e.style.transition = v; }
  function reset() {
    var n = state.n, L = state.L;
    state.timers.forEach(clearTimeout); state.timers = [];
    state.playing = false; state.finished = false;
    [n.card, n.cover, n.flap, n.envInner, n.front, n.back, n.pop].forEach(function (e) { T(e, 'none'); });
    n.card.style.transform = 'translateY(' + L.card.hide + 'px) scale(' + L.card.s + ')';
    n.cover.style.transform = 'rotateY(0deg)';
    n.flap.style.transform = 'rotateX(0deg)';
    n.pop.style.transform = 'rotateX(-88deg)';
    n.envInner.style.opacity = '1';
    n.front.style.opacity = '1'; n.back.style.opacity = '1';
    n.crum.style.animation = 'none'; n.crum.style.opacity = '0';
    n.fx.innerHTML = ''; n.fxBack.innerHTML = '';
    n.hint.classList.remove('off');
    stageEl.classList.remove('done');
    var c = document.getElementById('controls'); if (c) c.classList.remove('show');
    void stageEl.offsetWidth; // commit the reset before any new transition
  }

  function play() {
    if (state.playing) return;
    var n = state.n, L = state.L;
    state.playing = true;
    n.hint.classList.add('off');
    T(n.flap, 'transform 1.15s cubic-bezier(0.34, 1.18, 0.5, 1) 0s');
    n.flap.style.transform = 'rotateX(-78deg)';
    T(n.card, 'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1) 0.55s');
    n.card.style.transform = 'translateY(0px) scale(' + L.card.s + ')';
    T(n.envInner, 'opacity 0.3s ease 2.35s');
    n.envInner.style.opacity = '0';
    n.crum.style.animation = 'crumpleaway 1.8s cubic-bezier(0.45, 0, 0.6, 1) 2.3s both';
    T(n.cover, 'transform 1.5s cubic-bezier(0.34, 1.26, 0.64, 1) 3.4s');
    n.cover.style.transform = 'rotateY(-165deg)';
    T(n.pop, 'transform 0.95s cubic-bezier(0.34, 1.4, 0.64, 1) 4.6s');
    n.pop.style.transform = 'rotateX(0deg)';
    if (L.fadeCover) {
      T(n.front, 'opacity 0.6s ease 4.15s'); T(n.back, 'opacity 0.6s ease 4.15s');
      n.front.style.opacity = '0'; n.back.style.opacity = '0';
    }
    state.timers.push(setTimeout(startFx, 3900));
    state.timers.push(setTimeout(function () {
      state.finished = true; stageEl.classList.add('done');
      var c = document.getElementById('controls'); if (c) c.classList.add('show');
    }, 6800));
  }

  function finishNow() { // reduced motion: show the open card straight away
    var n = state.n, L = state.L;
    n.hint.classList.add('off');
    n.card.style.transform = 'translateY(0px) scale(' + L.card.s + ')';
    n.envInner.style.opacity = '0';
    n.cover.style.transform = 'rotateY(-165deg)';
    n.pop.style.transform = 'rotateX(0deg)';
    if (L.fadeCover) { n.front.style.opacity = '0'; n.back.style.opacity = '0'; }
    state.playing = true; state.finished = true; stageEl.classList.add('done');
    var c = document.getElementById('controls'); if (c) c.classList.add('show');
  }

  /* ---------- effects: confetti burst, confetti rain, warm bokeh ---------- */
  var CONF = {
    pink: 'linear-gradient(135deg,#F6C3CE 0%,#E58BA0 50%,#C96A80 60%,#F2AEC0 100%)',
    gold: 'linear-gradient(135deg,#FBEBB6 0%,#E8C25C 45%,#B98A2E 55%,#F4D689 100%)',
    peach: 'linear-gradient(135deg,#F8CCAE 0%,#EC9A6B 50%,#D47C4C 60%,#F4B98F 100%)',
    pearl: 'radial-gradient(circle at 35% 35%,#FFFDF5,#E8D9BD)'
  };
  function startFx() {
    var L = state.L, fx = state.n.fx, W = L.W, H = L.H;
    var cw = 480 * L.card.s, ch = 672 * L.card.s;
    var cx = L.area.x + L.card.left + 240, bottom = L.area.y + L.area.h - L.card.bottom, top = bottom - ch;
    var k = Math.max(W / 1200, 0.6);
    // confetti burst from the open card (same pieces and timing as the canvas animation)
    var burst = el('div', null, 'position:absolute;left:' + (cx + 0.013 * W) + 'px;top:' + (top + 0.31 * ch) + 'px;width:0;height:0;z-index:6', fx);
    [[10, 14, 2, 'pink', -280, -180, 260, 2.1, .6], [10, 14, 2, 'gold', -190, -260, -300, 2.2, .64], [10, 14, 2, 'peach', -90, -320, 220, 2.15, .6],
     [10, 14, 2, 'gold', 0, -340, -240, 2.25, .66], [10, 14, 2, 'pink', 100, -310, 280, 2.1, .62], [10, 14, 2, 'peach', 200, -250, -260, 2.2, .68],
     [10, 14, 2, 'gold', 290, -170, 240, 2.15, .6], [8, 8, 50, 'pearl', -240, -90, 0, 1.9, .7], [8, 8, 50, 'pink', -120, -200, 0, 2, .74],
     [8, 8, 50, 'gold', 130, -190, 0, 2, .72], [8, 8, 50, 'pearl', 250, -80, 0, 1.9, .7], [9, 12, 2, 'pink', -60, -240, 200, 1.8, 1.2],
     [9, 12, 2, 'gold', 60, -230, -220, 1.8, 1.24], [9, 12, 2, 'peach', -160, -150, 240, 1.75, 1.28], [9, 12, 2, 'pink', 170, -140, -200, 1.75, 1.22]].forEach(function (c) {
      el('div', null, 'position:absolute;width:' + c[0] + 'px;height:' + c[1] + 'px;border-radius:' + (c[2] === 50 ? '50%' : c[2] + 'px') + ';background:' + CONF[c[3]] +
        ';--dx:' + (c[4] * k) + 'px;--dy:' + c[5] + 'px;--rot:' + c[6] + 'deg;animation:confetti ' + c[7] + 's ease-out ' + c[8] + 's forwards;opacity:0', burst);
    });
    // confetti rain over the whole scene (loops while the card stays open)
    var rain = el('div', null, 'position:absolute;inset:0;z-index:6;overflow:hidden', fx);
    var rnd = mulberry(11), kinds = ['gold', 'pink', 'gold', 'peach', 'gold', 'pink', 'pearl', 'gold', 'peach', 'pink', 'gold', 'pearl', 'pink', 'gold', 'peach', 'gold'];
    var count = Math.round(16 * (W / 1200 + 0.4) / 1.4);
    for (var i = 0; i < count; i++) {
      var kind = kinds[i % kinds.length], round = kind === 'pearl';
      var w = round ? 7 + rnd() * 2 : 8 + rnd() * 4, h = round ? w : 12 + rnd() * 4;
      el('div', null, 'position:absolute;left:' + ((i + rnd() * 0.8) / count * W) + 'px;top:-20px;width:' + w.toFixed(1) + 'px;height:' + h.toFixed(1) + 'px;border-radius:' + (round ? '50%' : '2px') +
        ';background:' + CONF[kind] + ';' + (rnd() < 0.3 ? 'filter:blur(0.6px);' : '') + '--sw:' + Math.round((rnd() * 2 - 1) * 56) + 'px;--rot:' + Math.round((rnd() < 0.5 ? -1 : 1) * (280 + rnd() * 80)) + 'deg;--o:' + (0.75 + rnd() * 0.2).toFixed(2) +
        ';--fall:' + (H + 60) + 'px;animation:confettitumble ' + (5.7 + rnd() * 1.9).toFixed(1) + 's ease-in ' + (rnd() * 3).toFixed(1) + 's infinite;opacity:0', rain);
    }
    // warm bokeh rising around the open card
    var bk = el('div', null, 'position:absolute;inset:0;z-index:5', fx);
    [[-152, 0.47, 18, 5.2, 0.9], [-63, 0.28, 14, 6.1, 1.7], [36, 0.14, 20, 5.6, 1.2], [112, 0.42, 15, 6.4, 2.1], [166, 0.6, 22, 5.0, 1.4], [-100, 0.72, 16, 6.8, 2.6]].forEach(function (b) {
      el('div', null, 'position:absolute;left:' + (cx + b[0] * k) + 'px;top:' + (top + b[1] * ch) + 'px;width:' + b[2] + 'px;height:' + b[2] + 'px;border-radius:50%;' +
        'background:radial-gradient(circle,rgba(246,217,138,.9),rgba(246,217,138,0) 70%);filter:blur(1.5px);animation:bokehrise ' + b[3] + 's ease-in-out ' + b[4] + 's infinite;opacity:0', bk);
    });
  }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- inside-only view (editor live preview) ---------- */
  function buildInsideView(data) {
    document.body.classList.add('inside-view'); document.documentElement.classList.add('inside-view');
    ivwrap.innerHTML = '';
    var parts = buildInside(ivwrap, data, 30, true);
    function sc() { var s = Math.min(window.innerWidth / 480, window.innerHeight / 672); ivwrap.style.transform = 'translate(-50%,-50%) scale(' + s + ')'; }
    sc(); window.onresize = sc;
    fitText(parts);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitText(parts); });
  }

  /* ---------- boot ---------- */
  function boot() {
    var h = readHash();
    if (h.view === 'inside' && ivwrap) { buildInsideView(h.data); return; }
    if (!stageEl) return;
    build(h.data);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { finishNow(); startFx(); }
    else if (h.autoplay) state.timers.push(setTimeout(play, 700));
  }
  if (stageEl || ivwrap) {
    if (stageEl) {
      stageEl.addEventListener('click', function () { if (!state.playing) play(); });
      stageEl.setAttribute('role', 'button'); stageEl.setAttribute('tabindex', '0');
      stageEl.setAttribute('aria-label', 'Open the card');
      stageEl.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !state.playing) { e.preventDefault(); play(); } });
      var rp = document.getElementById('replay');
      if (rp) rp.addEventListener('click', function () { reset(); requestAnimationFrame(function () { requestAnimationFrame(play); }); });
      var shop = document.getElementById('shop');
      if (shop && CFG.shopUrl) { shop.href = CFG.shopUrl; shop.target = '_blank'; shop.rel = 'noopener'; shop.hidden = false; }
      window.addEventListener('resize', function () {
        if (!state.data || document.body.classList.contains('inside-view')) return;
        var L = pickLayout();
        if (L !== state.L && !state.playing) { build(state.data); } else { scaleStage(); }
      });
    }
    window.addEventListener('hashchange', boot);
    boot();
  }
})();
