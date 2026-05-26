// ============================================================================
//  Чтение числа из области canvas через template-matching.
//  Игра рисует цифры фиксированным пиксельным шрифтом -> сравнение глифов
//  надёжнее и легче OCR-либы. Шаги:
//    region -> crop -> бинаризация -> сегментация по столбцам ->
//    нормализация каждой цифры в сетку GW×GH -> сравнение с эталонами 0-9.
//  Эталоны и область храним в localStorage (переживают перезагрузку).
//  Калибровка: показать боту число (teach) — он разрежет и запомнит цифры.
// ============================================================================
import { grabBitmap } from './screenshot.js';

const LS = 'tarkanbot.ocr';
export const ocrState = { region: null, templates: {}, GW: 12, GH: 18 };

const FMT = 'gray1';   // формат эталонов; смена -> старые сбрасываются
function load() {
  try {
    const o = JSON.parse(localStorage.getItem(LS));
    if (o) {
      ocrState.region = o.region || null;
      ocrState.templates = o.fmt === FMT ? (o.templates || {}) : {};   // другой формат -> перекалибровка
    }
  } catch (e) {}
}
function save() {
  try { localStorage.setItem(LS, JSON.stringify({ fmt: FMT, region: ocrState.region, templates: ocrState.templates })); } catch (e) {}
}
load();

const cv = () => document.getElementById('canvas');

// --- выбор области: тянем рамку мышью поверх canvas -------------------------
// координаты экрана -> пиксели canvas (учёт DPR/масштаба)
export function pickRegion() {
  return new Promise(resolve => {
    const canvas = cv(); const r = canvas.getBoundingClientRect();
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;background:rgba(0,0,0,.12)';
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;border:2px solid #5fe0c0;background:rgba(95,224,192,.15);pointer-events:none';
    ov.appendChild(box); document.body.appendChild(ov);
    let sx = 0, sy = 0, drawing = false;
    const cleanup = () => { ov.remove(); window.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') { cleanup(); resolve(null); } };
    window.addEventListener('keydown', onKey, true);
    ov.onmousedown = e => { drawing = true; sx = e.clientX; sy = e.clientY;
      box.style.left = sx + 'px'; box.style.top = sy + 'px'; box.style.width = '0'; box.style.height = '0'; e.preventDefault(); };
    ov.onmousemove = e => { if (!drawing) return;
      const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
      box.style.left = x + 'px'; box.style.top = y + 'px';
      box.style.width = Math.abs(e.clientX - sx) + 'px'; box.style.height = Math.abs(e.clientY - sy) + 'px'; };
    ov.onmouseup = e => {
      cleanup();
      if (!drawing) { resolve(null); return; }
      const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
      const w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
      if (w < 4 || h < 4) { resolve(null); return; }
      const scaleX = canvas.width / r.width, scaleY = canvas.height / r.height;
      ocrState.region = {
        x: Math.round((x - r.left) * scaleX), y: Math.round((y - r.top) * scaleY),
        w: Math.round(w * scaleX), h: Math.round(h * scaleY),
      };
      save();
      resolve(ocrState.region);
    };
  });
}

// --- пиксели области --------------------------------------------------------
async function regionImageData() {
  const reg = ocrState.region;
  if (!reg) throw new Error('область не задана');
  const bmp = await grabBitmap();
  const c = document.createElement('canvas'); c.width = reg.w; c.height = reg.h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, reg.x, reg.y, reg.w, reg.h, 0, 0, reg.w, reg.h);
  return ctx.getImageData(0, 0, reg.w, reg.h);
}

