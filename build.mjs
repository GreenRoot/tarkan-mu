// ============================================================================
//  Сборка src/ -> один файл. Две цели:
//    dist/tarkan-bot.js       — вставить в консоль DevTools
//    dist/tarkan-bot.user.js  — поставить в Tampermonkey (с UserScript-шапкой)
//  Запуск: npm run build   (или npm run watch)
// ============================================================================
import * as esbuild from 'esbuild';

const VERSION = '1.4.1';

const consoleBanner = `// tarkan-bot v${VERSION} — собрано из src/. Вставить целиком в консоль DevTools (F12).`;

const userScriptBanner = `// ==UserScript==
// @name         tarkan-bot
// @namespace    tarkan.gg
// @version      ${VERSION}
// @description  MU online: авто-ресет, раздача статов, скриншот canvas
// @author       Санёк
// @match        *://tarkan.gg/*
// @match        *://*.tarkan.gg/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/GreenRoot/tarkan-mu/main/dist/tarkan-bot.user.js
// @updateURL    https://raw.githubusercontent.com/GreenRoot/tarkan-mu/main/dist/tarkan-bot.user.js
// ==/UserScript==`;

const common = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  charset: 'utf8',
  legalComments: 'none',
  loader: { '.css': 'text' },   // import CSS from './styles.css' -> строка
};

const targets = [
  { ...common, outfile: 'dist/tarkan-bot.js',      banner: { js: consoleBanner } },
  { ...common, outfile: 'dist/tarkan-bot.user.js', banner: { js: userScriptBanner } },
];

const watch = process.argv.includes('--watch');

if (watch) {
  for (const t of targets) {
    const ctx = await esbuild.context(t);
    await ctx.watch();
  }
  console.log('watching src/ ... (Ctrl+C для выхода)');
} else {
  for (const t of targets) await esbuild.build(t);
  console.log('built:\n  dist/tarkan-bot.js (консоль)\n  dist/tarkan-bot.user.js (Tampermonkey)');
}
