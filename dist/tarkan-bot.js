// tarkan-bot v1.3.0 — собрано из src/. Вставить целиком в консоль DevTools (F12).
(() => {
  // src/keyboard.js
  var TARGET = typeof document !== "undefined" && document.getElementById("canvas") || (typeof window !== "undefined" ? window : null);
  function setTarget(t) {
    if (t) TARGET = t;
    if (TARGET && TARGET.setAttribute) TARGET.setAttribute("tabindex", "-1");
  }
  setTarget(TARGET);
  function focusGame() {
    try {
      TARGET.focus({ preventScroll: true });
    } catch (e) {
    }
  }
  function codeFor(ch) {
    if (/[a-z]/i.test(ch)) return "Key" + ch.toUpperCase();
    if (/[0-9]/.test(ch)) return "Digit" + ch;
    return {
      " ": "Space",
      "/": "Slash",
      ".": "Period",
      ",": "Comma",
      "-": "Minus",
      "=": "Equal"
    }[ch] || "";
  }
  function keyCodeFor(ch) {
    if (/[a-z]/i.test(ch)) return ch.toUpperCase().charCodeAt(0);
    if (/[0-9]/.test(ch)) return ch.charCodeAt(0);
    return { " ": 32, "/": 191, ".": 190, ",": 188, "-": 189, "=": 187 }[ch] || ch.charCodeAt(0);
  }
  function makeEvt(type, key, extra = {}) {
    const e = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      key,
      code: extra.code ?? codeFor(key),
      location: 0,
      repeat: false,
      ctrlKey: !!extra.ctrlKey,
      shiftKey: !!extra.shiftKey,
      altKey: !!extra.altKey,
      metaKey: !!extra.metaKey
    });
    const kc = extra.keyCode ?? keyCodeFor(key);
    const cc = type === "keypress" ? extra.charCode ?? key.charCodeAt(0) : 0;
    Object.defineProperties(e, {
      keyCode: { get: () => kc },
      which: { get: () => type === "keypress" ? cc : kc },
      charCode: { get: () => cc }
    });
    return e;
  }
  function tap(ch, extra = {}) {
    TARGET.dispatchEvent(makeEvt("keydown", ch, extra));
    TARGET.dispatchEvent(makeEvt("keypress", ch, extra));
    TARGET.dispatchEvent(makeEvt("keyup", ch, extra));
  }
  async function press(keyName, keyCode, code, hold = 60) {
    TARGET.dispatchEvent(makeEvt("keydown", keyName, { keyCode, code }));
    await new Promise((r) => setTimeout(r, hold));
    TARGET.dispatchEvent(makeEvt("keyup", keyName, { keyCode, code }));
  }
  var ENTER = () => press("Enter", 13, "Enter");
  var BACKSPACE = () => press("Backspace", 8, "Backspace");
  var ESCAPE = () => press("Escape", 27, "Escape");

  // src/chat.js
  var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function typeText(str, delay = 30) {
    for (const ch of str) {
      tap(ch);
      await sleep(delay);
    }
  }
  async function chatCommand(cmd, { openDelay = 150, charDelay = 40, sendDelay = 150 } = {}) {
    focusGame();
    await ENTER();
    await sleep(openDelay);
    await typeText(cmd, charDelay);
    await sleep(sendDelay);
    await ENTER();
  }

  // src/config.js
  var STAT_KEYS = ["a", "e", "f", "v"];
  var STAT_DEFAULTS = { a: 14982, e: 14970, f: 982, v: 985 };
  var INC_DEFAULTS = { a: 50, e: 50, f: 50, v: 0 };
  var TIMING = { afterReset: 800, gap: 800 };
  var AUTO_BASE = 300;
  var AUTO_STEP = 10;

  // src/state.js
  var statInputs = {};
  var incInputs = {};
  var timingInputs = {};
  var statVal = (k) => statInputs[k] ? +statInputs[k].value || 0 : STAT_DEFAULTS[k] || 0;
  var incVal = (k) => incInputs[k] ? +incInputs[k].value || 0 : 0;
  var timingVal = (k) => timingInputs[k] ? +timingInputs[k].value || TIMING[k] : TIMING[k];

  // src/macro.js
  async function resetMzfk(afterReset, gap) {
    afterReset = afterReset ?? timingVal("afterReset");
    gap = gap ?? timingVal("gap");
    focusGame();
    await chatCommand("/reset", { openDelay: 120, charDelay: 25, sendDelay: 120 });
    await sleep(afterReset);
    for (const k of STAT_KEYS) {
      const v = statVal(k);
      if (v <= 0) continue;
      await chatCommand(`/${k} ${v}`, { openDelay: 120, charDelay: 25, sendDelay: 120 });
      await sleep(gap);
    }
  }

  // src/screenshot.js
  var cv = () => document.getElementById("canvas");
  window.__shot = null;
  window.__grab = false;
  (function hookRAF() {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => {
      cb(t);
      if (window.__grab) {
        window.__grab = false;
        try {
          window.__shot = cv()?.toDataURL("image/png");
        } catch (e) {
        }
      }
    });
  })();
  function shotViaRAF() {
    return new Promise((res) => {
      window.__grab = true;
      const i = setInterval(() => {
        if (window.__shot) {
          clearInterval(i);
          const s = window.__shot;
          window.__shot = null;
          res(s);
        }
      }, 16);
    });
  }
  async function grabBitmap() {
    try {
      const stream = cv().captureStream();
      const track = stream.getVideoTracks()[0];
      const bmp = await new ImageCapture(track).grabFrame();
      track.stop();
      return bmp;
    } catch (e) {
      const url = await shotViaRAF();
      const blob = await (await fetch(url)).blob();
      return await createImageBitmap(blob);
    }
  }
  async function shotBlob() {
    const bmp = await grabBitmap();
    const c2 = document.createElement("canvas");
    c2.width = bmp.width;
    c2.height = bmp.height;
    c2.getContext("2d").drawImage(bmp, 0, 0);
    return await new Promise((r) => c2.toBlob(r, "image/png"));
  }
  async function screenshot() {
    const b = await shotBlob();
    return await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.readAsDataURL(b);
    });
  }
  async function showShot() {
    window.open(URL.createObjectURL(await shotBlob()), "_blank");
  }

  // src/ocr.js
  var LS = "tarkanbot.ocr";
  var ocrState = { region: null, templates: {}, GW: 12, GH: 18 };
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(LS));
      if (o) {
        ocrState.region = o.region || null;
        ocrState.templates = o.templates || {};
      }
    } catch (e) {
    }
  }
  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify({ region: ocrState.region, templates: ocrState.templates }));
    } catch (e) {
    }
  }
  load();
  var cv2 = () => document.getElementById("canvas");
  function pickRegion() {
    return new Promise((resolve) => {
      const canvas = cv2();
      const r = canvas.getBoundingClientRect();
      const ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;z-index:2147483646;cursor:crosshair;background:rgba(0,0,0,.12)";
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;border:2px solid #5fe0c0;background:rgba(95,224,192,.15);pointer-events:none";
      ov.appendChild(box);
      document.body.appendChild(ov);
      let sx = 0, sy = 0, drawing = false;
      const cleanup = () => {
        ov.remove();
        window.removeEventListener("keydown", onKey, true);
      };
      const onKey = (e) => {
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        }
      };
      window.addEventListener("keydown", onKey, true);
      ov.onmousedown = (e) => {
        drawing = true;
        sx = e.clientX;
        sy = e.clientY;
        box.style.left = sx + "px";
        box.style.top = sy + "px";
        box.style.width = "0";
        box.style.height = "0";
        e.preventDefault();
      };
      ov.onmousemove = (e) => {
        if (!drawing) return;
        const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
        box.style.left = x + "px";
        box.style.top = y + "px";
        box.style.width = Math.abs(e.clientX - sx) + "px";
        box.style.height = Math.abs(e.clientY - sy) + "px";
      };
      ov.onmouseup = (e) => {
        cleanup();
        if (!drawing) {
          resolve(null);
          return;
        }
        const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
        const w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
        if (w < 4 || h < 4) {
          resolve(null);
          return;
        }
        const scaleX = canvas.width / r.width, scaleY = canvas.height / r.height;
        ocrState.region = {
          x: Math.round((x - r.left) * scaleX),
          y: Math.round((y - r.top) * scaleY),
          w: Math.round(w * scaleX),
          h: Math.round(h * scaleY)
        };
        save();
        resolve(ocrState.region);
      };
    });
  }
  async function regionImageData() {
    const reg = ocrState.region;
    if (!reg) throw new Error("область не задана");
    const bmp = await grabBitmap();
    const c2 = document.createElement("canvas");
    c2.width = reg.w;
    c2.height = reg.h;
    const ctx = c2.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, reg.x, reg.y, reg.w, reg.h, 0, 0, reg.w, reg.h);
    return ctx.getImageData(0, 0, reg.w, reg.h);
  }
  function binarize(img) {
    const { width: w, height: h, data: d } = img;
    const lum = new Float32Array(w * h);
    let mn = 255, mx = 0;
    for (let i = 0; i < w * h; i++) {
      const L = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      lum[i] = L;
      if (L < mn) mn = L;
      if (L > mx) mx = L;
    }
    const th = (mn + mx) / 2;
    let above = 0;
    for (let i = 0; i < w * h; i++) if (lum[i] > th) above++;
    const fgHigh = above <= w * h - above;
    const bin = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) bin[i] = lum[i] > th === fgHigh ? 1 : 0;
    return { w, h, bin };
  }
  function segment({ w, h, bin }) {
    const col = new Int32Array(w);
    for (let x = 0; x < w; x++) {
      let c2 = 0;
      for (let y = 0; y < h; y++) c2 += bin[y * w + x];
      col[x] = c2;
    }
    const spans = [];
    let st = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && col[x] > 0;
      if (on && st < 0) st = x;
      else if (!on && st >= 0) {
        if (x - st >= 2) spans.push([st, x]);
        st = -1;
      }
    }
    return spans.map(([x0, x1]) => {
      let y0 = h, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = x0; x < x1; x++) if (bin[y * w + x]) {
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      return { x0, x1, y0, y1: y1 + 1 };
    }).filter((b) => b.y1 > b.y0);
  }
  function normBox({ w, bin }, b, GW, GH) {
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const out = new Uint8Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const sx = b.x0 + Math.floor(gx * bw / GW), sy = b.y0 + Math.floor(gy * bh / GH);
      out[gy * GW + gx] = bin[sy * w + sx];
    }
    return out;
  }
  function matchGrid(grid, templates, GW, GH) {
    let best = null, bestErr = Infinity;
    for (const dig in templates) {
      const t = templates[dig];
      let err = 0;
      for (let i = 0; i < GW * GH; i++) if (grid[i] !== t[i]) err++;
      if (err < bestErr) {
        bestErr = err;
        best = dig;
      }
    }
    return { digit: best, err: bestErr / (GW * GH) };
  }
  function dropSmall(boxes) {
    if (!boxes.length) return boxes;
    const maxH = Math.max(...boxes.map((b) => b.y1 - b.y0));
    return boxes.filter((b) => b.y1 - b.y0 >= 0.5 * maxH);
  }
  async function analyze({ maxErr = 0.2, max = Infinity } = {}) {
    const { GW, GH, templates } = ocrState;
    if (!ocrState.region) return { ok: false, reason: "нет области" };
    const { w, h, bin } = binarize(await regionImageData());
    const hasTpl = Object.keys(templates).length > 0;
    const boxes = dropSmall(segment({ w, h, bin })).map((b) => {
      const m = hasTpl ? matchGrid(normBox({ w, bin }, b, GW, GH), templates, GW, GH) : { digit: null, err: 1 };
      return { ...b, digit: m.digit, err: m.err, used: false };
    });
    const base = { w, h, bin, boxes };
    if (!hasTpl) return { ...base, ok: false, reason: "нет калибровки" };
    const cand = boxes.filter((b) => b.digit != null && b.err <= maxErr);
    if (!cand.length) return { ...base, ok: false, reason: "цифр не распознано" };
    const avgW = cand.reduce((s, b) => s + (b.x1 - b.x0), 0) / cand.length;
    const clusters = [[cand[0]]];
    for (let i = 1; i < cand.length; i++) {
      const gap = cand[i].x0 - cand[i - 1].x1;
      if (gap > 1.5 * avgW) clusters.push([cand[i]]);
      else clusters[clusters.length - 1].push(cand[i]);
    }
    const group = clusters[clusters.length - 1];
    group.forEach((b) => {
      b.used = true;
    });
    const str = group.map((b) => b.digit).join("");
    const err = Math.max(...group.map((b) => b.err));
    const value = parseInt(str, 10);
    if (!Number.isFinite(value)) return { ...base, ok: false, reason: "не число" };
    if (value > max) return { ...base, ok: false, reason: `${value} > лимита ${max}`, value, str, err, suspect: true };
    return { ...base, ok: true, value, str, err };
  }
  async function readNumber(opts) {
    const a = await analyze(opts);
    return a.ok ? { ok: true, value: a.value, str: a.str, err: a.err } : { ok: false, reason: a.reason, value: a.value ?? null, suspect: !!a.suspect };
  }
  function setRegion(p) {
    const r = ocrState.region || { x: 0, y: 0, w: 40, h: 18 };
    Object.assign(r, p);
    r.x = Math.max(0, Math.round(r.x));
    r.y = Math.max(0, Math.round(r.y));
    r.w = Math.max(2, Math.round(r.w));
    r.h = Math.max(2, Math.round(r.h));
    ocrState.region = r;
    save();
    return r;
  }
  async function teach(known) {
    known = String(known).trim();
    if (!/^\d+$/.test(known)) return { ok: false, reason: "нужны только цифры" };
    const bin = binarize(await regionImageData());
    const boxes = dropSmall(segment(bin));
    if (boxes.length < known.length) return { ok: false, reason: `боксов ${boxes.length} < цифр ${known.length}` };
    const use = boxes.slice(boxes.length - known.length);
    const { GW, GH } = ocrState;
    for (let i = 0; i < use.length; i++) ocrState.templates[known[i]] = Array.from(normBox(bin, use[i], GW, GH));
    save();
    return { ok: true, learned: Object.keys(ocrState.templates).sort().join("") };
  }

  // src/ui/dom.js
  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k === "style") n.style.cssText = v;
      else if (k.startsWith("on")) n[k] = v;
      else n.setAttribute(k, v);
    }
    for (const k of kids) n.append(k);
    return n;
  }
  function makeEditable(inp) {
    inp.addEventListener("keydown", (e) => {
      e.stopPropagation();
      const v = inp.value, s = inp.selectionStart, en = inp.selectionEnd, k = e.key;
      const set = (nv, c2) => {
        inp.value = nv;
        inp.selectionStart = inp.selectionEnd = c2;
      };
      if (k === "Backspace") s !== en ? set(v.slice(0, s) + v.slice(en), s) : s > 0 && set(v.slice(0, s - 1) + v.slice(en), s - 1);
      else if (k === "Delete") s !== en ? set(v.slice(0, s) + v.slice(en), s) : set(v.slice(0, s) + v.slice(s + 1), s);
      else if (k === "ArrowLeft") inp.selectionStart = inp.selectionEnd = Math.max(0, s - 1);
      else if (k === "ArrowRight") inp.selectionStart = inp.selectionEnd = Math.min(v.length, en + 1);
      else if (k === "Home") inp.selectionStart = inp.selectionEnd = 0;
      else if (k === "End") inp.selectionStart = inp.selectionEnd = v.length;
      else if (k.length === 1) set(v.slice(0, s) + k + v.slice(en), s + 1);
    }, false);
  }

  // src/ui/styles.css
  var styles_default = '/* Панель tarkan-bot. Подключается в JS как текст (esbuild loader .css = text). */\n\n#tarkan-bot-ui {\n  position: fixed;\n  left: 8px;\n  bottom: 8px;\n  z-index: 2147483647;\n  width: 250px;\n  overflow: hidden;\n  border: 1px solid #243240;\n  border-radius: 11px;\n  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;\n  color: #dce8f0;\n  background: linear-gradient(180deg, rgba(16, 22, 30, .97), rgba(9, 13, 18, .98));\n  box-shadow: 0 10px 34px rgba(0, 0, 0, .6);\n  backdrop-filter: blur(4px);\n  user-select: none;\n}\n\n#tarkan-bot-ui * {\n  box-sizing: border-box;\n  font: inherit;\n}\n\n/* шапка */\n#tarkan-bot-ui .hd {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 8px 10px;\n  cursor: move;\n  border-bottom: 1px solid #243240;\n  background: linear-gradient(180deg, #172533, #0d1620);\n}\n\n#tarkan-bot-ui .ttl {\n  flex: 1;\n  font-weight: 700;\n  letter-spacing: .4px;\n  color: #5fe0c0;\n}\n\n#tarkan-bot-ui .ic {\n  padding: 0 4px;\n  font-size: 12px;\n  color: #8aa1b0;\n  cursor: pointer;\n}\n\n#tarkan-bot-ui .ic:hover {\n  color: #fff;\n}\n\n/* тело + сворачивание */\n#tarkan-bot-ui .body {\n  padding: 8px 10px 10px;\n}\n\n#tarkan-bot-ui.min .body {\n  display: none;\n}\n\n/* заголовки секций */\n#tarkan-bot-ui .sec {\n  margin: 10px 0 3px;\n  font-size: 9px;\n  letter-spacing: 1.2px;\n  text-transform: uppercase;\n  color: #577086;\n}\n\n#tarkan-bot-ui .sec:first-child {\n  margin-top: 0;\n}\n\n/* строки */\n#tarkan-bot-ui .row {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 5px;\n  margin: 4px 0;\n}\n\n/* поля ввода */\n#tarkan-bot-ui input {\n  flex: 1;\n  min-width: 0;\n  padding: 4px 6px;\n  border: 1px solid #243240;\n  border-radius: 5px;\n  color: #dce8f0;\n  background: #070b10;\n  outline: none;\n}\n\n#tarkan-bot-ui input:focus {\n  border-color: #3f6f8f;\n}\n\n#tarkan-bot-ui input.sm {\n  flex: 0 0 52px;\n  text-align: center;\n}\n\n/* кнопки */\n#tarkan-bot-ui button {\n  padding: 4px 8px;\n  border: 1px solid #2c4254;\n  border-radius: 5px;\n  color: #dce8f0;\n  background: #16222e;\n  white-space: nowrap;\n  cursor: pointer;\n  transition: .1s;\n}\n\n#tarkan-bot-ui button:hover {\n  border-color: #3a5a72;\n  background: #1f3242;\n}\n\n#tarkan-bot-ui button:active {\n  transform: translateY(1px);\n}\n\n/* подписи и теги */\n#tarkan-bot-ui .tag {\n  flex: 0 0 24px;\n  text-align: center;\n  font-weight: 700;\n  color: #7fd9c0;\n}\n\n#tarkan-bot-ui .lbl {\n  flex: 0 0 auto;\n  padding: 0 1px;\n  color: #6f87a0;\n}\n\n#tarkan-bot-ui .ocrval {\n  flex: 1;\n  text-align: right;\n  font-weight: 700;\n  color: #9bd9c4;\n}\n\n/* кнопка "го" у статов */\n#tarkan-bot-ui .go {\n  flex: 0 0 40px;\n  text-align: center;\n  font-weight: 700;\n  border-color: #1c6b48;\n  color: #7df0b8;\n  background: #123e2c;\n}\n\n#tarkan-bot-ui .go:hover {\n  background: #1a5c40;\n}\n\n/* большая красная кнопка RESET MZFK */\n#tarkan-bot-ui .big {\n  width: 100%;\n  margin-top: 9px;\n  padding: 9px;\n  font-weight: 700;\n  letter-spacing: .6px;\n  border-color: #c44;\n  color: #ffe6e0;\n  background: linear-gradient(180deg, #8a2222, #681616);\n}\n\n#tarkan-bot-ui .big:hover {\n  background: linear-gradient(180deg, #a82a2a, #7e1e1e);\n}\n\n/* зелёная кнопка авто-запуска (.on = активна, красная) */\n#tarkan-bot-ui .run {\n  width: 100%;\n  margin-top: 6px;\n  padding: 8px;\n  font-weight: 700;\n  letter-spacing: .4px;\n  border-color: #1c8b5a;\n  color: #cffce4;\n  background: linear-gradient(180deg, #15633f, #0d4a2e);\n}\n\n#tarkan-bot-ui .run:hover {\n  background: linear-gradient(180deg, #1a7a4d, #115a39);\n}\n\n#tarkan-bot-ui .run.on {\n  border-color: #d55;\n  color: #ffe6e0;\n  background: linear-gradient(180deg, #8a2222, #681616);\n}\n\n/* обратный отсчёт до след. ресета */\n#tarkan-bot-ui .count {\n  margin-top: 7px;\n  min-height: 14px;\n  text-align: center;\n  font-weight: 700;\n  letter-spacing: .5px;\n  color: #9bd9c4;\n}\n\n/* статистика + крестик сброса */\n#tarkan-bot-ui .stats {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  gap: 6px;\n  margin-top: 7px;\n  font-size: 10px;\n  color: #7088a0;\n}\n\n#tarkan-bot-ui .rst {\n  padding: 0 4px;\n  line-height: 14px;\n  font-size: 9px;\n  border: 1px solid #2a3a4a;\n  border-radius: 3px;\n  color: #5a6f82;\n  cursor: pointer;\n}\n\n#tarkan-bot-ui .rst:hover {\n  border-color: #a44;\n  color: #ff9a9a;\n}\n\n/* лог */\n#tarkan-bot-ui .log {\n  margin-top: 9px;\n  padding: 6px 8px;\n  min-height: 15px;\n  font-size: 10px;\n  word-break: break-all;\n  border: 1px solid #1a2530;\n  border-radius: 5px;\n  color: #7fb89f;\n  background: #070b10;\n}\n\n/* рамка читаемой OCR-области (отдельный элемент поверх canvas) */\n#tarkan-ocr-box {\n  position: fixed;\n  z-index: 2147483646;\n  display: none;\n  pointer-events: none;\n  border: 1px solid #5fe0c0;\n  box-shadow: 0 0 0 1px rgba(0, 0, 0, .5), 0 0 6px rgba(95, 224, 192, .5);\n}\n\n/* табы */\n#tarkan-bot-ui .tabbar {\n  display: flex;\n  gap: 4px;\n  margin-bottom: 7px;\n}\n\n#tarkan-bot-ui .tab {\n  flex: 1;\n  padding: 5px 2px;\n  text-align: center;\n  font-size: 10px;\n  border: 1px solid #243240;\n  border-radius: 6px;\n  color: #8aa1b0;\n  background: #0e1722;\n  cursor: pointer;\n}\n\n#tarkan-bot-ui .tab:hover {\n  color: #cfe;\n}\n\n#tarkan-bot-ui .tab.active {\n  color: #5fe0c0;\n  border-color: #2c6b58;\n  background: #16222e;\n}\n\n#tarkan-bot-ui .pane {\n  display: none;\n}\n\n#tarkan-bot-ui .pane.active {\n  display: block;\n}\n\n/* выезжающая дебаг-панель слева */\n#tarkan-debug {\n  position: fixed;\n  left: 8px;\n  top: 50%;\n  z-index: 2147483647;\n  width: 300px;\n  padding: 10px;\n  transform: translate(-115%, -50%);\n  transition: transform .2s ease;\n  border: 1px solid #243240;\n  border-radius: 11px;\n  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;\n  color: #dce8f0;\n  background: linear-gradient(180deg, rgba(16, 22, 30, .98), rgba(9, 13, 18, .99));\n  box-shadow: 0 10px 34px rgba(0, 0, 0, .6);\n  user-select: none;\n}\n\n#tarkan-debug.open {\n  transform: translate(0, -50%);\n}\n\n#tarkan-debug * {\n  box-sizing: border-box;\n  font: inherit;\n}\n\n#tarkan-debug .hd {\n  display: flex;\n  align-items: center;\n  margin-bottom: 8px;\n}\n\n#tarkan-debug .hd b {\n  flex: 1;\n  color: #5fe0c0;\n}\n\n#tarkan-debug .ic {\n  color: #8aa1b0;\n  cursor: pointer;\n  padding: 0 4px;\n}\n\n#tarkan-debug .ic:hover {\n  color: #fff;\n}\n\n#tarkan-debug canvas {\n  display: block;\n  width: 100%;\n  image-rendering: pixelated;\n  border: 1px solid #243240;\n  border-radius: 4px;\n  background: #0a0e13;\n}\n\n#tarkan-debug .dbgtxt {\n  margin: 7px 0;\n  text-align: center;\n  font-weight: 700;\n  color: #9bd9c4;\n}\n\n#tarkan-debug .row {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  margin: 4px 0;\n}\n\n#tarkan-debug .nlbl {\n  flex: 0 0 14px;\n  color: #7fd9c0;\n  font-weight: 700;\n}\n\n#tarkan-debug .nval {\n  flex: 1;\n  text-align: center;\n  color: #dce8f0;\n}\n\n#tarkan-debug button {\n  padding: 3px 7px;\n  border: 1px solid #2c4254;\n  border-radius: 5px;\n  color: #dce8f0;\n  background: #16222e;\n  cursor: pointer;\n}\n\n#tarkan-debug button:hover {\n  background: #1f3242;\n}\n\n#tarkan-debug .leg {\n  margin-top: 8px;\n  font-size: 9px;\n  color: #6f87a0;\n  line-height: 1.5;\n}\n';

  // src/ui/panel.js
  function buildUI() {
    if (window.__tarkanStop) {
      try {
        window.__tarkanStop();
      } catch (e) {
      }
    }
    document.getElementById("tarkan-bot-ui")?.remove();
    document.getElementById("tarkan-ocr-box")?.remove();
    document.getElementById("tarkan-debug")?.remove();
    document.head.appendChild(el("style", {}, styles_default));
    const logEl = el("div", { class: "log" }, "готов · жми кнопку");
    const log = (m) => {
      logEl.textContent = m;
    };
    const sec = (t) => el("div", { class: "sec" }, t);
    const lbl = (t) => el("span", { class: "lbl" }, t);
    const ttlEl = el("span", { class: "ttl" }, "⚡ tarkan-bot");
    const setLevel = (v) => {
      ttlEl.textContent = v == null ? "⚡ tarkan-bot" : `⚡ tarkan-bot · ур ${v}`;
    };
    const hlBox = el("div", { id: "tarkan-ocr-box", class: "ocrbox" });
    document.body.appendChild(hlBox);
    let hlOn = true;
    const placeHighlight = () => {
      const reg = ocrState.region, canvas = document.getElementById("canvas");
      if (!reg || !canvas || !hlOn) {
        hlBox.style.display = "none";
        return;
      }
      const r = canvas.getBoundingClientRect();
      const sx = r.width / canvas.width, sy = r.height / canvas.height;
      hlBox.style.display = "block";
      hlBox.style.left = r.left + reg.x * sx + "px";
      hlBox.style.top = r.top + reg.y * sy + "px";
      hlBox.style.width = reg.w * sx + "px";
      hlBox.style.height = reg.h * sy + "px";
    };
    addEventListener("resize", placeHighlight);
    addEventListener("scroll", placeHighlight, true);
    const iCmd = el("input", { value: "/reset" });
    const iAfter = el("input", { class: "sm", value: String(TIMING.afterReset) });
    timingInputs.afterReset = iAfter;
    const iGap = el("input", { class: "sm", value: String(TIMING.gap) });
    timingInputs.gap = iGap;
    const iBase = el("input", { class: "sm", value: String(AUTO_BASE) });
    const iStep = el("input", { class: "sm", value: String(AUTO_STEP) });
    const iLvl = el("input", { class: "sm", value: "380" });
    const iMax = el("input", { class: "sm", value: "400" });
    const iPoll = el("input", { class: "sm", value: "3" });
    const iErr = el("input", { class: "sm", value: "18" });
    [iCmd, iAfter, iGap, iBase, iStep, iLvl, iMax, iPoll, iErr].forEach(makeEditable);
    const readMax = () => +iMax.value || 400;
    const readErr = () => (+iErr.value || 18) / 100;
    const statRow = (k) => {
      const inp = el("input", { value: String(STAT_DEFAULTS[k]) });
      const inc = el("input", { class: "sm", value: String(INC_DEFAULTS[k]) });
      statInputs[k] = inp;
      incInputs[k] = inc;
      makeEditable(inp);
      makeEditable(inc);
      const go = el("button", { class: "go", onclick: () => {
        const v = +inp.value || 0;
        if (v <= 0) {
          log(`/${k}: 0 — пропуск`);
          return;
        }
        focusGame();
        chatCommand(`/${k} ${v}`);
        log(`/${k} ${v}`);
      } }, "го");
      return el(
        "div",
        { class: "row" },
        el("span", { class: "tag" }, "/" + k),
        inp,
        lbl("+"),
        inc,
        go
      );
    };
    const bOpen = el("button", { onclick: () => {
      focusGame();
      ENTER();
      log("open");
    } }, "↵open");
    const bSend2 = el("button", { onclick: () => {
      focusGame();
      ENTER();
      log("send");
    } }, "⏎send");
    const bEsc = el("button", { onclick: () => {
      ESCAPE();
      log("Esc");
    } }, "Esc");
    const bShot = el("button", { onclick: () => {
      log("📷...");
      showShot();
    } }, "📷");
    const bSend = el("button", { onclick: () => {
      focusGame();
      chatCommand(iCmd.value);
    } }, "send");
    const bMacro = el("button", { class: "big", onclick: () => {
      log("RESET MZFK...");
      doReset().then(() => log("RESET MZFK ✓"));
    } }, "⚡ RESET MZFK");
    let resets = 0, runMs = 0, runFrom = 0;
    const statsTxt = el("span", {}, "");
    const icReset = el("span", { class: "rst", title: "сброс статистики" }, "✕");
    const statsEl = el("div", { class: "stats" }, statsTxt, icReset);
    const fmtHMS = (s) => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    const renderStats = () => {
      const ms = runMs + (runFrom ? Date.now() - runFrom : 0);
      statsTxt.textContent = `ресетов: ${resets} · аптайм: ${fmtHMS(Math.floor(ms / 1e3))}`;
    };
    icReset.onclick = () => {
      resets = 0;
      runMs = 0;
      runFrom = runFrom ? Date.now() : 0;
      renderStats();
      log("статистика сброшена");
    };
    renderStats();
    const doReset = async () => {
      await resetMzfk();
      resets++;
      STAT_KEYS.forEach((k) => {
        if (statInputs[k]) statInputs[k].value = statVal(k) + incVal(k);
      });
      renderStats();
    };
    let auto = null, countIv = null, nextAt = 0, curInt = 0;
    const countEl = el("div", { class: "count" }, "");
    const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    const tick = () => {
      renderStats();
      if (!nextAt) {
        countEl.textContent = "";
        return;
      }
      const left = Math.max(0, Math.ceil((nextAt - Date.now()) / 1e3));
      countEl.textContent = `след. reset через ${fmt(left)}`;
    };
    const scheduleNext = () => {
      const s = Math.max(1, Math.round(curInt));
      nextAt = Date.now() + s * 1e3;
      tick();
      auto = setTimeout(async () => {
        nextAt = 0;
        tick();
        log("авто RESET MZFK...");
        await doReset();
        curInt += +iStep.value || 0;
        if (auto !== null) scheduleNext();
      }, s * 1e3);
    };
    const bAuto = el("button", { class: "run" }, "▶ АВТО");
    bAuto.onclick = async () => {
      if (auto !== null) {
        clearTimeout(auto);
        clearInterval(countIv);
        auto = null;
        nextAt = 0;
        runMs += runFrom ? Date.now() - runFrom : 0;
        runFrom = 0;
        tick();
        bAuto.classList.remove("on");
        bAuto.textContent = "▶ АВТО";
        log("авто стоп");
        return;
      }
      auto = -1;
      curInt = Math.max(1, +iBase.value || AUTO_BASE);
      runFrom = Date.now();
      countIv = setInterval(tick, 500);
      bAuto.classList.add("on");
      bAuto.textContent = "⏹ СТОП";
      log("авто старт: RESET MZFK сейчас");
      await doReset();
      if (auto !== null) scheduleNext();
    };
    const ocrVal = el("span", { class: "ocrval" }, ocrState.region ? "—" : "нет обл.");
    const bRegion = el("button", { onclick: async () => {
      log("тяни рамку по числу (Esc — отмена)");
      const r = await pickRegion();
      log(r ? `область ${r.w}×${r.h}` : "отмена");
      ocrVal.textContent = r ? "—" : "нет обл.";
      syncReg();
    } }, "обл.");
    const bTeach = el("button", { onclick: async () => {
      const known = prompt("Какое число сейчас в рамке? (обучение цифр)");
      if (!known) return;
      const res = await teach(known);
      log(res.ok ? `выучены цифры: ${res.learned}` : `учить: ${res.reason}`);
      if (dbgIv) refreshDbg();
    } }, "учить");
    const bTest = el("button", { onclick: async () => {
      const r = await readNumber({ maxErr: readErr(), max: readMax() });
      placeHighlight();
      if (r.ok) {
        ocrVal.textContent = String(r.value);
        setLevel(r.value);
        log(`прочитано: ${r.value} (err ${Math.round(r.err * 100)}%)`);
      } else {
        ocrVal.textContent = r.suspect ? `?${r.value}` : "—";
        log(`OCR: ${r.reason}`);
      }
    } }, "тест");
    const bEye = el("button", { onclick: () => {
      hlOn = !hlOn;
      bEye.textContent = hlOn ? "👁" : "🚫";
      placeHighlight();
    } }, "👁");
    let ocrIv = null, ocrBusy = false;
    const bLvlAuto = el("button", { class: "run" }, "▶ ресет по ур.");
    bLvlAuto.onclick = () => {
      if (ocrIv) {
        clearInterval(ocrIv);
        ocrIv = null;
        bLvlAuto.classList.remove("on");
        bLvlAuto.textContent = "▶ ресет по ур.";
        log("ур-авто стоп");
        return;
      }
      if (!ocrState.region) {
        log("сначала задай область (вкладка OCR)");
        return;
      }
      if (!Object.keys(ocrState.templates).length) {
        log("сначала откалибруй (вкладка OCR → учить)");
        return;
      }
      const s = Math.max(1, +iPoll.value || 3);
      bLvlAuto.classList.add("on");
      bLvlAuto.textContent = "⏹ стоп ур.";
      log("ур-авто старт");
      ocrIv = setInterval(async () => {
        if (ocrBusy) return;
        ocrBusy = true;
        try {
          const r = await readNumber({ maxErr: readErr(), max: readMax() });
          placeHighlight();
          if (!r.ok) {
            ocrVal.textContent = r.suspect ? `?${r.value}` : "закрыто?";
            log(`ур не читается: ${r.reason}`);
            return;
          }
          ocrVal.textContent = String(r.value);
          setLevel(r.value);
          const th = +iLvl.value || 380;
          if (r.value >= th) {
            log(`ур ${r.value} ≥ ${th} → RESET MZFK`);
            await doReset();
          }
        } catch (e) {
          log("OCR ошибка");
        } finally {
          ocrBusy = false;
        }
      }, s * 1e3);
    };
    let dbgIv = null;
    const dbgCanvas = el("canvas", {});
    const dbgTxt = el("div", { class: "dbgtxt" }, "—");
    const drawDebug = (a) => {
      const S = 5, w = a.w, h = a.h;
      dbgCanvas.width = w * S;
      dbgCanvas.height = h * S + 12;
      const x = dbgCanvas.getContext("2d");
      x.fillStyle = "#0a0e13";
      x.fillRect(0, 0, dbgCanvas.width, dbgCanvas.height);
      x.fillStyle = "#cfe";
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (a.bin[yy * w + xx]) x.fillRect(xx * S, yy * S + 12, S, S);
      x.lineWidth = 1;
      x.font = "bold 10px monospace";
      x.textBaseline = "bottom";
      for (const b of a.boxes) {
        const col = b.used ? "#5fe0c0" : b.digit != null && b.err <= readErr() ? "#ffd25f" : "#e0556a";
        x.strokeStyle = col;
        x.strokeRect(b.x0 * S + 0.5, b.y0 * S + 12.5, (b.x1 - b.x0) * S - 1, (b.y1 - b.y0) * S - 1);
        x.fillStyle = col;
        x.fillText(b.digit != null ? `${b.digit}·${Math.round(b.err * 100)}` : "?", b.x0 * S, b.y0 * S + 11);
      }
    };
    const refreshDbg = async () => {
      if (!ocrState.region) {
        dbgTxt.textContent = "нет области";
        return;
      }
      try {
        const a = await analyze({ maxErr: readErr(), max: readMax() });
        if (a.bin) drawDebug(a);
        dbgTxt.textContent = a.ok ? `= ${a.value} (err ${Math.round(a.err * 100)}%)` : `— ${a.reason}`;
        if (a.ok) setLevel(a.value);
        syncReg();
      } catch (e) {
        dbgTxt.textContent = "ошибка чтения";
      }
    };
    const regSpan = {};
    const syncReg = () => {
      const r = ocrState.region;
      ["x", "y", "w", "h"].forEach((a) => {
        if (regSpan[a]) regSpan[a].textContent = r ? r[a] : "—";
      });
      placeHighlight();
    };
    const nudRow = (axis) => {
      const val = el("span", { class: "nval" }, "—");
      regSpan[axis] = val;
      const mk = (d) => el("button", { onclick: () => {
        const r = ocrState.region || { x: 0, y: 0, w: 40, h: 18 };
        setRegion({ [axis]: (r[axis] || 0) + d });
        syncReg();
        refreshDbg();
      } }, (d > 0 ? "+" : "") + d);
      return el("div", { class: "row" }, el("span", { class: "nlbl" }, axis), mk(-10), mk(-1), val, mk(1), mk(10));
    };
    const dbgClose = el("span", { class: "ic" }, "✕");
    const dbgPanel = el(
      "div",
      { id: "tarkan-debug" },
      el("div", { class: "hd" }, el("b", {}, "OCR debug"), dbgClose),
      dbgCanvas,
      dbgTxt,
      nudRow("x"),
      nudRow("y"),
      nudRow("w"),
      nudRow("h"),
      el("div", { class: "leg" }, "рамки: cyan = взято в число · yellow = кандидат · red = мусор. подпись = цифра·ошибка%")
    );
    document.body.appendChild(dbgPanel);
    const closeDbg = () => {
      dbgPanel.classList.remove("open");
      if (dbgIv) {
        clearInterval(dbgIv);
        dbgIv = null;
      }
    };
    dbgClose.onclick = closeDbg;
    const bDbg = el("button", { onclick: () => {
      if (dbgPanel.classList.contains("open")) {
        closeDbg();
        return;
      }
      dbgPanel.classList.add("open");
      syncReg();
      refreshDbg();
      dbgIv = setInterval(refreshDbg, 800);
    } }, "🔧 дебаг");
    const paneInput = el(
      "div",
      { class: "pane active" },
      el("div", { class: "row" }, bOpen, bSend2, bEsc, bShot),
      el("div", { class: "row" }, iCmd, bSend),
      sec("статы · 0 = пропуск"),
      statRow("a"),
      statRow("e"),
      statRow("f"),
      statRow("v"),
      bMacro
    );
    const paneTimer = el(
      "div",
      { class: "pane" },
      sec("паузы, мс"),
      el("div", { class: "row" }, lbl("после reset"), iAfter, lbl("между"), iGap),
      sec("авто, сек"),
      el("div", { class: "row" }, lbl("база"), iBase, lbl("+ за ресет"), iStep),
      countEl,
      bAuto
    );
    const paneLevel = el(
      "div",
      { class: "pane" },
      sec("ресет по уровню (OCR)"),
      el("div", { class: "row" }, lbl("ур ≥"), iLvl, lbl("≤"), iMax),
      el("div", { class: "row" }, lbl("опрос"), iPoll, lbl("с"), lbl("ошибка ≤"), iErr, lbl("%")),
      bLvlAuto
    );
    const paneOcr = el(
      "div",
      { class: "pane" },
      sec("область / калибровка"),
      el("div", { class: "row" }, bRegion, bEye, bDbg),
      el("div", { class: "row" }, bTeach, bTest, lbl("="), ocrVal)
    );
    const panes = [];
    const mkTab = (name, pane) => {
      const t = el("div", { class: "tab" }, name);
      t.onclick = () => {
        panes.forEach(([tb, pn]) => {
          tb.classList.remove("active");
          pn.classList.remove("active");
        });
        t.classList.add("active");
        pane.classList.add("active");
      };
      panes.push([t, pane]);
      return t;
    };
    const tabbar = el(
      "div",
      { class: "tabbar" },
      mkTab("ввод", paneInput),
      mkTab("таймер", paneTimer),
      mkTab("уровень", paneLevel),
      mkTab("OCR", paneOcr)
    );
    panes[0][0].classList.add("active");
    const icMin = el("span", { class: "ic", title: "свернуть" }, "▾");
    const hd = el("div", { class: "hd" }, ttlEl, icMin);
    const body = el("div", { class: "body" }, tabbar, paneInput, paneTimer, paneLevel, paneOcr, statsEl, logEl);
    const ui = el("div", { id: "tarkan-bot-ui" }, hd, body);
    document.body.appendChild(ui);
    icMin.onclick = () => {
      ui.classList.toggle("min");
      icMin.textContent = ui.classList.contains("min") ? "▸" : "▾";
    };
    [ui, dbgPanel].forEach((root) => root.querySelectorAll("button, .ic, .rst, .tab").forEach((b) => b.addEventListener("mousedown", (e) => e.preventDefault())));
    const probe = (e) => log(`${e.type} which=${e.which} key="${e.key}"`);
    addEventListener("keydown", probe, true);
    addEventListener("keypress", probe, true);
    let drag = null;
    hd.onmousedown = (e) => {
      if (e.target === icMin) return;
      drag = { x: e.clientX, y: e.clientY, l: ui.offsetLeft, t: ui.offsetTop };
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!drag) return;
      ui.style.left = drag.l + e.clientX - drag.x + "px";
      ui.style.top = drag.t + e.clientY - drag.y + "px";
      ui.style.bottom = "auto";
      placeHighlight();
    };
    const onUp = () => drag = null;
    addEventListener("mousemove", onMove);
    addEventListener("mouseup", onUp);
    syncReg();
    window.__tarkanStop = () => {
      if (auto !== null) clearTimeout(auto);
      clearInterval(countIv);
      if (ocrIv) clearInterval(ocrIv);
      if (dbgIv) clearInterval(dbgIv);
      removeEventListener("keydown", probe, true);
      removeEventListener("keypress", probe, true);
      removeEventListener("resize", placeHighlight);
      removeEventListener("scroll", placeHighlight, true);
      removeEventListener("mousemove", onMove);
      removeEventListener("mouseup", onUp);
      document.getElementById("tarkan-ocr-box")?.remove();
      document.getElementById("tarkan-debug")?.remove();
    };
  }

  // src/main.js
  function start(canvas) {
    setTarget(canvas);
    buildUI();
    Object.assign(window, {
      tap,
      typeText,
      chatCommand,
      resetMzfk,
      ENTER,
      BACKSPACE,
      ESCAPE,
      screenshot,
      showShot,
      buildUI,
      focusGame,
      pickRegion,
      readNumber,
      teach,
      analyze,
      setRegion,
      ocrState
    });
    console.log(
      "%ctarkan-bot готов",
      "color:#0f0",
      '\n  панель снизу слева. либо: chatCommand("/reset") · showShot()'
    );
  }
  var c = document.getElementById("canvas");
  if (c) {
    start(c);
  } else {
    const iv = setInterval(() => {
      const c2 = document.getElementById("canvas");
      if (c2) {
        clearInterval(iv);
        start(c2);
      }
    }, 300);
  }
})();
