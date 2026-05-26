// tarkan-bot v1.1.1 — собрано из src/. Вставить целиком в консоль DevTools (F12).
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
  async function readNumber({ maxErr = 0.28, max = Infinity } = {}) {
    const { GW, GH, templates } = ocrState;
    if (!ocrState.region) return { ok: false, reason: "нет области" };
    if (!Object.keys(templates).length) return { ok: false, reason: "нет калибровки" };
    const bin = binarize(await regionImageData());
    const boxes = segment(bin);
    if (!boxes.length) return { ok: false, reason: "цифр не видно (окно закрыто?)" };
    let str = "", err = 0;
    for (const b of boxes) {
      const m = matchGrid(normBox(bin, b, GW, GH), templates, GW, GH);
      if (m.digit == null || m.err > maxErr) return { ok: false, reason: "неуверенно", err: m.err };
      str += m.digit;
      err = Math.max(err, m.err);
    }
    const value = parseInt(str, 10);
    if (!Number.isFinite(value)) return { ok: false, reason: "не число" };
    if (value > max) return { ok: false, reason: `${value} > лимита ${max}`, value, suspect: true };
    return { ok: true, value, str, err };
  }
  async function teach(known) {
    known = String(known).trim();
    if (!/^\d+$/.test(known)) return { ok: false, reason: "нужны только цифры" };
    const bin = binarize(await regionImageData());
    const boxes = segment(bin);
    if (boxes.length !== known.length) return { ok: false, reason: `сегментов ${boxes.length}, цифр ${known.length}` };
    const { GW, GH } = ocrState;
    for (let i = 0; i < boxes.length; i++) ocrState.templates[known[i]] = Array.from(normBox(bin, boxes[i], GW, GH));
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
  var styles_default = '/* Панель tarkan-bot. Подключается в JS как текст (esbuild loader .css = text). */\n\n#tarkan-bot-ui {\n  position: fixed;\n  left: 8px;\n  bottom: 8px;\n  z-index: 2147483647;\n  width: 250px;\n  overflow: hidden;\n  border: 1px solid #243240;\n  border-radius: 11px;\n  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;\n  color: #dce8f0;\n  background: linear-gradient(180deg, rgba(16, 22, 30, .97), rgba(9, 13, 18, .98));\n  box-shadow: 0 10px 34px rgba(0, 0, 0, .6);\n  backdrop-filter: blur(4px);\n  user-select: none;\n}\n\n#tarkan-bot-ui * {\n  box-sizing: border-box;\n  font: inherit;\n}\n\n/* шапка */\n#tarkan-bot-ui .hd {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 8px 10px;\n  cursor: move;\n  border-bottom: 1px solid #243240;\n  background: linear-gradient(180deg, #172533, #0d1620);\n}\n\n#tarkan-bot-ui .ttl {\n  flex: 1;\n  font-weight: 700;\n  letter-spacing: .4px;\n  color: #5fe0c0;\n}\n\n#tarkan-bot-ui .ic {\n  padding: 0 4px;\n  font-size: 12px;\n  color: #8aa1b0;\n  cursor: pointer;\n}\n\n#tarkan-bot-ui .ic:hover {\n  color: #fff;\n}\n\n/* тело + сворачивание */\n#tarkan-bot-ui .body {\n  padding: 8px 10px 10px;\n}\n\n#tarkan-bot-ui.min .body {\n  display: none;\n}\n\n/* заголовки секций */\n#tarkan-bot-ui .sec {\n  margin: 10px 0 3px;\n  font-size: 9px;\n  letter-spacing: 1.2px;\n  text-transform: uppercase;\n  color: #577086;\n}\n\n#tarkan-bot-ui .sec:first-child {\n  margin-top: 0;\n}\n\n/* строки */\n#tarkan-bot-ui .row {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 5px;\n  margin: 4px 0;\n}\n\n/* поля ввода */\n#tarkan-bot-ui input {\n  flex: 1;\n  min-width: 0;\n  padding: 4px 6px;\n  border: 1px solid #243240;\n  border-radius: 5px;\n  color: #dce8f0;\n  background: #070b10;\n  outline: none;\n}\n\n#tarkan-bot-ui input:focus {\n  border-color: #3f6f8f;\n}\n\n#tarkan-bot-ui input.sm {\n  flex: 0 0 52px;\n  text-align: center;\n}\n\n/* кнопки */\n#tarkan-bot-ui button {\n  padding: 4px 8px;\n  border: 1px solid #2c4254;\n  border-radius: 5px;\n  color: #dce8f0;\n  background: #16222e;\n  white-space: nowrap;\n  cursor: pointer;\n  transition: .1s;\n}\n\n#tarkan-bot-ui button:hover {\n  border-color: #3a5a72;\n  background: #1f3242;\n}\n\n#tarkan-bot-ui button:active {\n  transform: translateY(1px);\n}\n\n/* подписи и теги */\n#tarkan-bot-ui .tag {\n  flex: 0 0 24px;\n  text-align: center;\n  font-weight: 700;\n  color: #7fd9c0;\n}\n\n#tarkan-bot-ui .lbl {\n  flex: 0 0 auto;\n  padding: 0 1px;\n  color: #6f87a0;\n}\n\n#tarkan-bot-ui .ocrval {\n  flex: 1;\n  text-align: right;\n  font-weight: 700;\n  color: #9bd9c4;\n}\n\n/* кнопка "го" у статов */\n#tarkan-bot-ui .go {\n  flex: 0 0 40px;\n  text-align: center;\n  font-weight: 700;\n  border-color: #1c6b48;\n  color: #7df0b8;\n  background: #123e2c;\n}\n\n#tarkan-bot-ui .go:hover {\n  background: #1a5c40;\n}\n\n/* большая красная кнопка RESET MZFK */\n#tarkan-bot-ui .big {\n  width: 100%;\n  margin-top: 9px;\n  padding: 9px;\n  font-weight: 700;\n  letter-spacing: .6px;\n  border-color: #c44;\n  color: #ffe6e0;\n  background: linear-gradient(180deg, #8a2222, #681616);\n}\n\n#tarkan-bot-ui .big:hover {\n  background: linear-gradient(180deg, #a82a2a, #7e1e1e);\n}\n\n/* зелёная кнопка авто-запуска (.on = активна, красная) */\n#tarkan-bot-ui .run {\n  width: 100%;\n  margin-top: 6px;\n  padding: 8px;\n  font-weight: 700;\n  letter-spacing: .4px;\n  border-color: #1c8b5a;\n  color: #cffce4;\n  background: linear-gradient(180deg, #15633f, #0d4a2e);\n}\n\n#tarkan-bot-ui .run:hover {\n  background: linear-gradient(180deg, #1a7a4d, #115a39);\n}\n\n#tarkan-bot-ui .run.on {\n  border-color: #d55;\n  color: #ffe6e0;\n  background: linear-gradient(180deg, #8a2222, #681616);\n}\n\n/* обратный отсчёт до след. ресета */\n#tarkan-bot-ui .count {\n  margin-top: 7px;\n  min-height: 14px;\n  text-align: center;\n  font-weight: 700;\n  letter-spacing: .5px;\n  color: #9bd9c4;\n}\n\n/* статистика + крестик сброса */\n#tarkan-bot-ui .stats {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  gap: 6px;\n  margin-top: 7px;\n  font-size: 10px;\n  color: #7088a0;\n}\n\n#tarkan-bot-ui .rst {\n  padding: 0 4px;\n  line-height: 14px;\n  font-size: 9px;\n  border: 1px solid #2a3a4a;\n  border-radius: 3px;\n  color: #5a6f82;\n  cursor: pointer;\n}\n\n#tarkan-bot-ui .rst:hover {\n  border-color: #a44;\n  color: #ff9a9a;\n}\n\n/* лог */\n#tarkan-bot-ui .log {\n  margin-top: 9px;\n  padding: 6px 8px;\n  min-height: 15px;\n  font-size: 10px;\n  word-break: break-all;\n  border: 1px solid #1a2530;\n  border-radius: 5px;\n  color: #7fb89f;\n  background: #070b10;\n}\n\n/* рамка читаемой OCR-области (отдельный элемент поверх canvas) */\n#tarkan-ocr-box {\n  position: fixed;\n  z-index: 2147483646;\n  display: none;\n  pointer-events: none;\n  border: 1px solid #5fe0c0;\n  box-shadow: 0 0 0 1px rgba(0, 0, 0, .5), 0 0 6px rgba(95, 224, 192, .5);\n}\n';

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
    document.head.appendChild(el("style", {}, styles_default));
    const logEl = el("div", { class: "log" }, "готов · жми кнопку");
    const log = (m) => {
      logEl.textContent = m;
    };
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
    [iCmd, iAfter, iGap, iBase, iStep].forEach(makeEditable);
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
        el("span", { class: "lbl" }, "+"),
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
    let auto = null;
    let countIv = null;
    let nextAt = 0;
    let curInt = 0;
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
    const iLvl = el("input", { class: "sm", value: "380" });
    const iMax = el("input", { class: "sm", value: "400" });
    const iPoll = el("input", { class: "sm", value: "3" });
    [iLvl, iMax, iPoll].forEach(makeEditable);
    const ocrVal = el("span", { class: "ocrval" }, ocrState.region ? "—" : "нет обл.");
    const readMax = () => +iMax.value || 400;
    const bRegion = el("button", { onclick: async () => {
      log("тяни рамку по числу (Esc — отмена)");
      const r = await pickRegion();
      log(r ? `область ${r.w}×${r.h}` : "отмена");
      ocrVal.textContent = r ? "—" : "нет обл.";
      placeHighlight();
    } }, "обл.");
    const bTeach = el("button", { onclick: async () => {
      const known = prompt("Какое число сейчас в рамке? (обучение цифр)");
      if (!known) return;
      const res = await teach(known);
      log(res.ok ? `выучены цифры: ${res.learned}` : `учить: ${res.reason}`);
    } }, "учить");
    const bTest = el("button", { onclick: async () => {
      const r = await readNumber({ max: readMax() });
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
        log("сначала задай область (обл.)");
        return;
      }
      if (!Object.keys(ocrState.templates).length) {
        log("сначала откалибруй (учить)");
        return;
      }
      const sec2 = Math.max(1, +iPoll.value || 3);
      bLvlAuto.classList.add("on");
      bLvlAuto.textContent = "⏹ стоп ур.";
      log("ур-авто старт");
      ocrIv = setInterval(async () => {
        if (ocrBusy) return;
        ocrBusy = true;
        try {
          const r = await readNumber({ max: readMax() });
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
      }, sec2 * 1e3);
    };
    const icMin = el("span", { class: "ic", title: "свернуть" }, "▾");
    const hd = el("div", { class: "hd" }, ttlEl, icMin);
    const sec = (t) => el("div", { class: "sec" }, t);
    const lbl = (t) => el("span", { class: "lbl" }, t);
    const body = el(
      "div",
      { class: "body" },
      el("div", { class: "row" }, bOpen, bSend2, bEsc, bShot),
      el("div", { class: "row" }, iCmd, bSend),
      sec("статы · 0 = пропуск"),
      statRow("a"),
      statRow("e"),
      statRow("f"),
      statRow("v"),
      bMacro,
      sec("паузы, мс"),
      el("div", { class: "row" }, lbl("после reset"), iAfter, lbl("между"), iGap),
      sec("авто, сек"),
      el("div", { class: "row" }, lbl("база"), iBase, lbl("+ за ресет"), iStep),
      countEl,
      bAuto,
      sec("чтение экрана (OCR)"),
      el("div", { class: "row" }, bRegion, bTeach, bTest, bEye, lbl("="), ocrVal),
      el("div", { class: "row" }, lbl("ур ≥"), iLvl, lbl("≤"), iMax, lbl("опрос"), iPoll, lbl("с")),
      bLvlAuto,
      statsEl,
      logEl
    );
    const ui = el("div", { id: "tarkan-bot-ui" }, hd, body);
    document.body.appendChild(ui);
    icMin.onclick = () => {
      ui.classList.toggle("min");
      icMin.textContent = ui.classList.contains("min") ? "▸" : "▾";
    };
    ui.querySelectorAll("button, .ic, .rst").forEach((b) => b.addEventListener("mousedown", (e) => e.preventDefault()));
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
    placeHighlight();
    window.__tarkanStop = () => {
      if (auto !== null) clearTimeout(auto);
      clearInterval(countIv);
      if (ocrIv) clearInterval(ocrIv);
      removeEventListener("keydown", probe, true);
      removeEventListener("keypress", probe, true);
      removeEventListener("resize", placeHighlight);
      removeEventListener("scroll", placeHighlight, true);
      removeEventListener("mousemove", onMove);
      removeEventListener("mouseup", onUp);
      document.getElementById("tarkan-ocr-box")?.remove();
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
