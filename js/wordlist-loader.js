/**
 * wordlist-loader.js — 使用者自備題本載入器
 *
 * 版權說明：本模組不包含任何題本詞項內容，僅提供「解析使用者自行提供檔案」的工具函式。
 * 載入後的資料只存進本機 store（localStorage 或使用者自己的 Firebase），絕不寫回 repo。
 *
 * 純函式部分（parseWordlist）不依賴 DOM，可被 node --test 直接測試。
 */

/**
 * @typedef {Object} WordlistEntry
 * @property {string} word
 * @property {string} category
 */

/**
 * 解析使用者上傳的題本檔案文字內容。
 * @param {string} text - 檔案內容
 * @param {'json'|'csv'} type - 檔案類型
 * @returns {{ok: true, entries: WordlistEntry[]} | {ok: false, error: string}}
 */
export function parseWordlist(text, type) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, error: '檔案內容為空' };
  }

  if (type === 'json') {
    return parseJsonWordlist(text);
  }
  if (type === 'csv') {
    return parseCsvWordlist(text);
  }
  return { ok: false, error: `不支援的檔案類型：${type}` };
}

/**
 * @param {string} text
 * @returns {{ok: true, entries: WordlistEntry[]} | {ok: false, error: string}}
 */
function parseJsonWordlist(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'JSON 格式錯誤：' + e.message };
  }

  if (!Array.isArray(data)) {
    return { ok: false, error: 'JSON 內容必須是陣列' };
  }

  /** @type {WordlistEntry[]} */
  const entries = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item || typeof item !== 'object' || typeof item.word !== 'string' || !item.word.trim()) {
      return { ok: false, error: `第 ${i + 1} 筆資料缺少有效的 word 欄位` };
    }
    entries.push({
      word: item.word.trim(),
      category: typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'other',
    });
  }

  if (entries.length === 0) {
    return { ok: false, error: '沒有可用的詞彙資料' };
  }

  return { ok: true, entries };
}

/**
 * 解析 CSV（格式：word,category），支援可選標頭列與 UTF-8 BOM。
 * @param {string} text
 * @returns {{ok: true, entries: WordlistEntry[]} | {ok: false, error: string}}
 */
function parseCsvWordlist(text) {
  // 去除 BOM
  let content = text.replace(/^﻿/, '');
  const lines = content
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { ok: false, error: 'CSV 沒有任何資料列' };
  }

  let startIdx = 0;
  const firstCols = splitCsvLine(lines[0]);
  const looksLikeHeader =
    firstCols.length >= 1 &&
    (firstCols[0].toLowerCase() === 'word' || firstCols[0] === '詞彙');
  if (looksLikeHeader) {
    startIdx = 1;
  }

  /** @type {WordlistEntry[]} */
  const entries = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const word = (cols[0] || '').trim();
    if (!word) {
      return { ok: false, error: `第 ${i + 1} 行缺少詞彙欄位` };
    }
    const category = (cols[1] || '').trim() || 'other';
    entries.push({ word, category });
  }

  if (entries.length === 0) {
    return { ok: false, error: '沒有可用的詞彙資料' };
  }

  return { ok: true, entries };
}

/**
 * 極簡 CSV 單行切割（支援雙引號包欄位）。
 * @param {string} line
 * @returns {string[]}
 */
function splitCsvLine(line) {
  const cols = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cols.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}
