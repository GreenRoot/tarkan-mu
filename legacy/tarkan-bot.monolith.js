// ============================================================================
//  tarkan-bot.js  —  инъекция клавиш + чат-команды + скриншот canvas
//  Игра: SDL2/Emscripten (tarkan.gg). Текст читается из key-событий напрямую.
//  Использование: вставить в консоль DevTools или обернуть в Tampermonkey.
// ============================================================================

// Диспатчим на canvas — событие с bubbles:true всплывёт до document и window,
// поэтому покроет слушатель SDL, куда бы он ни был навешан.
const TARGET = document.getElementById('canvas') || window;
// canvas без tabindex не фокусируется -> добавляем, чтобы вернуть фокус игре
if (TARGET.setAttribute) TARGET.setAttribute('tabindex', '-1');
function focusGame() { try { TARGET.focus({ preventScroll: true }); } catch (e) {} }

// --- раскладка: символ -> e.code / legacy keyCode --------------------------
function codeFor(ch) {
  if (/[a-z]/i.test(ch)) return 'Key' + ch.toUpperCase();
  if (/[0-9]/.test(ch))  return 'Digit' + ch;
  return ({ ' ':'Space','/':'Slash','.':'Period',',':'Comma',
            '-':'Minus','=':'Equal' })[ch] || '';
}
function keyCodeFor(ch) {
  if (/[a-z]/i.test(ch)) return ch.toUpperCase().charCodeAt(0); // 65..90
  if (/[0-9]/.test(ch))  return ch.charCodeAt(0);               // 48..57
  return ({ ' ':32,'/':191,'.':190,',':188,'-':189,'=':187 })[ch]
         || ch.charCodeAt(0);
}

// --- сборка одного KeyboardEvent с принудительными legacy-полями ------------
function makeEvt(type, key, extra = {}) {
  const e = new KeyboardEvent(type, {
    bubbles: true, cancelable: true, composed: true,
    key, code: extra.code ?? codeFor(key), location: 0, repeat: false,
    ctrlKey: !!extra.ctrlKey, shiftKey: !!extra.shiftKey,
    altKey: !!extra.altKey,  metaKey: !!extra.metaKey,
  });
  const kc = extra.keyCode ?? keyCodeFor(key);
  const cc = type === 'keypress' ? (extra.charCode ?? key.charCodeAt(0)) : 0;
  // конструктор эти поля игнорирует — переопределяем руками
  Object.defineProperties(e, {
    keyCode:  { get: () => kc },
    which:    { get: () => (type === 'keypress' ? cc : kc) },
    charCode: { get: () => cc },
  });
  return e;
}

// --- печать одного печатного символа (keydown+keypress+keyup) ---------------
function tap(ch, extra = {}) {
  TARGET.dispatchEvent(makeEvt('keydown',  ch, extra));
  TARGET.dispatchEvent(makeEvt('keypress', ch, extra)); // <- сюда идёт текст
  TARGET.dispatchEvent(makeEvt('keyup',    ch, extra));
}

// --- управляющая клавиша: keydown -> УДЕРЖАНИЕ -> keyup ----------------------
// Игра считает нажатия по фронту: клавишу надо отпускать, но мгновенный keyup
// в том же кадре закрывает чат. Поэтому держим ~60мс, как настоящая клавиша.
async function press(keyName, keyCode, code, hold = 60) {
  TARGET.dispatchEvent(makeEvt('keydown', keyName, { keyCode, code }));
  await new Promise(r => setTimeout(r, hold));
  TARGET.dispatchEvent(makeEvt('keyup', keyName, { keyCode, code }));
}
// Enter: чат закрыт -> откроет, чат открыт -> отправит (одно удержание)
const ENTER     = () => press('Enter',     13, 'Enter');
const BACKSPACE = () => press('Backspace',  8, 'Backspace');
const ESCAPE    = () => press('Escape',    27, 'Escape');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- печать строки посимвольно ----------------------------------------------
async function typeText(str, delay = 30) {
  for (const ch of str) { tap(ch); await sleep(delay); }
}

