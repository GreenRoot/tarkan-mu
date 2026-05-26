// ============================================================================
//  Скриншот canvas.
//  WebGL с preserveDrawingBuffer:false -> toDataURL даёт чёрный кадр.
//  Основной путь — captureStream компоновщика (не зависит от флага).
//  Запасной — rAF-хук + toDataURL в том же кадре, пока буфер цел.
//  Canvas резолвим лениво (для Tampermonkey, где он появляется не сразу).
// ============================================================================
const cv = () => document.getElementById('canvas');

// запасной путь: ловим кадр сразу после отрисовки игрой
window.__shot = null; window.__grab = false;
(function hookRAF() {
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => {
    cb(t);
    if (window.__grab) { window.__grab = false;
      try { window.__shot = cv()?.toDataURL('image/png'); } catch (e) {} }
  });
})();
function shotViaRAF() {
  return new Promise(res => { window.__grab = true;
    const i = setInterval(() => { if (window.__shot) { clearInterval(i);
      const s = window.__shot; window.__shot = null; res(s); } }, 16); });
}

// ImageBitmap текущего кадра (для OCR/анализа пикселей). С запасным путём.
export async function grabBitmap() {
  try {
    const stream = cv().captureStream();
    const track = stream.getVideoTracks()[0];
    const bmp = await new ImageCapture(track).grabFrame();
    track.stop();
    return bmp;
  } catch (e) {                                   // запасной путь через rAF
    const url = await shotViaRAF();
    const blob = await (await fetch(url)).blob();
    return await createImageBitmap(blob);
  }
}

// PNG-blob кадра
export async function shotBlob() {
  const bmp = await grabBitmap();
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  return await new Promise(r => c.toBlob(r, 'image/png'));
}
// dataURL текущего кадра
export async function screenshot() {
  const b = await shotBlob();
  return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
}
// открыть кадр в новой вкладке (blob-URL надёжнее огромного dataURL)
export async function showShot() { window.open(URL.createObjectURL(await shotBlob()), '_blank'); }
