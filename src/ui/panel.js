// ============================================================================
//  Панель управления (табы) + выезжающая слева дебаг-панель OCR.
// ============================================================================
import { el, makeEditable } from './dom.js';
import CSS from './styles.css';
import { STAT_KEYS, STAT_DEFAULTS, INC_DEFAULTS, TIMING, AUTO_BASE, AUTO_STEP } from '../config.js';
import { statInputs, incInputs, timingInputs, statVal, incVal } from '../state.js';
import { focusGame, ENTER, ESCAPE, press } from '../keyboard.js';
import { chatCommand } from '../chat.js';
import { resetMzfk } from '../macro.js';
import { showShot } from '../screenshot.js';
import { ocrState, pickRegion, readNumber, teach, analyze, setRegion } from '../ocr.js';

export function buildUI() {
  if (window.__tarkanStop) { try { window.__tarkanStop(); } catch (e) {} }  // глушим прошлый инстанс
  document.getElementById('tarkan-bot-ui')?.remove();
  document.getElementById('tarkan-ocr-box')?.remove();
  document.getElementById('tarkan-debug')?.remove();
  document.head.appendChild(el('style', {}, CSS));

  const logEl = el('div', { class: 'log' }, 'готов · жми кнопку');
  const log = m => { logEl.textContent = m; };
  const sec = t => el('div', { class: 'sec' }, t);
  const lbl = t => el('span', { class: 'lbl' }, t);

  // заголовок — показывает уровень (виден и в свёрнутом виде)
  const ttlEl = el('span', { class: 'ttl' }, '⚡ tarkan-bot');
  const setLevel = v => { ttlEl.textContent = v == null ? '⚡ tarkan-bot' : `⚡ tarkan-bot · ур ${v}`; };

  // тонкая рамка поверх читаемой области
  const hlBox = el('div', { id: 'tarkan-ocr-box', class: 'ocrbox' });
  document.body.appendChild(hlBox);
  let hlOn = true;
  const placeHighlight = () => {
    const reg = ocrState.region, canvas = document.getElementById('canvas');
    if (!reg || !canvas || !hlOn) { hlBox.style.display = 'none'; return; }
    const r = canvas.getBoundingClientRect();
    const sx = r.width / canvas.width, sy = r.height / canvas.height;
    hlBox.style.display = 'block';
    hlBox.style.left   = (r.left + reg.x * sx) + 'px';
    hlBox.style.top    = (r.top  + reg.y * sy) + 'px';
    hlBox.style.width  = (reg.w * sx) + 'px';
    hlBox.style.height = (reg.h * sy) + 'px';
  };
  addEventListener('resize', placeHighlight);
  addEventListener('scroll', placeHighlight, true);

  // --- поля -----------------------------------------------------------------
  const iCmd   = el('input', { value: '/reset' });
  const iAfter = el('input', { class: 'sm', value: String(TIMING.afterReset) }); timingInputs.afterReset = iAfter;
  const iGap   = el('input', { class: 'sm', value: String(TIMING.gap) });        timingInputs.gap = iGap;
  const iChar  = el('input', { class: 'sm', value: String(TIMING.char) });       timingInputs.char = iChar;
  const iOpen  = el('input', { class: 'sm', value: String(TIMING.open) });       timingInputs.open = iOpen;
  const iSend  = el('input', { class: 'sm', value: String(TIMING.send) });       timingInputs.send = iSend;
  const iBase  = el('input', { class: 'sm', value: String(AUTO_BASE) });
  const iStep  = el('input', { class: 'sm', value: String(AUTO_STEP) });
  const iLvl   = el('input', { class: 'sm', value: '380' });  // порог уровня
  const iMax   = el('input', { class: 'sm', value: '400' });  // лимит (выше = мусор)
  const iPoll  = el('input', { class: 'sm', value: '3' });    // опрос, сек
  const iErr   = el('input', { class: 'sm', value: '12' });   // макс ошибка совпадения, % (серошкала)
  const iThr   = el('input', { class: 'sm', value: '0' });    // ручной порог бинаризации (0=авто)
  const iLost  = el('input', { class: 'sm', value: '5' });    // нет уровня N сек -> нажать C
  [iCmd, iAfter, iGap, iChar, iOpen, iSend, iBase, iStep, iLvl, iMax, iPoll, iErr, iThr, iLost].forEach(makeEditable);
  const readMax = () => +iMax.value || 400;
  const readErr = () => (+iErr.value || 12) / 100;
  const readThr = () => +iThr.value || 0;

  // --- ряд стата: /k [значение] + [шаг] [го] --------------------------------
  const statRow = k => {
    const inp = el('input', { value: String(STAT_DEFAULTS[k]) });
    const inc = el('input', { class: 'sm', value: String(INC_DEFAULTS[k]) });
    statInputs[k] = inp; incInputs[k] = inc; makeEditable(inp); makeEditable(inc);
    const go = el('button', { class: 'go', onclick: () => {
      const v = +inp.value || 0;
      if (v <= 0) { log(`/${k}: 0 — пропуск`); return; }
      focusGame(); chatCommand(`/${k} ${v}`, { charDelay: +iChar.value || 12 }); log(`/${k} ${v}`);
    } }, 'го');
    return el('div', { class: 'row' }, el('span', { class: 'tag' }, '/' + k), inp,
      lbl('+'), inc, go);
  };

  // --- кнопки чата/клавиш ----------------------------------------------------
  const bOpen  = el('button', { onclick: () => { focusGame(); ENTER(); log('open'); } }, '↵open');
  const bSend2 = el('button', { onclick: () => { focusGame(); ENTER(); log('send'); } }, '⏎send');
  const bEsc   = el('button', { onclick: () => { ESCAPE(); log('Esc'); } }, 'Esc');
  const bShot  = el('button', { onclick: () => { log('📷...'); showShot(); } }, '📷');
  const bSend  = el('button', { onclick: () => { focusGame(); chatCommand(iCmd.value, { charDelay: +iChar.value || 12 }); } }, 'send');
  const bMacro = el('button', { class: 'big', onclick: () => {
    log('RESET MZFK...'); doReset().then(() => log('RESET MZFK ✓')); } }, '⚡ RESET MZFK');

  // --- статистика ------------------------------------------------------------
  let resets = 0, runMs = 0, runFrom = 0;
  const statsTxt = el('span', {}, '');
  const icReset  = el('span', { class: 'rst', title: 'сброс статистики' }, '✕');
  const statsEl  = el('div', { class: 'stats' }, statsTxt, icReset);
  const fmtHMS = s => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const renderStats = () => {
    const ms = runMs + (runFrom ? Date.now() - runFrom : 0);
    statsTxt.textContent = `ресетов: ${resets} · аптайм: ${fmtHMS(Math.floor(ms / 1000))}`;
  };
  icReset.onclick = () => { resets = 0; runMs = 0; runFrom = isRunning() ? Date.now() : 0; renderStats(); log('статистика сброшена'); };
  renderStats();

  const doReset = async () => {
    await resetMzfk();
    resets++;
    STAT_KEYS.forEach(k => { if (statInputs[k]) statInputs[k].value = statVal(k) + incVal(k); });
    renderStats();
  };

  // --- единый пульс: аптайм идёт пока активен ЛЮБОЙ авто; обновляет статы+отсчёт
  let auto = null, ocrIv = null, ocrBusy = false, nextAt = 0, curInt = 0;
  const countEl = el('div', { class: 'count' }, '');
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const isRunning = () => auto !== null || ocrIv !== null;
  const heartbeat = () => {
    const run = isRunning();
    if (run && !runFrom) runFrom = Date.now();
    else if (!run && runFrom) { runMs += Date.now() - runFrom; runFrom = 0; }
    renderStats();
    countEl.textContent = nextAt ? `след. reset через ${fmt(Math.max(0, Math.ceil((nextAt - Date.now()) / 1000)))}` : '';
  };
  const hbIv = setInterval(heartbeat, 500);

  // --- авто-повтор по таймеру (растущий интервал) ---------------------------
  const scheduleNext = () => {
    const s = Math.max(1, Math.round(curInt));
    nextAt = Date.now() + s * 1000; heartbeat();
    auto = setTimeout(async () => {
      nextAt = 0;
      log('авто RESET MZFK...');
      await doReset();
      curInt += (+iStep.value || 0);
      if (auto !== null) scheduleNext();
    }, s * 1000);
  };
  const bAuto = el('button', { class: 'run' }, '▶ АВТО');
  bAuto.onclick = async () => {
    if (auto !== null) {
      clearTimeout(auto); auto = null; nextAt = 0; heartbeat();
      bAuto.classList.remove('on'); bAuto.textContent = '▶ АВТО'; log('авто стоп'); return;
    }
    auto = -1; curInt = Math.max(1, +iBase.value || AUTO_BASE); heartbeat();
    bAuto.classList.add('on'); bAuto.textContent = '⏹ СТОП'; log('авто старт: RESET MZFK сейчас');
    await doReset();
    if (auto !== null) scheduleNext();
  };

  // --- OCR: чтение/калибровка ------------------------------------------------
  const ocrVal = el('span', { class: 'ocrval' }, ocrState.region ? '—' : 'нет обл.');
  const bRegion = el('button', { onclick: async () => {
    log('тяни рамку по числу (Esc — отмена)');
    const r = await pickRegion();
    log(r ? `область ${r.w}×${r.h}` : 'отмена');
    ocrVal.textContent = r ? '—' : 'нет обл.';
    syncReg();
  } }, 'обл.');
  const bTeach = el('button', { onclick: async () => {
    const known = prompt('Какое число сейчас в рамке? (обучение цифр)');
    if (!known) return;
    const res = await teach(known);
    log(res.ok ? `выучены цифры: ${res.learned}` : `учить: ${res.reason}`);
    if (dbgIv) refreshDbg();
  } }, 'учить');
  const bTest = el('button', { onclick: async () => {
    const r = await readNumber({ maxErr: readErr(), max: readMax() });
    placeHighlight();
    if (r.ok) { ocrVal.textContent = String(r.value); setLevel(r.value); log(`прочитано: ${r.value} (err ${Math.round(r.err * 100)}%)`); }
    else { ocrVal.textContent = r.suspect ? `?${r.value}` : '—'; log(`OCR: ${r.reason}`); }
  } }, 'тест');
  const bEye = el('button', { onclick: () => { hlOn = !hlOn; bEye.textContent = hlOn ? '👁' : '🚫'; placeHighlight(); } }, '👁');

  // --- ресет по уровню (опрос OCR) ------------------------------------------
  const bLvlAuto = el('button', { class: 'run' }, '▶ ресет по ур.');
  bLvlAuto.onclick = () => {
    if (ocrIv) {
      clearInterval(ocrIv); ocrIv = null; heartbeat();
      bLvlAuto.classList.remove('on'); bLvlAuto.textContent = '▶ ресет по ур.'; log('ур-авто стоп'); return;
    }
    if (!ocrState.region) { log('сначала задай область (вкладка OCR)'); return; }
    if (!Object.keys(ocrState.templates).length) { log('сначала откалибруй (вкладка OCR → учить)'); return; }
    const s = Math.max(1, +iPoll.value || 3);
    bLvlAuto.classList.add('on'); bLvlAuto.textContent = '⏹ стоп ур.'; log('ур-авто старт'); heartbeat();
    let lastOk = Date.now();                      // когда последний раз читали уровень
    ocrIv = setInterval(async () => {
      if (ocrBusy) return; ocrBusy = true;
      try {
        const r = await readNumber({ maxErr: readErr(), max: readMax() });
        placeHighlight();
        if (!r.ok) {                                // не видим уровень
          ocrVal.textContent = r.suspect ? `?${r.value}` : 'закрыто?';
          const lost = Math.max(1, +iLost.value || 5) * 1000;
          if (Date.now() - lastOk >= lost) {        // долго нет -> пробуем открыть окно (C)
            log('нет уровня → жму C');
            focusGame(); press('c', 67, 'KeyC');
            lastOk = Date.now();                    // ждём ещё интервал перед повтором
          } else { log(`ур не читается: ${r.reason}`); }
          return;
        }
        lastOk = Date.now();
        ocrVal.textContent = String(r.value); setLevel(r.value);
        const th = +iLvl.value || 380;
        if (r.value >= th) { log(`ур ${r.value} ≥ ${th} → RESET MZFK`); await doReset(); }
      } catch (e) { log('OCR ошибка'); }
      finally { ocrBusy = false; }
    }, s * 1000);
  };

  // ==========================================================================
  //  ДЕБАГ-ПАНЕЛЬ (слева): что видит алгоритм + попиксельный сдвиг рамки
  // ==========================================================================
  let dbgIv = null;
  const dbgCanvas = el('canvas', {});
  const dbgTxt = el('div', { class: 'dbgtxt' }, '—');

  // рендер: реальные полутона (серым) + что попало в "чернила" (cyan) + боксы
  const drawDebug = a => {
    const S = 5, w = a.w, h = a.h, PAD = 12;
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const oc = off.getContext('2d'); const id = oc.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      if (a.bin[i]) { id.data[o] = 95; id.data[o + 1] = 224; id.data[o + 2] = 192; }   // ink -> cyan
      else { const g = a.gray ? a.gray[i] : 0; id.data[o] = g; id.data[o + 1] = g; id.data[o + 2] = g; }
      id.data[o + 3] = 255;
    }
    oc.putImageData(id, 0, 0);
    dbgCanvas.width = w * S; dbgCanvas.height = h * S + PAD;
    const x = dbgCanvas.getContext('2d');
    x.fillStyle = '#0a0e13'; x.fillRect(0, 0, dbgCanvas.width, dbgCanvas.height);
    x.imageSmoothingEnabled = false;
    x.drawImage(off, 0, PAD, w * S, h * S);
    x.lineWidth = 1; x.font = 'bold 10px monospace'; x.textBaseline = 'bottom';
    for (const b of a.boxes) {
      const col = b.used ? '#5fe0c0' : (b.digit != null && b.err <= readErr() ? '#ffd25f' : '#e0556a');
      x.strokeStyle = col;
      x.strokeRect(b.x0 * S + 0.5, b.y0 * S + PAD + 0.5, (b.x1 - b.x0) * S - 1, (b.y1 - b.y0) * S - 1);
      x.fillStyle = col;
      x.fillText(b.digit != null ? `${b.digit}·${Math.round(b.err * 100)}` : '?', b.x0 * S, b.y0 * S + PAD - 1);
    }
  };
  const refreshDbg = async () => {
    if (!ocrState.region) { dbgTxt.textContent = 'нет области'; return; }
    try {
      const a = await analyze({ maxErr: readErr(), max: readMax(), thresh: readThr() });
      if (a.bin) drawDebug(a);
      const thInfo = a.th != null ? ` · th ${a.th}` : '';
      dbgTxt.textContent = (a.ok ? `= ${a.value} (err ${Math.round(a.err * 100)}%)` : `— ${a.reason}`) + thInfo;
      if (a.ok) setLevel(a.value);
      syncReg();
    } catch (e) { dbgTxt.textContent = 'ошибка чтения'; }
  };

  // попиксельный сдвиг рамки
  const regSpan = {};
  const syncReg = () => {
    const r = ocrState.region;
    ['x', 'y', 'w', 'h'].forEach(a => { if (regSpan[a]) regSpan[a].textContent = r ? r[a] : '—'; });
    placeHighlight();
  };
  const nudRow = axis => {
    const val = el('span', { class: 'nval' }, '—'); regSpan[axis] = val;
    const mk = d => el('button', { onclick: () => {
      const r = ocrState.region || { x: 0, y: 0, w: 40, h: 18 };
      setRegion({ [axis]: (r[axis] || 0) + d }); syncReg(); refreshDbg();
    } }, (d > 0 ? '+' : '') + d);
    return el('div', { class: 'row' }, el('span', { class: 'nlbl' }, axis), mk(-10), mk(-1), val, mk(1), mk(10));
  };

  const dbgClose = el('span', { class: 'ic' }, '✕');
  const dbgPanel = el('div', { id: 'tarkan-debug' },
    el('div', { class: 'hd' }, el('b', {}, 'OCR debug'), dbgClose),
    dbgCanvas,
    dbgTxt,
    el('div', { class: 'row' }, el('span', { class: 'nlbl' }, 'порог'), iThr,
      el('span', { class: 'leg', style: 'margin:0' }, '0 = авто')),
    nudRow('x'), nudRow('y'), nudRow('w'), nudRow('h'),
    el('div', { class: 'leg' }, 'серое = реальные полутона · cyan = «чернила» (порог) · рамки: взято / кандидат / мусор. подпись = цифра·ошибка%'),
  );
  document.body.appendChild(dbgPanel);
  const closeDbg = () => { dbgPanel.classList.remove('open'); if (dbgIv) { clearInterval(dbgIv); dbgIv = null; } };
  dbgClose.onclick = closeDbg;
  const bDbg = el('button', { onclick: () => {
    if (dbgPanel.classList.contains('open')) { closeDbg(); return; }
    dbgPanel.classList.add('open'); syncReg(); refreshDbg(); dbgIv = setInterval(refreshDbg, 800);
  } }, '🔧 дебаг');

  // ==========================================================================
  //  ТАБЫ
  // ==========================================================================
  const paneInput = el('div', { class: 'pane active' },
    el('div', { class: 'row' }, bOpen, bSend2, bEsc, bShot),
    el('div', { class: 'row' }, iCmd, bSend),
    sec('статы · 0 = пропуск'),
    statRow('a'), statRow('e'), statRow('f'), statRow('v'),
    bMacro,
    sec('тайминги, мс'),
    el('div', { class: 'row' }, lbl('после reset'), iAfter, lbl('между'), iGap),
    el('div', { class: 'row' }, lbl('печать'), iChar, lbl('откр'), iOpen, lbl('отпр'), iSend),
  );
  const paneTimer = el('div', { class: 'pane' },
    sec('авто, сек'),
    el('div', { class: 'row' }, lbl('база'), iBase, lbl('+ за ресет'), iStep),
    countEl,
    bAuto,
  );
  const paneLevel = el('div', { class: 'pane' },
    sec('ресет по уровню (OCR)'),
    el('div', { class: 'row' }, lbl('ур ≥'), iLvl, lbl('≤'), iMax),
    el('div', { class: 'row' }, lbl('опрос'), iPoll, lbl('с'), lbl('ошибка ≤'), iErr, lbl('%')),
    el('div', { class: 'row' }, lbl('нет ур →C через'), iLost, lbl('с')),
    bLvlAuto,
  );
  const paneOcr = el('div', { class: 'pane' },
    sec('область / калибровка'),
    el('div', { class: 'row' }, bRegion, bEye, bDbg),
    el('div', { class: 'row' }, bTeach, bTest, lbl('='), ocrVal),
  );

  const panes = [];
  const mkTab = (name, pane) => {
    const t = el('div', { class: 'tab' }, name);
    t.onclick = () => {
      panes.forEach(([tb, pn]) => { tb.classList.remove('active'); pn.classList.remove('active'); });
      t.classList.add('active'); pane.classList.add('active');
    };
    panes.push([t, pane]);
    return t;
  };
  const tabbar = el('div', { class: 'tabbar' },
    mkTab('ввод', paneInput), mkTab('таймер', paneTimer), mkTab('уровень', paneLevel), mkTab('OCR', paneOcr));
  panes[0][0].classList.add('active');

  // --- сборка ----------------------------------------------------------------
  const icMin = el('span', { class: 'ic', title: 'свернуть' }, '▾');
  const hd = el('div', { class: 'hd' }, ttlEl, icMin);
  const body = el('div', { class: 'body' }, tabbar, paneInput, paneTimer, paneLevel, paneOcr, statsEl, logEl);
  const ui = el('div', { id: 'tarkan-bot-ui' }, hd, body);
  document.body.appendChild(ui);

  icMin.onclick = () => { ui.classList.toggle('min'); icMin.textContent = ui.classList.contains('min') ? '▸' : '▾'; };

  // клик по нашим контролам не уводит фокус с игры (иначе SDL глохнет)
  [ui, dbgPanel].forEach(root => root.querySelectorAll('button, .ic, .rst, .tab')
    .forEach(b => b.addEventListener('mousedown', e => e.preventDefault())));

  // зонд: что реально долетело до игры
  const probe = e => log(`${e.type} which=${e.which} key="${e.key}"`);
  addEventListener('keydown', probe, true);
  addEventListener('keypress', probe, true);

  // перетаскивание за шапку
  let drag = null;
  hd.onmousedown = e => { if (e.target === icMin) return;
    drag = { x: e.clientX, y: e.clientY, l: ui.offsetLeft, t: ui.offsetTop }; e.preventDefault(); };
  const onMove = e => { if (!drag) return;
    ui.style.left = (drag.l + e.clientX - drag.x) + 'px';
    ui.style.top  = (drag.t + e.clientY - drag.y) + 'px';
    ui.style.bottom = 'auto'; placeHighlight(); };
  const onUp = () => drag = null;
  addEventListener('mousemove', onMove);
  addEventListener('mouseup', onUp);

  // --- сохранение всех настроек в localStorage (переживают перезагрузку) -----
  const CFG = 'tarkanbot.cfg';
  const cfgMap = () => ({
    cmd: iCmd, after: iAfter, gap: iGap, char: iChar, open: iOpen, send: iSend, base: iBase, step: iStep,
    lvl: iLvl, max: iMax, poll: iPoll, err: iErr, thr: iThr, lost: iLost,
    ...Object.fromEntries(STAT_KEYS.map(k => ['s_' + k, statInputs[k]])),
    ...Object.fromEntries(STAT_KEYS.map(k => ['i_' + k, incInputs[k]])),
  });
  const saveCfg = () => {
    try { const m = cfgMap(), o = {}; for (const k in m) if (m[k]) o[k] = m[k].value; localStorage.setItem(CFG, JSON.stringify(o)); } catch (e) {}
  };
  const loadCfg = () => {
    try { const o = JSON.parse(localStorage.getItem(CFG)); if (!o) return; const m = cfgMap(); for (const k in o) if (m[k]) m[k].value = o[k]; } catch (e) {}
  };
  loadCfg();
  let saveT; const saveDeb = () => { clearTimeout(saveT); saveT = setTimeout(saveCfg, 400); };
  Object.values(cfgMap()).forEach(inp => inp && inp.addEventListener('keyup', saveDeb));

  syncReg();          // показать рамку + значения, если область сохранена

  // стоп прошлого инстанса при перевставке (без кнопки закрытия)
  window.__tarkanStop = () => {
    if (auto !== null) clearTimeout(auto);
    clearInterval(hbIv); if (ocrIv) clearInterval(ocrIv); if (dbgIv) clearInterval(dbgIv);
    removeEventListener('keydown', probe, true);
    removeEventListener('keypress', probe, true);
    removeEventListener('resize', placeHighlight);
    removeEventListener('scroll', placeHighlight, true);
    removeEventListener('mousemove', onMove);
    removeEventListener('mouseup', onUp);
    document.getElementById('tarkan-ocr-box')?.remove();
    document.getElementById('tarkan-debug')?.remove();
  };
}
