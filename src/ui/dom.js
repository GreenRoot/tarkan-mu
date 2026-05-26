// ============================================================================
//  DOM-хелперы панели.
// ============================================================================

// el('button', { onclick, class }, ...children)
export function el(tag, props = {}, ...kids) {
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
export function makeEditable(inp) {
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    const v = inp.value, s = inp.selectionStart, en = inp.selectionEnd, k = e.key;
    const set = (nv, c) => { inp.value = nv; inp.selectionStart = inp.selectionEnd = c; };
    if (k === 'Backspace')      s !== en ? set(v.slice(0, s) + v.slice(en), s) : s > 0 && set(v.slice(0, s - 1) + v.slice(en), s - 1);
    else if (k === 'Delete')    s !== en ? set(v.slice(0, s) + v.slice(en), s) : set(v.slice(0, s) + v.slice(s + 1), s);
    else if (k === 'ArrowLeft') inp.selectionStart = inp.selectionEnd = Math.max(0, s - 1);
    else if (k === 'ArrowRight')inp.selectionStart = inp.selectionEnd = Math.min(v.length, en + 1);
    else if (k === 'Home')      inp.selectionStart = inp.selectionEnd = 0;
    else if (k === 'End')       inp.selectionStart = inp.selectionEnd = v.length;
    else if (k.length === 1)    set(v.slice(0, s) + k + v.slice(en), s + 1);
  }, false);
}
