/**
 * milestones.js — WHO 粗大動作發展里程碑（純資料＋純函式）
 *
 * 設計原則：本檔不得 import DOM API、不得 import store.js，必須可在 node 環境
 * 直接 `import` 並單元測試（見 tests/milestones.test.mjs），比照 analytics.js 模式。
 *
 * 資料來源（月齡數字不得改動）：
 *   WHO Multicentre Growth Reference Study Group (2006). WHO Motor Development
 *   Study: Windows of achievement for six gross motor development milestones.
 *   Acta Paediatrica, 95(S450), 86–95.
 *
 * 重要限制（發展篩檢參考，非診斷）：
 *   - 9 個月前不宜判斷「慢」——六項里程碑中最早關閉的窗口是「獨坐」p99=9.2 個月，
 *     在此之前任何項目「尚未達成」都屬正常範圍內，不構成任何警訊。
 *   - 早產兒應使用矯正年齡（實際年齡 − 早產週數換算的月數）而非實際年齡計算。
 *   - WHO 官方明言不建議對個別兒童計算其落在「第幾百分位」，本模組僅提供三段式
 *     定性落點（early / within / late），不計算精確百分位。
 *   - 手膝爬行（crawling）約 4.3% 健康寶寶會跳過此項（改用其他移行方式，如趴著爬、
 *     坐姿挪動），不會爬不代表異常，此為 WHO 研究已知現象。
 *
 * @typedef {Object} Milestone
 * @property {string} key - 穩定代碼，供資料儲存使用
 * @property {string} name - 中文顯示名稱
 * @property {string} emoji - 代表 emoji
 * @property {number} p1 - 第 1 百分位月齡（最早）
 * @property {number} median - 中位數月齡
 * @property {number} p99 - 第 99 百分位月齡（最晚）
 * @property {string} [note] - 補充註解
 */

/** @type {Milestone[]} */
export const MILESTONES = [
  { key: 'sitting', name: '獨坐（無支撐坐穩）', emoji: '🧎', p1: 3.8, median: 5.9, p99: 9.2 },
  {
    key: 'crawling',
    name: '手膝爬行',
    emoji: '🐛',
    p1: 5.2,
    median: 8.3,
    p99: 13.5,
    note: '約 4.3% 健康寶寶會跳過此項（改用趴著爬、屁股挪動等方式），不爬不代表異常',
  },
  { key: 'standing_assisted', name: '扶著站', emoji: '🤲', p1: 4.8, median: 7.4, p99: 11.4 },
  { key: 'walking_assisted', name: '扶著走', emoji: '🚼', p1: 5.9, median: 9.0, p99: 13.7 },
  { key: 'standing_alone', name: '獨站', emoji: '🧍', p1: 6.9, median: 10.8, p99: 16.9 },
  { key: 'walking_alone', name: '獨走', emoji: '🚶', p1: 8.2, median: 12.0, p99: 17.6 },
];

/** 平均每月天數（365.25 / 12），與 WHO 研究換算方式一致 */
const DAYS_PER_MONTH = 30.4375;

/**
 * 計算達成里程碑時的月齡。
 * @param {string} birthDate - 出生日期 YYYY-MM-DD
 * @param {string} achievedDate - 達成日期 YYYY-MM-DD
 * @returns {number} 月齡，取一位小數
 */
export function ageInMonths(birthDate, achievedDate) {
  const birth = new Date(birthDate + 'T00:00:00Z').getTime();
  const achieved = new Date(achievedDate + 'T00:00:00Z').getTime();
  const diffDays = (achieved - birth) / (24 * 60 * 60 * 1000);
  const months = diffDays / DAYS_PER_MONTH;
  return Math.round(months * 10) / 10;
}

/**
 * 定性判斷達成月齡落在里程碑常模窗口的哪個區段。
 *
 * 不計算精確百分位（WHO 官方不建議對個別兒童做此計算），僅回傳三段式落點：
 *   - 'early'：早於 p1（比 99% 的孩子都早達成）
 *   - 'within'：p1 ~ p99 之間（多數孩子達成的正常窗口內）
 *   - 'late'：晚於 p99（超出 WHO 常模窗口，建議諮詢專業）
 *
 * @param {number} months - 達成時月齡
 * @param {Milestone} milestone
 * @returns {'early'|'within'|'late'}
 */
export function classifyAttainment(months, milestone) {
  if (months < milestone.p1) return 'early';
  if (months > milestone.p99) return 'late';
  return 'within';
}

/**
 * 建立「達成總覽時間軸」所需的資料（純函式，不碰 DOM）。
 *
 * 依 MILESTONES 顯示順序，逐項附上（若有）孩子達成時的月齡與落點分類。
 * 出生日期缺失或無效、或該項尚未有達成紀錄時，achievedMonths／attainment 一律為 null，
 * 不丟出例外（呼叫端可安心對「未設生日」或「尚無任何紀錄」情境畫出純參考用時間軸）。
 *
 * @param {string} babyBirthDate - 出生日期 YYYY-MM-DD（可能為空字串或 undefined）
 * @param {Array<{key: string, achievedDate?: string}>} records - milestones 記錄陣列
 * @returns {Array<{key: string, name: string, emoji: string, p1: number, median: number,
 *   p99: number, achievedMonths: number|null, attainment: ('early'|'within'|'late')|null}>}
 */
export function buildTimeline(babyBirthDate, records) {
  const safeRecords = Array.isArray(records) ? records : [];
  const hasValidBirth = typeof babyBirthDate === 'string' && babyBirthDate.trim().length > 0;

  return MILESTONES.map((milestone) => {
    const record = safeRecords.find((r) => r && r.key === milestone.key);
    let achievedMonths = null;
    let attainment = null;

    if (hasValidBirth && record && record.achievedDate) {
      const months = ageInMonths(babyBirthDate, record.achievedDate);
      if (Number.isFinite(months)) {
        achievedMonths = months;
        attainment = classifyAttainment(months, milestone);
      }
    }

    return {
      key: milestone.key,
      name: milestone.name,
      emoji: milestone.emoji,
      p1: milestone.p1,
      median: milestone.median,
      p99: milestone.p99,
      achievedMonths,
      attainment,
    };
  });
}
