// ==UserScript==
// @name         tarkan-bot
// @namespace    tarkan.gg
// @version      1.0.0
// @description  MU online: авто-ресет, раздача статов, скриншот canvas
// @author       Санёк
// @match        *://tarkan.gg/*
// @match        *://*.tarkan.gg/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
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
  async function shotBlob() {
    try {
      const stream = cv().captureStream();
      const track = stream.getVideoTracks()[0];
      const bmp = await new ImageCapture(track).grabFrame();
      track.stop();
      const c2 = document.createElement("canvas");
      c2.width = bmp.width;
      c2.height = bmp.height;
      c2.getContext("2d").drawImage(bmp, 0, 0);
      return await new Promise((r) => c2.toBlob(r, "image/png"));
    } catch (e) {
      const url = await shotViaRAF();
      return await (await fetch(url)).blob();
    }
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

  // src/ui/styles.js
  var CSS = `
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

  // src/ui/panel.js
  function buildUI() {
    document.getElementById("tarkan-bot-ui")?.remove();
    document.head.appendChild(el("style", {}, CSS));
    const logEl = el("div", { class: "log" }, "готов · жми кнопку");
    const log = (m) => {
      logEl.textContent = m;
    };
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
    const icMin = el("span", { class: "ic", title: "свернуть" }, "▾");
    const icClose = el("span", { class: "ic", title: "закрыть" }, "✕");
    const hd = el("div", { class: "hd" }, el("span", { class: "ttl" }, "⚡ tarkan-bot"), icMin, icClose);
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
    icClose.onclick = () => {
      if (auto !== null) {
        clearTimeout(auto);
        clearInterval(countIv);
        auto = null;
      }
      removeEventListener("keydown", probe, true);
      removeEventListener("keypress", probe, true);
      STAT_KEYS.forEach((k) => {
        delete statInputs[k];
        delete incInputs[k];
      });
      timingInputs.afterReset = timingInputs.gap = void 0;
      ui.remove();
    };
    let drag = null;
    hd.onmousedown = (e) => {
      if (e.target === icMin || e.target === icClose) return;
      drag = { x: e.clientX, y: e.clientY, l: ui.offsetLeft, t: ui.offsetTop };
      e.preventDefault();
    };
    addEventListener("mousemove", (e) => {
      if (!drag) return;
      ui.style.left = drag.l + e.clientX - drag.x + "px";
      ui.style.top = drag.t + e.clientY - drag.y + "px";
      ui.style.bottom = "auto";
    });
    addEventListener("mouseup", () => drag = null);
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
      focusGame
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