// --- полный цикл: открыть чат -> напечатать -> отправить --------------------
async function chatCommand(cmd, { openDelay = 150, charDelay = 40, sendDelay = 150 } = {}) {
  focusGame();              // вернуть фокус игре, иначе ввод игнорируется
  await ENTER();            // открыть чат
  await sleep(openDelay);
  await typeText(cmd, charDelay);
  await sleep(sendDelay);
  await ENTER();            // отправить
}

// --- статы: общий стор, читают и кнопки "го", и макрос ----------------------
const STAT_KEYS = ['a', 'e', 'f', 'v'];
const STAT_DEFAULTS = { a: 14982, e: 14970, f: 982, v: 985 };
const INC_DEFAULTS  = { a: 50, e: 50, f: 50, v: 0 };   // прибавка к стату за ресет
const statInputs = {};                         // ссылки на поля значений (заполняет buildUI)
const incInputs  = {};                         // ссылки на поля прибавки
const statVal = k => statInputs[k] ? (+statInputs[k].value || 0) : (STAT_DEFAULTS[k] || 0);
const incVal  = k => incInputs[k]  ? (+incInputs[k].value  || 0) : 0;

// --- тайминги: тоже из панели, с дефолтами и возможностью оверрайда ----------
const TIMING = { afterReset: 800, gap: 800 };  // мс
const timingInputs = {};                       // ссылки на поля панели
const timingVal = k => timingInputs[k] ? (+timingInputs[k].value || TIMING[k]) : TIMING[k];

// --- макрос RESET MZFK: /reset -> пауза -> раздача статов (0 пропускается) ---
async function resetMzfk(afterReset, gap) {
  afterReset = afterReset ?? timingVal('afterReset');
  gap        = gap        ?? timingVal('gap');
  focusGame();
  await chatCommand('/reset', { openDelay: 120, charDelay: 25, sendDelay: 120 });
  await sleep(afterReset);                      // даём серверу применить ресет
  for (const k of STAT_KEYS) {
    const v = statVal(k);
    if (v <= 0) continue;                       // 0 -> команда не выполняется
    await chatCommand(`/${k} ${v}`, { openDelay: 120, charDelay: 25, sendDelay: 120 });
    await sleep(gap);
  }
}

// ============================================================================
//  СКРИНШОТ CANVAS
//  WebGL обычно с preserveDrawingBuffer:false -> toDataURL даёт чёрный кадр.
//  Хук на requestAnimationFrame ловит кадр сразу после отрисовки игрой.
// ============================================================================
const _cv = document.getElementById('canvas');

// запасной путь: rAF-хук + toDataURL (работает только если буфер ещё цел)
window.__shot = null; window.__grab = false;
(function hookRAF() {
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => {
    cb(t);
    if (window.__grab) { window.__grab = false;
      try { window.__shot = _cv.toDataURL('image/png'); } catch (e) {} }
  });
})();
function shotViaRAF() {
  return new Promise(res => { window.__grab = true;
    const i = setInterval(() => { if (window.__shot) { clearInterval(i);
      const s = window.__shot; window.__shot = null; res(s); } }, 16); });
}

// ОСНОВНОЙ путь: captureStream компоновщика — не зависит от preserveDrawingBuffer
async function shotBlob() {
  try {
    const stream = _cv.captureStream();
    const track = stream.getVideoTracks()[0];
    const bmp = await new ImageCapture(track).grabFrame();
    track.stop();
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    return await new Promise(r => c.toBlob(r, 'image/png'));
  } catch (e) {                                   // запасной путь
    const url = await shotViaRAF();
    return await (await fetch(url)).blob();
  }
}
// dataURL текущего кадра
async function screenshot() {
  const b = await shotBlob();
  return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
}
// открыть кадр в новой вкладке (blob-URL надёжнее огромного dataURL)
async function showShot() { window.open(URL.createObjectURL(await shotBlob()), '_blank'); }

