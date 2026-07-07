/**
 * growth.js — WHO 生長曲線 LMS 計算（純函式）
 *
 * 設計原則：本檔不得 import DOM API、不得 import store.js，必須可在 node 環境
 * 直接 `import` 並單元測試（比照 milestones.js／analytics.js 模式）。
 *
 * 資料來源：js/growth-standards.js（GROWTH_STANDARDS，唯讀，勿改數值）。
 *
 * LMS 方法（WHO Child Growth Standards 標準做法）：
 *   z = L≠0 ? ((value/M)^L - 1) / (L*S) : ln(value/M) / S
 *   percentile = 100 * Φ(z)，Φ 為標準常態分布 CDF（此處以 erf 近似實作）
 *
 * 重要限制（發展參考，非診斷）：
 *   - 本模組僅適用 0–24 月標準；超出範圍會夾到邊界並由呼叫端標示「超出範圍」。
 *   - 單次測量意義有限，應觀察趨勢；早產兒應使用矯正年齡。
 *   - 顯示用百分位一律夾在 0.1～99.9，避免極端 z 值顯示 0 或 100 造成誤解。
 */

import { GROWTH_STANDARDS } from './growth-standards.js';

const MIN_MONTH = 0;
const MAX_MONTH = 24;

/**
 * Abramowitz-Stegun 7.1.26 近似，計算誤差函式 erf(x)。
 * @param {number} x
 * @returns {number}
 */
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);

  return sign * y;
}

/**
 * 標準常態分布累積分布函式 Φ(z)。
 * @param {number} z
 * @returns {number} 0~1
 */
function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * 標準常態分布 CDF 的反函式（給定機率 p，求 z）。
 * 用二分搜尋求解（erf 無簡單解析反函式），供 whoCurve 使用。
 * @param {number} p - 0~1（不含端點）
 * @returns {number} z
 */
function inverseNormalCdf(p) {
  let lo = -10;
  let hi = 10;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < p) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

function getIndicatorData(indicator, sex) {
  const ind = GROWTH_STANDARDS.indicators[indicator];
  if (!ind) {
    throw new Error(`未知指標: ${indicator}`);
  }
  const rows = ind[sex];
  if (!rows) {
    throw new Error(`未知性別: ${sex}`);
  }
  return rows;
}

/**
 * 取得指定月齡（可為小數）的內插 LMS 參數。超出 0–24 範圍時夾到邊界。
 * @param {string} indicator - 'weight' | 'length' | 'head'
 * @param {string} sex - 'boys' | 'girls'
 * @param {number} months
 * @returns {{L:number, M:number, S:number, clamped:boolean}}
 */
export function lmsForAge(indicator, sex, months) {
  const rows = getIndicatorData(indicator, sex);
  const clamped = months < MIN_MONTH || months > MAX_MONTH;
  const m = Math.min(Math.max(months, MIN_MONTH), MAX_MONTH);

  const lower = Math.floor(m);
  const upper = Math.ceil(m);

  if (lower === upper) {
    const row = rows[lower];
    return { L: row.L, M: row.M, S: row.S, clamped };
  }

  const rowLower = rows[lower];
  const rowUpper = rows[upper];
  const frac = m - lower;

  return {
    L: rowLower.L + (rowUpper.L - rowLower.L) * frac,
    M: rowLower.M + (rowUpper.M - rowLower.M) * frac,
    S: rowLower.S + (rowUpper.S - rowLower.S) * frac,
    clamped,
  };
}

/**
 * 計算 z 分數。
 * @param {number} value - 測量值
 * @param {number} months - 月齡
 * @param {string} indicator
 * @param {string} sex
 * @returns {number}
 */
export function zscoreFor(value, months, indicator, sex) {
  const { L, M, S } = lmsForAge(indicator, sex, months);
  if (L !== 0) {
    return (Math.pow(value / M, L) - 1) / (L * S);
  }
  return Math.log(value / M) / S;
}

/**
 * 計算百分位（0.1～99.9，避免極端值顯示為 0 或 100）。
 * @param {number} value - 測量值
 * @param {number} months - 月齡
 * @param {string} indicator - 'weight' | 'length' | 'head'
 * @param {string} sex - 'boys' | 'girls'
 * @returns {number} 百分位數字（0.1~99.9）
 */
export function percentileFor(value, months, indicator, sex) {
  const z = zscoreFor(value, months, indicator, sex);
  const p = 100 * normalCdf(z);
  return Math.min(Math.max(p, 0.1), 99.9);
}

/**
 * 給定百分位，回傳該百分位在 0–24 月的 WHO 參考曲線值（供畫參考線）。
 * @param {string} indicator - 'weight' | 'length' | 'head'
 * @param {string} sex - 'boys' | 'girls'
 * @param {number} percentile - 0~100（不含端點，例如 3, 15, 50, 85, 97）
 * @returns {Array<{m:number, value:number}>}
 */
export function whoCurve(indicator, sex, percentile) {
  const rows = getIndicatorData(indicator, sex);
  const z = inverseNormalCdf(percentile / 100);

  return rows.map((row) => {
    const { L, M, S } = row;
    let value;
    if (L !== 0) {
      value = M * Math.pow(1 + L * S * z, 1 / L);
    } else {
      value = M * Math.exp(S * z);
    }
    return { m: row.m, value };
  });
}