// бинаризация: текст = меньшинство пикселей (авто light-on-dark / dark-on-light).
// thresh>0 -> ручной порог (для дебага); иначе авто (min+max)/2.
// Возвращает также серую карту (gray) и применённый порог (th) для визуализации.
function binarize(img, thresh) {
  const { width: w, height: h, data: d } = img;
  const lum = new Float32Array(w * h);
  let mn = 255, mx = 0;
  for (let i = 0; i < w * h; i++) {
    const L = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    lum[i] = L; if (L < mn) mn = L; if (L > mx) mx = L;
  }
  const th = thresh && thresh > 0 ? thresh : (mn + mx) / 2;
  let above = 0; for (let i = 0; i < w * h; i++) if (lum[i] > th) above++;
  const fgHigh = above <= w * h - above;                 // ярких меньше -> текст яркий
  const bin = new Uint8Array(w * h);
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) { gray[i] = lum[i]; bin[i] = ((lum[i] > th) === fgHigh) ? 1 : 0; }
  return { w, h, bin, gray, fgHigh, th: Math.round(th) };
}

// сегментация по столбцам -> боксы цифр (обрезанные по вертикали)
function segment({ w, h, bin }) {
  const col = new Int32Array(w);
  for (let x = 0; x < w; x++) { let c = 0; for (let y = 0; y < h; y++) c += bin[y * w + x]; col[x] = c; }
  const spans = []; let st = -1;
  for (let x = 0; x <= w; x++) {
    const on = x < w && col[x] > 0;
    if (on && st < 0) st = x;
    else if (!on && st >= 0) { if (x - st >= 2) spans.push([st, x]); st = -1; }
  }
  return spans.map(([x0, x1]) => {
    let y0 = h, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = x0; x < x1; x++) if (bin[y * w + x]) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, x1, y0, y1: y1 + 1 };
  }).filter(b => b.y1 > b.y0);
}

// бокс -> нормализованная серая сетка GW×GH (0-255).
// Используем полутона (anti-alias), приводим к "чернила=ярко" по полярности,
// и растягиваем контраст в 0-255 -> устойчиво к яркости/сглаживанию.
function normGray({ w, gray }, b, GW, GH, fgHigh) {
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  const tmp = new Float32Array(GW * GH);
  let mn = 255, mx = 0;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const sx = b.x0 + Math.floor(gx * bw / GW), sy = b.y0 + Math.floor(gy * bh / GH);
    let v = gray[sy * w + sx];
    if (!fgHigh) v = 255 - v;                  // полярность: чернила всегда ярко
    tmp[gy * GW + gx] = v; if (v < mn) mn = v; if (v > mx) mx = v;
  }
  const rng = mx - mn || 1;
  const out = new Uint8ClampedArray(GW * GH);
  for (let i = 0; i < tmp.length; i++) out[i] = Math.round((tmp[i] - mn) / rng * 255);
  return out;
}

// совпадение по средней абсолютной разнице яркостей -> err в [0..1]
function matchGray(grid, templates, GW, GH) {
  let best = null, bestErr = Infinity; const N = GW * GH;
  for (const dig in templates) {
    const t = templates[dig]; let s = 0;
    for (let i = 0; i < N; i++) s += Math.abs(grid[i] - t[i]);
    const err = s / (N * 255);
    if (err < bestErr) { bestErr = err; best = dig; }
  }
  return { digit: best, err: bestErr };
}

// --- ПУБЛИЧНОЕ --------------------------------------------------------------
// отбросить мелочь (двоеточие/точки) — боксы заметно ниже самого высокого
function dropSmall(boxes) {
  if (!boxes.length) return boxes;
  const maxH = Math.max(...boxes.map(b => b.y1 - b.y0));
  return boxes.filter(b => (b.y1 - b.y0) >= 0.5 * maxH);
}

// правейший кластер боксов (число справа, метка слева отделена большим зазором)
function clusterRight(boxes) {
  if (!boxes.length) return [];
  const avgW = boxes.reduce((s, b) => s + (b.x1 - b.x0), 0) / boxes.length;
  const cl = [[boxes[0]]];
  for (let i = 1; i < boxes.length; i++) {
    const gap = boxes[i].x0 - boxes[i - 1].x1;
    if (gap > 1.5 * avgW) cl.push([boxes[i]]); else cl[cl.length - 1].push(boxes[i]);
  }
  return cl[cl.length - 1];
}