// ============================================================================
//  ПАНЕЛЬ UI — фикс снизу слева, поверх всего
// ============================================================================
// мини-хелпер: el('button',{onclick,class},'текст')
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k.startsWith('on')) n[k] = v;
    else n.setAttribute(k, v);
  }
  for (const k of kids) n.append(k);
  return n;
}

// SDL делает preventDefault на клавишах -> браузер не печатает в наши поля.
// Поэтому редактируем значение вручную в обработчике на самом инпуте.
function makeEditable(inp) {
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    const v = inp.value, s = inp.selectionStart, en = inp.selectionEnd, k = e.key;
    const set = (nv, c) => { inp.value = nv; inp.selectionStart = inp.selectionEnd = c; };
    if (k === 'Backspace')      s !== en ? set(v.slice(0,s)+v.slice(en), s) : s>0 && set(v.slice(0,s-1)+v.slice(en), s-1);
    else if (k === 'Delete')    s !== en ? set(v.slice(0,s)+v.slice(en), s) : set(v.slice(0,s)+v.slice(s+1), s);
    else if (k === 'ArrowLeft') inp.selectionStart = inp.selectionEnd = Math.max(0, s-1);
    else if (k === 'ArrowRight')inp.selectionStart = inp.selectionEnd = Math.min(v.length, en+1);
    else if (k === 'Home')      inp.selectionStart = inp.selectionEnd = 0;
    else if (k === 'End')       inp.selectionStart = inp.selectionEnd = v.length;
    else if (k.length === 1)    set(v.slice(0,s)+k+v.slice(en), s+1);
  }, false);
}
function buildUI() {
  document.getElementById('tarkan-bot-ui')?.remove();        // не плодим копии

  const css = `
    #tarkan-bot-ui{position:fixed;left:8px;bottom:8px;z-index:2147483647;
      font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#dce8f0;
      width:250px;border:1px solid #243240;border-radius:11px;overflow:hidden;
      background:linear-gradient(180deg,rgba(16,22,30,.97),rgba(9,13,18,.98));
      box-shadow:0 10px 34px rgba(0,0,0,.6);user-select:none;backdrop-filter:blur(4px)}
    #tarkan-bot-ui *{box-sizing:border-box;font:inherit}
    #tarkan-bot-ui .hd{display:flex;align-items:center;gap:6px;cursor:move;padding:8px 10px;
      background:linear-gradient(180deg,#172533,#0d1620);border-bottom:1px solid #243240}
    #tarkan-bot-ui .ttl{flex:1;font-weight:700;letter-spacing:.4px;color:#5fe0c0}
    #tarkan-bot-ui .ic{cursor:pointer;color:#8aa1b0;padding:0 4px;font-size:12px}
    #tarkan-bot-ui .ic:hover{color:#fff}
    #tarkan-bot-ui .body{padding:8px 10px 10px}
    #tarkan-bot-ui.min .body{display:none}
    #tarkan-bot-ui .sec{margin:10px 0 3px;color:#577086;font-size:9px;
      text-transform:uppercase;letter-spacing:1.2px}
    #tarkan-bot-ui .sec:first-child{margin-top:0}
    #tarkan-bot-ui .row{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0;align-items:center}
    #tarkan-bot-ui input{flex:1;min-width:0;background:#070b10;border:1px solid #243240;
      border-radius:5px;color:#dce8f0;padding:4px 6px;outline:none}
    #tarkan-bot-ui input:focus{border-color:#3f6f8f}
    #tarkan-bot-ui input.sm{flex:0 0 52px;text-align:center}
    #tarkan-bot-ui button{background:#16222e;border:1px solid #2c4254;border-radius:5px;
      color:#dce8f0;padding:4px 8px;cursor:pointer;white-space:nowrap;transition:.1s}
    #tarkan-bot-ui button:hover{background:#1f3242;border-color:#3a5a72}
    #tarkan-bot-ui button:active{transform:translateY(1px)}
    #tarkan-bot-ui .tag{flex:0 0 24px;color:#7fd9c0;font-weight:700;text-align:center}
    #tarkan-bot-ui .go{flex:0 0 40px;background:#123e2c;border-color:#1c6b48;
      color:#7df0b8;text-align:center;font-weight:700}
    #tarkan-bot-ui .go:hover{background:#1a5c40}
    #tarkan-bot-ui .lbl{flex:0 0 auto;color:#6f87a0;padding:0 1px}
    #tarkan-bot-ui .big{width:100%;margin-top:9px;padding:9px;font-weight:700;letter-spacing:.6px;
      background:linear-gradient(180deg,#8a2222,#681616);border-color:#c44;color:#ffe6e0}
    #tarkan-bot-ui .big:hover{background:linear-gradient(180deg,#a82a2a,#7e1e1e)}
    #tarkan-bot-ui .run{width:100%;margin-top:6px;padding:8px;font-weight:700;letter-spacing:.4px;
      background:linear-gradient(180deg,#15633f,#0d4a2e);border-color:#1c8b5a;color:#cffce4}
    #tarkan-bot-ui .run:hover{background:linear-gradient(180deg,#1a7a4d,#115a39)}
    #tarkan-bot-ui .run.on{background:linear-gradient(180deg,#8a2222,#681616);border-color:#d55;color:#ffe6e0}
    #tarkan-bot-ui .count{margin-top:7px;text-align:center;color:#9bd9c4;font-weight:700;
      letter-spacing:.5px;min-height:14px}
    #tarkan-bot-ui .stats{margin-top:7px;display:flex;justify-content:center;align-items:center;
      gap:6px;color:#7088a0;font-size:10px}
    #tarkan-bot-ui .rst{cursor:pointer;color:#5a6f82;font-size:9px;border:1px solid #2a3a4a;
      border-radius:3px;padding:0 4px;line-height:14px}
    #tarkan-bot-ui .rst:hover{color:#ff9a9a;border-color:#a44}
    #tarkan-bot-ui .log{margin-top:9px;padding:6px 8px;border-radius:5px;background:#070b10;
      border:1px solid #1a2530;color:#7fb89f;min-height:15px;word-break:break-all;font-size:10px}`;
  document.head.appendChild(el('style', {}, css));

  const logEl = el('div', { class: 'log' }, 'готов · жми кнопку');
  const log = m => { logEl.textContent = m; };

  // --- поля -----------------------------------------------------------------
  const iCmd  = el('input', { value: '/reset' });
  const iAfter = el('input', { class: 'sm', value: String(TIMING.afterReset) }); timingInputs.afterReset = iAfter;
  const iGap   = el('input', { class: 'sm', value: String(TIMING.gap) });        timingInputs.gap = iGap;
  const iBase = el('input', { class: 'sm', value: '300' });  // базовый интервал авто, сек
  const iStep = el('input', { class: 'sm', value: '10' });   // прибавка к интервалу за ресет, сек
  [iCmd, iAfter, iGap, iBase, iStep].forEach(makeEditable);

  // --- ряд стата: /k [значение] + [шаг] [го]  (0 значение -> пропуск) --------
  const statRow = k => {
    const inp = el('input', { value: String(STAT_DEFAULTS[k]) });
    const inc = el('input', { class: 'sm', value: String(INC_DEFAULTS[k]) });
    statInputs[k] = inp; incInputs[k] = inc; makeEditable(inp); makeEditable(inc);
    const go = el('button', { class: 'go', onclick: () => {
      const v = +inp.value || 0;
      if (v <= 0) { log(`/${k}: 0 — пропуск`); return; }
      focusGame(); chatCommand(`/${k} ${v}`); log(`/${k} ${v}`);
    } }, 'го');
    return el('div', { class: 'row' }, el('span', { class: 'tag' }, '/' + k), inp,
      el('span', { class: 'lbl' }, '+'), inc, go);
  };

  // --- кнопки чата/клавиш ----------------------------------------------------
  const bOpen  = el('button', { onclick: () => { focusGame(); ENTER(); log('open'); } }, '↵open');
  const bSend2 = el('button', { onclick: () => { focusGame(); ENTER(); log('send'); } }, '⏎send');
  const bEsc   = el('button', { onclick: () => { ESCAPE(); log('Esc'); } }, 'Esc');
  const bShot  = el('button', { onclick: () => { log('📷...'); showShot(); } }, '📷');
  const bSend  = el('button', { onclick: () => { focusGame(); chatCommand(iCmd.value); } }, 'send');
  const bMacro = el('button', { class: 'big', onclick: () => {
    log('RESET MZFK...'); doReset().then(() => log('RESET MZFK ✓')); } }, '⚡ RESET MZFK');

  // --- статистика: счётчик ресетов + аптайм ----------------------------------
  let resets = 0, runMs = 0, runFrom = 0;       // runFrom!=0 -> идёт отсчёт аптайма
  const statsTxt = el('span', {}, '');
  const icReset  = el('span', { class: 'rst', title: 'сброс статистики' }, '✕');
  const statsEl  = el('div', { class: 'stats' }, statsTxt, icReset);
  const fmtHMS = s => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const renderStats = () => {
    const ms = runMs + (runFrom ? Date.now() - runFrom : 0);
    statsTxt.textContent = `ресетов: ${resets} · аптайм: ${fmtHMS(Math.floor(ms / 1000))}`;
  };
  icReset.onclick = () => {
    resets = 0; runMs = 0; runFrom = runFrom ? Date.now() : 0;  // обнулить, не ломая текущий отсчёт
    renderStats(); log('статистика сброшена');
  };
  renderStats();

  // один ресет: макрос -> счётчик++ -> прибавка к статам -> перерисовка
  const doReset = async () => {
    await resetMzfk();
    resets++;
    STAT_KEYS.forEach(k => { if (statInputs[k]) statInputs[k].value = statVal(k) + incVal(k); });
    renderStats();
  };

  // --- авто-повтор: сразу + интервал, растущий на "прибавку" каждый ресет ----
  let auto = null;          // null=стоп, иначе активен (-1 или handle)
  let countIv = null;       // интервал обновления отсчёта/аптайма
  let nextAt = 0;           // timestamp следующего ресета
  let curInt = 0;           // текущий интервал, сек
  const countEl = el('div', { class: 'count' }, '');
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const tick = () => {
    renderStats();
    if (!nextAt) { countEl.textContent = ''; return; }
    const left = Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
    countEl.textContent = `след. reset через ${fmt(left)}`;
  };
  const scheduleNext = () => {
    const sec = Math.max(1, Math.round(curInt));
    nextAt = Date.now() + sec * 1000; tick();
    auto = setTimeout(async () => {
      nextAt = 0; tick();
      log('авто RESET MZFK...');
      await doReset();
      curInt += (+iStep.value || 0);            // следующий интервал больше
      if (auto !== null) scheduleNext();
    }, sec * 1000);
  };
  const bAuto = el('button', { class: 'run' }, '▶ АВТО');
  bAuto.onclick = async () => {
    if (auto !== null) {                        // стоп
      clearTimeout(auto); clearInterval(countIv); auto = null; nextAt = 0;
      runMs += runFrom ? Date.now() - runFrom : 0; runFrom = 0;   // зафиксировать аптайм
      tick();
      bAuto.classList.remove('on'); bAuto.textContent = '▶ АВТО';
      log('авто стоп'); return;
    }
    auto = -1;                                  // маркер "активно" до первого таймаута
    curInt = Math.max(1, +iBase.value || 300);  // старт с базы
    runFrom = Date.now();
    countIv = setInterval(tick, 500);
    bAuto.classList.add('on'); bAuto.textContent = '⏹ СТОП';
    log('авто старт: RESET MZFK сейчас');
    await doReset();
    if (auto !== null) scheduleNext();
  };

  // --- шапка: title + свернуть + закрыть -------------------------------------
  const icMin   = el('span', { class: 'ic', title: 'свернуть' }, '▾');
  const icClose = el('span', { class: 'ic', title: 'закрыть' }, '✕');
  const hd = el('div', { class: 'hd' }, el('span', { class: 'ttl' }, '⚡ tarkan-bot'), icMin, icClose);

  const sec = t => el('div', { class: 'sec' }, t);
  const lbl = t => el('span', { class: 'lbl' }, t);
  const body = el('div', { class: 'body' },
    el('div', { class: 'row' }, bOpen, bSend2, bEsc, bShot),
    el('div', { class: 'row' }, iCmd, bSend),
    sec('статы · 0 = пропуск'),
    statRow('a'), statRow('e'), statRow('f'), statRow('v'),
    bMacro,
    sec('паузы, мс'),
    el('div', { class: 'row' }, lbl('после reset'), iAfter, lbl('между'), iGap),
    sec('авто, сек'),
    el('div', { class: 'row' }, lbl('база'), iBase, lbl('+ за ресет'), iStep),
    countEl,
    bAuto,
    statsEl,
    logEl,
  );
  const ui = el('div', { id: 'tarkan-bot-ui' }, hd, body);
  document.body.appendChild(ui);

  // свернуть/развернуть
  icMin.onclick = () => { ui.classList.toggle('min'); icMin.textContent = ui.classList.contains('min') ? '▸' : '▾'; };

  // КЛЮЧЕВОЕ: клик по кнопке не уводит фокус с игры (иначе SDL глохнет)
  ui.querySelectorAll('button, .ic, .rst').forEach(b =>
    b.addEventListener('mousedown', e => e.preventDefault()));

  // зонд: что реально долетело до игры
  const probe = e => log(`${e.type} which=${e.which} key="${e.key}"`);
  addEventListener('keydown',  probe, true);
  addEventListener('keypress', probe, true);
  icClose.onclick = () => {
    if (auto !== null) { clearTimeout(auto); clearInterval(countIv); auto = null; }   // глушим авто-цикл
    removeEventListener('keydown',  probe, true);
    removeEventListener('keypress', probe, true);
    STAT_KEYS.forEach(k => { delete statInputs[k]; delete incInputs[k]; });
    timingInputs.afterReset = timingInputs.gap = undefined;
    ui.remove();
  };

  // перетаскивание за шапку
  let drag = null;
  hd.onmousedown = e => { if (e.target === icMin || e.target === icClose) return;
    drag = { x: e.clientX, y: e.clientY, l: ui.offsetLeft, t: ui.offsetTop }; e.preventDefault(); };
  addEventListener('mousemove', e => { if (!drag) return;
    ui.style.left = (drag.l + e.clientX - drag.x) + 'px';
    ui.style.top  = (drag.t + e.clientY - drag.y) + 'px';
    ui.style.bottom = 'auto'; });
  addEventListener('mouseup', () => drag = null);
}
buildUI();

// ============================================================================
//  ЭКСПОРТ в window для удобства из консоли
// ============================================================================
Object.assign(window, {
  tap, typeText, chatCommand, resetMzfk, ENTER, BACKSPACE, ESCAPE, screenshot, showShot, buildUI, focusGame,
});
console.log('%ctarkan-bot готов', 'color:#0f0',
  '\n  панель снизу слева. либо из консоли:\n  chatCommand("/reset")  ·  await screenshot()  ·  showShot()');
