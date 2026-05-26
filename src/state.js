// ============================================================================
//  Общий стор: ссылки на поля панели + геттеры значений.
//  Заполняется в ui/panel.js, читается кнопками "го" и макросом resetMzfk.
// ============================================================================
import { STAT_DEFAULTS, TIMING } from './config.js';

export const statInputs   = {};   // { a: <input>, ... } значения статов
export const incInputs    = {};   // { a: <input>, ... } прибавки статов
export const timingInputs = {};   // { afterReset, gap } паузы

export const statVal   = k => statInputs[k]   ? (+statInputs[k].value   || 0) : (STAT_DEFAULTS[k] || 0);
export const incVal    = k => incInputs[k]    ? (+incInputs[k].value    || 0) : 0;
export const timingVal = k => timingInputs[k] ? (+timingInputs[k].value || TIMING[k]) : TIMING[k];