// полный разбор области (для дебага И чтения). Возвращает bin, боксы с разметкой,
// выбранную группу, число. Логика анти-мусора: метка "Уровень:" слева; берём боксы,
// похожие на выученную цифру (err<=maxErr), затем правейший кластер (метка отделена зазором).
export async function analyze({ maxErr = 0.13, max = Infinity, thresh = 0 } = {}) {
  const { GW, GH, templates } = ocrState;
  if (!ocrState.region) return { ok: false, reason: 'нет области' };
  const { w, h, bin, gray, fgHigh, th } = binarize(await regionImageData(), thresh);
  const hasTpl = Object.keys(templates).length > 0;
  const boxes = dropSmall(segment({ w, h, bin })).map(b => {
    const m = hasTpl ? matchGray(normGray({ w, gray }, b, GW, GH, fgHigh), templates, GW, GH) : { digit: null, err: 1 };
    return { ...b, digit: m.digit, err: m.err, used: false };
  });
  const base = { w, h, bin, gray, th, boxes };
  if (!hasTpl) return { ...base, ok: false, reason: 'нет калибровки' };

  const cand = boxes.filter(b => b.digit != null && b.err <= maxErr);
  if (!cand.length) return { ...base, ok: false, reason: 'цифр не распознано' };
  const group = clusterRight(cand);
  group.forEach(b => { b.used = true; });
  const str = group.map(b => b.digit).join('');
  const err = Math.max(...group.map(b => b.err));
  const value = parseInt(str, 10);
  if (!Number.isFinite(value)) return { ...base, ok: false, reason: 'не число' };
  if (value > max) return { ...base, ok: false, reason: `${value} > лимита ${max}`, value, str, err, suspect: true };
  return { ...base, ok: true, value, str, err };
}

// прочитать число (тонкая обёртка над analyze)
export async function readNumber(opts) {
  const a = await analyze(opts);
  return a.ok ? { ok: true, value: a.value, str: a.str, err: a.err }
              : { ok: false, reason: a.reason, value: a.value ?? null, suspect: !!a.suspect };
}

// сдвиг/изменение области по пикселям (дебаг-панель). p = {x?,y?,w?,h?} абсолютные значения
export function setRegion(p) {
  const r = ocrState.region || { x: 0, y: 0, w: 40, h: 18 };
  Object.assign(r, p);
  r.x = Math.max(0, Math.round(r.x)); r.y = Math.max(0, Math.round(r.y));
  r.w = Math.max(2, Math.round(r.w)); r.h = Math.max(2, Math.round(r.h));
  ocrState.region = r; save();
  return r;
}

// обучить: known — число, реально видимое в рамке (напр. "380").
// Берём правейшие N боксов (N = длина числа) — метка "Уровень:" слева игнорируется.
export async function teach(known) {
  known = String(known).trim();
  if (!/^\d+$/.test(known)) return { ok: false, reason: 'нужны только цифры' };
  const B = binarize(await regionImageData());
  const group = clusterRight(dropSmall(segment(B)));      // те же боксы, что использует чтение
  if (!group.length) return { ok: false, reason: 'цифр не видно' };
  if (group.length !== known.length) {                    // сегментация разошлась с вводом — видно в дебаге
    return { ok: false, reason: `в рамке ${group.length} цифр, ввёл ${known.length} — глянь дебаг` };
  }
  const { GW, GH } = ocrState;
  for (let i = 0; i < group.length; i++) ocrState.templates[known[i]] = Array.from(normGray(B, group[i], GW, GH, B.fgHigh));
  save();
  return { ok: true, learned: Object.keys(ocrState.templates).sort().join('') };
}
