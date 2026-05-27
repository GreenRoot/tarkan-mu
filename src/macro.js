// ============================================================================
//  Макрос RESET MZFK: /reset -> пауза -> раздача статов (0 пропускается).
//  Паузы и статы берутся из панели (state.js), но можно переопределить аргами.
// ============================================================================
import { focusGame } from './keyboard.js';
import { chatCommand, sleep } from './chat.js';
import { STAT_KEYS } from './config.js';
import { statVal, timingVal } from './state.js';

export async function resetMzfk(afterReset, gap) {
  afterReset = afterReset ?? timingVal('afterReset');
  gap        = gap        ?? timingVal('gap');
  const opts = { openDelay: timingVal('open'), charDelay: timingVal('char'), sendDelay: timingVal('send') };
  focusGame();
  await chatCommand('/reset', opts);
  await sleep(afterReset);                        // даём серверу применить ресет
  for (const k of STAT_KEYS) {
    const v = statVal(k);
    if (v <= 0) continue;                         // 0 -> команда не выполняется
    await chatCommand(`/${k} ${v}`, opts);
    await sleep(gap);
  }
}
