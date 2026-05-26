// ============================================================================
//  Инъекция клавиатуры в SDL2/Emscripten.
//  Игра читает поля key/code/keyCode/which/charCode прямо из DOM-событий.
//  Конструктор KeyboardEvent игнорит keyCode/which/charCode — форсим вручную.
// ============================================================================

// Цель диспатча. canvas без tabindex не фокусируется -> добавляем.
// Событие с bubbles:true всплывёт до document/window, покроет слушатель SDL.
export let TARGET = (typeof document !== 'undefined' && document.getElementById('canvas'))
  || (typeof window !== 'undefined' ? window : null);

export function setTarget(t) {
  if (t) TARGET = t;
  if (TARGET && TARGET.setAttribute) TARGET.setAttribute('tabindex', '-1');
}
setTarget(TARGET);

export function focusGame() { try { TARGET.focus({ preventScroll: true }); } catch (e) {} }

// --- раскладка: символ -> e.code / legacy keyCode --------------------------
function codeFor(ch) {
  if (/[a-z]/i.test(ch)) return 'Key' + ch.toUpperCase();
  if (/[0-9]/.test(ch))  return 'Digit' + ch;
  return ({ ' ': 'Space', '/': 'Slash', '.': 'Period', ',': 'Comma',
            '-': 'Minus', '=': 'Equal' })[ch] || '';
}
function keyCodeFor(ch) {
  if (/[a-z]/i.test(ch)) return ch.toUpperCase().charCodeAt(0); // 65..90
  if (/[0-9]/.test(ch))  return ch.charCodeAt(0);               // 48..57
  return ({ ' ': 32, '/': 191, '.': 190, ',': 188, '-': 189, '=': 187 })[ch]
         || ch.charCodeAt(0);
}

// --- сборка одного KeyboardEvent с принудительными legacy-полями ------------
export function makeEvt(type, key, extra = {}) {
  const e = new KeyboardEvent(type, {
    bubbles: true, cancelable: true, composed: true,
    key, code: extra.code ?? codeFor(key), location: 0, repeat: false,
    ctrlKey: !!extra.ctrlKey, shiftKey: !!extra.shiftKey,
    altKey: !!extra.altKey, metaKey: !!extra.metaKey,
  });
  const kc = extra.keyCode ?? keyCodeFor(key);
  const cc = type === 'keypress' ? (extra.charCode ?? key.charCodeAt(0)) : 0;
  Object.defineProperties(e, {
    keyCode:  { get: () => kc },
    which:    { get: () => (type === 'keypress' ? cc : kc) },
    charCode: { get: () => cc },
  });
  return e;
}

// --- печать одного печатного символа (keydown+keypress+keyup) ---------------
export function tap(ch, extra = {}) {
  TARGET.dispatchEvent(makeEvt('keydown',  ch, extra));
  TARGET.dispatchEvent(makeEvt('keypress', ch, extra)); // <- сюда идёт текст
  TARGET.dispatchEvent(makeEvt('keyup',    ch, extra));
}

// --- управляющая клавиша: keydown -> УДЕРЖАНИЕ -> keyup ----------------------
// Игра считает нажатия по фронту: клавишу надо отпускать, но мгновенный keyup
// в том же кадре закрывает чат. Поэтому держим ~60мс, как настоящая клавиша.
export async function press(keyName, keyCode, code, hold = 60) {
  TARGET.dispatchEvent(makeEvt('keydown', keyName, { keyCode, code }));
  await new Promise(r => setTimeout(r, hold));
  TARGET.dispatchEvent(makeEvt('keyup', keyName, { keyCode, code }));
}
// Enter: чат закрыт -> откроет, чат открыт -> отправит (одно удержание)
export const ENTER     = () => press('Enter',     13, 'Enter');
export const BACKSPACE = () => press('Backspace',  8, 'Backspace');
export const ESCAPE    = () => press('Escape',    27, 'Escape');
