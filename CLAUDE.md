# tarkan-bot — заметки для Claude

Авто-бот для MU online (tarkan.gg) в браузере. Игра — **SDL2, скомпилированный
Emscripten'ом** (WASM). Бот синтезирует ввод и управляет панелью поверх canvas.

## Команды

```bash
npm install      # один раз (esbuild)
npm run build    # src/ -> dist/tarkan-bot.js (консоль) + dist/tarkan-bot.user.js (Tampermonkey)
npm run watch    # пересборка при правках
```

Использование: собрать → вставить `dist/tarkan-bot.js` в консоль DevTools игры,
либо поставить `dist/tarkan-bot.user.js` в Tampermonkey. **Всегда правим `src/`,
не `dist/`** (dist генерируется). Дефолты (статы, паузы, интервалы) — в `src/config.js`.

## Структура

```
src/
  config.js     дефолты
  state.js      стор: ссылки на поля панели + геттеры (statVal/incVal/timingVal)
  keyboard.js   инъекция клавиш, focusGame, ENTER/BACKSPACE/ESCAPE
  chat.js       typeText, chatCommand
  macro.js      resetMzfk (/reset -> пауза -> раздача статов)
  screenshot.js скриншот canvas
  ui/dom.js     el(), makeEditable()
  ui/styles.css CSS (импортится как текст через esbuild loader)
  ui/panel.js   buildUI() — вся панель
  main.js       вход: ждёт canvas -> панель -> экспорт в window
legacy/         старый монолит (до декомпозиции)
desktop.js, f.js  референсы игры (не наш код)
```

## КРИТИЧНО — неочевидное (выстрадано, не сломать)

- **Клавиши читаются из DOM-событий напрямую** (SDL слушает на `window`). Поля
  `keyCode/which/charCode` конструктор `KeyboardEvent` **игнорирует** → форсим через
  `Object.defineProperty` (см. `makeEvt`). Без этого `which=0` и текст не вводится.
- **Enter = keydown → удержание ~60мс → keyup** (`press()` в keyboard.js). Почему:
  игра считает нажатия по фронту. Мгновенный keyup в том же кадре **закрывает чат**.
  keydown без keyup → клавиша «залипает», повтор игнорится. Только с паузой работает.
- **Игра должна быть в фокусе**, иначе SDL не обрабатывает ввод. Клик по кнопке панели
  НЕ должен уводить фокус → на всех кнопках `mousedown` + `preventDefault`; перед
  отправкой зовём `focusGame()` (canvas с `tabindex=-1`).
- **Поля панели редактируются вручную** (`makeEditable`): SDL делает `preventDefault`
  на клавишах, браузер не печатает в инпуты сам.
- **Скриншот** — у canvas `preserveDrawingBuffer:false`, поэтому `toDataURL` даёт
  чёрный кадр. Берём через `captureStream()` + `ImageCapture.grabFrame()` (`shotBlob`).
  canvas НЕ в воркере (нет `transferControlToOffscreen`).

## WebSocket — НЕ трогать (проверено, тупик)

Игровое состояние (уровень/позиция/HP) ходит бинарно по WS, НЕ через JS-геттеры
(`desktop.js` = только Emscripten-клей). Пробовали сниффать — **каждый пакет подписан
id, идёт цепочка идентификаторов**. Реверс слишком тяжёлый, фичу откатили. Не
предлагать снова без явной просьбы. Альтернатива для триггеров — чтение пикселей
canvas (`screenshot()` → `getImageData`).
