// ============================================================================
//  Чат: печать строки и полный цикл "открыть -> напечатать -> отправить".
// ============================================================================
import { focusGame, ENTER, tap } from './keyboard.js';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

// печать строки посимвольно
export async function typeText(str, delay = 30) {
  for (const ch of str) { tap(ch); await sleep(delay); }
}

// открыть чат -> напечатать -> отправить
export async function chatCommand(cmd, { openDelay = 150, charDelay = 40, sendDelay = 150 } = {}) {
  focusGame();              // вернуть фокус игре, иначе ввод игнорируется
  await ENTER();            // открыть чат
  await sleep(openDelay);
  await typeText(cmd, charDelay);
  await sleep(sendDelay);
  await ENTER();            // отправить
}
