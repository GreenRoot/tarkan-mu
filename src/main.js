// ============================================================================
//  Точка входа. Ждём canvas (для Tampermonkey он появляется не сразу),
//  затем строим панель и кладём API в window для ручных вызовов из консоли.
// ============================================================================
import * as keyboard from './keyboard.js';
import { typeText, chatCommand } from './chat.js';
import { resetMzfk } from './macro.js';
import { screenshot, showShot } from './screenshot.js';
import { pickRegion, readNumber, teach, analyze, setRegion, ocrState } from './ocr.js';
import { buildUI } from './ui/panel.js';

function start(canvas) {
  keyboard.setTarget(canvas);
  buildUI();
  Object.assign(window, {
    tap: keyboard.tap, typeText, chatCommand, resetMzfk,
    ENTER: keyboard.ENTER, BACKSPACE: keyboard.BACKSPACE, ESCAPE: keyboard.ESCAPE,
    screenshot, showShot, buildUI, focusGame: keyboard.focusGame,
    pickRegion, readNumber, teach, analyze, setRegion, ocrState,
  });
  console.log('%ctarkan-bot готов', 'color:#0f0',
    '\n  панель снизу слева. либо: chatCommand("/reset") · showShot()');
}

const c = document.getElementById('canvas');
if (c) {
  start(c);
} else {                              // ждём появления canvas (SPA/WASM грузится async)
  const iv = setInterval(() => {
    const c = document.getElementById('canvas');
    if (c) { clearInterval(iv); start(c); }
  }, 300);
}
