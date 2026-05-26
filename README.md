# tarkan-bot

Авто-бот для MU online (tarkan.gg) в браузере: открытие чата, ввод команд,
авто-ресет с раздачей статов, скриншот canvas. Игра — SDL2/Emscripten (WASM),
клавиатура читается прямо из DOM key-событий — бот их синтезирует.

## Структура

```
src/
  config.js       дефолты (статы, прибавки, паузы, интервал авто)
  state.js        общий стор: ссылки на поля панели + геттеры значений
  keyboard.js     инъекция клавиш (makeEvt/tap/press/ENTER), фокус игры
  chat.js         typeText, chatCommand (открыть → напечатать → отправить)
  macro.js        resetMzfk: /reset → пауза → раздача статов
  screenshot.js   скриншот canvas (captureStream + запасной rAF)
  ui/
    dom.js        el(), makeEditable() (ручной ввод в поля поверх SDL)
    styles.css    CSS панели (импортится как текст)
    panel.js      buildUI() — вся панель
  main.js         точка входа: ждёт canvas, строит панель, экспорт в window
build.mjs         сборка esbuild → dist/
dist/
  tarkan-bot.js       ← вставить в консоль DevTools
  tarkan-bot.user.js  ← поставить в Tampermonkey
legacy/             старый монолит (до декомпозиции)
```

## Сборка

```bash
npm install      # один раз (ставит esbuild)
npm run build    # собрать dist/
npm run watch    # пересобирать при изменении src/
```

## Использование

**Консоль:** открой DevTools (F12) на странице игры → вставь содержимое
`dist/tarkan-bot.js` → Enter. Панель появится снизу слева.

**Tampermonkey:** создай новый скрипт → вставь `dist/tarkan-bot.user.js` →
сохрани. Запустится сам на tarkan.gg (поправь `@match`, если домен другой).

Из консоли доступно: `chatCommand("/reset")`, `resetMzfk()`,
`await screenshot()`, `showShot()`, `ENTER()`, `focusGame()`.
