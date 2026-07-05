/**
 * analytics.js — 純函式分析模組
 *
 * 設計原則：本檔不得 import DOM API、不得 import store.js，必須可在 node 環境
 * 直接 `import` 並單元測試（見 tests/analytics.test.mjs）。
 *
 * @typedef {Object} WordRecord
 * @property {string} word - 詞彙文字
 * @property {string} category - 類別 id（見 categories.js）
 * @property {string|null} understandsDate - 聽得懂日期 YYYY-MM-DD，null 表示尚未達成
 * @property {string|null} saysDate - 會說日期 YYYY-MM-DD，null 表示尚未達成
 * @property {string} [note] - 情境備註
 * @property {string} [recorder] - 記錄者（爸爸／媽媽）
 */

/**
 * 計算累積詞彙曲線。
 * @param {WordRecord[]} words
 * @param {'understands'|'says'} track
 * @returns {{date: string, count: number}[]} 依日期排序的累積計數陣列
 */
export function cumulativeCurve(words, track) {
  const dateField = track === 'says' ? 'saysDate' : 'understandsDate';
  const dates = words
    .map((w) => w[dateField])
    .filter((d) => !!d)
    .sort();

  /** @type {{date: string, count: number}[]} */
  const result = [];
  let count = 0;
  for (const date of dates) {
    count += 1;
    const last = result[result.length - 1];
    if (last && last.date === date) {
      last.count = count;
    } else {
      result.push({ date, count });
    }
  }
  return result;
}

/**
 * 取得某日期所屬的週起始日（週一為週首），格式 YYYY-MM-DD。
 * @param {string} dateStr
 * @returns {string}
 */
function weekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? 6 : day - 1); // 距離週一的天數
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

/**
 * 各週新增詞彙數。
 * @param {WordRecord[]} words
 * @param {'understands'|'says'} track
 * @returns {{weekStart: string, count: number}[]} 依週排序
 */
export function weeklyNewWords(words, track) {
  const dateField = track === 'says' ? 'saysDate' : 'understandsDate';
  const dates = words.map((w) => w[dateField]).filter((d) => !!d);

  /** @type {Map<string, number>} */
  const byWeek = new Map();
  for (const date of dates) {
    const wk = weekStart(date);
    byWeek.set(wk, (byWeek.get(wk) || 0) + 1);
  }

  return Array.from(byWeek.entries())
    .map(([weekStart, count]) => ({ weekStart, count }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 詞彙爆發期偵測（vocabulary spurt）。
 *
 * 定義依據：Goldfield, B. A., & Reznick, J. S. (1990). Early lexical acquisition:
 * Rate, content, and the vocabulary spurt. Journal of Child Language, 17(1), 171-183.
 * 文獻描述表達詞彙約在 50 詞左右常出現加速學習的「爆發期」現象。
 *
 * 本工具的可操作化定義（工程近似，非臨床診斷）：
 *   - 前提：表達詞彙（says）累積總數已達 50 詞以上
 *   - 觸發：以「最新表達詞的日期」為錨點，往前 7 天內新增 ≥10 詞，
 *           或往前 14 天內新增 ≥20 詞
 *
 * 未達 50 詞前僅回傳里程碑進度，不判定爆發期。
 *
 * @param {WordRecord[]} words
 * @returns {{burst: boolean, totalSays: number, milestone: number|null, recentCount7d: number, recentCount14d: number, anchorDate: string|null}}
 */
export function detectBurst(words) {
  const saysDates = words
    .map((w) => w.saysDate)
    .filter((d) => !!d)
    .sort();

  const totalSays = saysDates.length;

  const milestones = [200, 100, 50];
  const milestone = milestones.find((m) => totalSays >= m) || null;

  if (totalSays < 50) {
    return {
      burst: false,
      totalSays,
      milestone,
      recentCount7d: 0,
      recentCount14d: 0,
      anchorDate: null,
    };
  }

  const anchorDate = saysDates[saysDates.length - 1];
  const anchorTime = new Date(anchorDate + 'T00:00:00Z').getTime();

  const recentCount7d = saysDates.filter((d) => {
    const t = new Date(d + 'T00:00:00Z').getTime();
    return anchorTime - t <= 7 * MS_PER_DAY && anchorTime - t >= 0;
  }).length;

  const recentCount14d = saysDates.filter((d) => {
    const t = new Date(d + 'T00:00:00Z').getTime();
    return anchorTime - t <= 14 * MS_PER_DAY && anchorTime - t >= 0;
  }).length;

  const burst = recentCount7d >= 10 || recentCount14d >= 20;

  return { burst, totalSays, milestone, recentCount7d, recentCount14d, anchorDate };
}

/**
 * 各類別理解／表達計數與比例。
 * @param {WordRecord[]} words
 * @param {{id: string, name: string, emoji: string}[]} categories
 * @returns {{id: string, name: string, emoji: string, understands: number, says: number, understandsRatio: number, saysRatio: number}[]}
 */
export function categoryStats(words, categories) {
  const totalUnderstands = words.filter((w) => !!w.understandsDate).length;
  const totalSays = words.filter((w) => !!w.saysDate).length;

  return categories.map((cat) => {
    const inCat = words.filter((w) => w.category === cat.id);
    const understands = inCat.filter((w) => !!w.understandsDate).length;
    const says = inCat.filter((w) => !!w.saysDate).length;
    return {
      id: cat.id,
      name: cat.name,
      emoji: cat.emoji,
      understands,
      says,
      understandsRatio: totalUnderstands > 0 ? understands / totalUnderstands : 0,
      saysRatio: totalSays > 0 ? says / totalSays : 0,
    };
  });
}

const CSV_BOM = '﻿';

/**
 * 跳脫 CSV 欄位值（處理逗號、換行、雙引號）。
 * @param {string} value
 * @returns {string}
 */
function escapeCsvField(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * 產生長格式研究級 CSV（含 UTF-8 BOM）。
 * 欄位：類型,詞彙,類別,軌道,日期,情境備註,記錄者
 * @param {WordRecord[]} words
 * @param {Array<{gesture: string, date: string, note?: string, recorder?: string}>} gestures
 * @returns {string}
 */
export function toCSV(words, gestures) {
  const header = ['類型', '詞彙', '類別', '軌道', '日期', '情境備註', '記錄者'];
  const rows = [header];

  for (const w of words) {
    if (w.understandsDate) {
      rows.push(['詞彙', w.word, w.category, '理解', w.understandsDate, w.note || '', w.recorder || '']);
    }
    if (w.saysDate) {
      rows.push(['詞彙', w.word, w.category, '表達', w.saysDate, w.note || '', w.recorder || '']);
    }
  }

  for (const g of gestures || []) {
    rows.push(['手勢', g.gesture, '', '手勢', g.date, g.note || '', g.recorder || '']);
  }

  const body = rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
  return CSV_BOM + body;
}
