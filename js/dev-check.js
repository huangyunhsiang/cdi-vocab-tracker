/**
 * dev-check.js — 發展檢核（CDC 全領域里程碑）純函式
 *
 * 設計原則：本檔不得 import DOM API、不得 import store.js，必須可在 node 環境
 * 直接 `import` 並單元測試（比照 milestones.js／analytics.js／growth.js 模式）。
 *
 * 資料來源：js/dev-milestones.js（DEV_MILESTONES，唯讀，勿改數值）。
 *
 * 重要限制（發展篩檢參考，非診斷）：
 *   - CDC Learn the Signs 全領域里程碑，約 75% 同齡兒童能做到，為發展檢核參考，非診斷；
 *     未達成不代表異常；早產兒建議以矯正年齡計算；有疑慮請諮詢兒科醫師或兒童發展聯合評估中心。
 */

import { ageInMonths } from './milestones.js';
import { DEV_MILESTONES } from './dev-milestones.js';

/**
 * 依寶寶月齡回傳「最接近且已達到」的檢查點 months。
 *
 * 規則：找出所有 <= 目前月齡的檢查點，取其中最大者（最接近的已到達檢查點）；
 * 若目前月齡小於最小檢查點（2 個月），回傳最小檢查點（2）；
 * 若目前月齡大於最大檢查點（60 個月），回傳最大檢查點（60）。
 *
 * @param {string} birthDateStr - 出生日期 YYYY-MM-DD
 * @param {string} todayStr - 對照日期 YYYY-MM-DD（通常是今天）
 * @returns {number|null} 檢查點 months；出生日期無效時回傳 null
 */
export function currentCheckpoint(birthDateStr, todayStr) {
  if (typeof birthDateStr !== 'string' || birthDateStr.trim().length === 0) {
    return null;
  }
  if (typeof todayStr !== 'string' || todayStr.trim().length === 0) {
    return null;
  }

  const months = ageInMonths(birthDateStr, todayStr);
  if (!Number.isFinite(months)) {
    return null;
  }

  const checkpoints = DEV_MILESTONES.map((m) => m.months).sort((a, b) => a - b);
  const minCheckpoint = checkpoints[0];
  const maxCheckpoint = checkpoints[checkpoints.length - 1];

  if (months <= minCheckpoint) return minCheckpoint;
  if (months >= maxCheckpoint) return maxCheckpoint;

  // 取所有 <= 目前月齡的檢查點中的最大值（最接近且已達到）
  const reached = checkpoints.filter((c) => c <= months);
  return reached.length > 0 ? reached[reached.length - 1] : minCheckpoint;
}

/**
 * 計算指定年齡檢查點的勾選進度。
 *
 * @param {Object<string, boolean>} checkedMap - key 格式 `${months}_${domain}_${index}` → true
 * @param {number} months - 年齡檢查點（對應 DEV_MILESTONES 的 months）
 * @returns {{total:number, done:number, byDomain: Object<string, {total:number, done:number}>}}
 */
export function checkpointProgress(checkedMap, months) {
  const safeMap = checkedMap && typeof checkedMap === 'object' ? checkedMap : {};
  const entry = DEV_MILESTONES.find((m) => m.months === months);

  const result = { total: 0, done: 0, byDomain: {} };
  if (!entry) {
    return result;
  }

  for (const domain of Object.keys(entry.domains)) {
    const items = entry.domains[domain];
    const domainResult = { total: items.length, done: 0 };

    items.forEach((_, index) => {
      const key = `${months}_${domain}_${index}`;
      if (safeMap[key]) {
        domainResult.done += 1;
      }
    });

    result.byDomain[domain] = domainResult;
    result.total += domainResult.total;
    result.done += domainResult.done;
  }

  return result;
}
