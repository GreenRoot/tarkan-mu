// ============================================================================
//  Панель управления — фикс снизу слева, поверх всего.
// ============================================================================
import { el, makeEditable } from './dom.js';
import { CSS } from './styles.js';
import { STAT_KEYS, STAT_DEFAULTS, INC_DEFAULTS, TIMING, AUTO_BASE, AUTO_STEP } from '../config.js';
import { statInputs, incInputs, timingInputs, statVal, incVal } from '../state.js';
import { focusGame, ENTER, ESCAPE } from '../keyboard.js';
import { chatCommand } from '../chat.js';
import { resetMzfk } from '../macro.js';
import { showShot } from '../screenshot.js';

export function buildUI() {
  document.getElementById('tarkan-bot-ui')?.remove();        // не плодим копии
  document.head.appendChild(el('style', {}, CSS));

  const logEl = el('div', { class: 'log' }, 'готов · жми кнопку');
  const log = m => { logEl.textContent = m; };

  // --- поля -----------------------------------------------------------------
  const iCmd   = el('input', { value: '/reset' });
  const iAfter = el('input', { class: 'sm', value: String(TIMING.afterReset) }); timingInputs.afterReset = iAfter;
  const iGap   = el('input', { class: 'sm', value: String(TIMING.gap) });        timingInputs.gap = iGap;
  const iBase  = el('input', { class: 'sm', value: String(AUTO_BASE) });  // базовый интервал авто, сек
  const iStep  = el('input', { class: 'sm', value: String(AUTO_STEP) });  // прибавка к интервалу за ресет, сек
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
    const s = Math.max(1, Math.round(curInt));
    nextAt = Date.now() + s * 1000; tick();
    auto = setTimeout(async () => {
      nextAt = 0; tick();
      log('авто RESET MZFK...');
      await doReset();
      curInt += (+iStep.value || 0);            // следующий интервал больше
      if (auto !== null) scheduleNext();
    }, s * 1000);
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
    curInt = Math.max(1, +iBase.value || AUTO_BASE);  // старт с базы
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
