import test from 'node:test';
import assert from 'node:assert/strict';

import { MILESTONES, ageInMonths, classifyAttainment, buildTimeline } from '../js/milestones.js';

// ---------------------------------------------------------------------------
// MILESTONES — 六項齊全且數字正確（WHO 2006 原始數字，不得改動）
// ---------------------------------------------------------------------------

test('MILESTONES: 六項里程碑齊全', () => {
  assert.equal(MILESTONES.length, 6);
  const keys = MILESTONES.map((m) => m.key);
  assert.deepEqual(keys, [
    'sitting',
    'crawling',
    'standing_assisted',
    'walking_assisted',
    'standing_alone',
    'walking_alone',
  ]);
});

test('MILESTONES: WHO 原始數字正確', () => {
  const byKey = Object.fromEntries(MILESTONES.map((m) => [m.key, m]));

  assert.deepEqual(
    { p1: byKey.sitting.p1, median: byKey.sitting.median, p99: byKey.sitting.p99 },
    { p1: 3.8, median: 5.9, p99: 9.2 }
  );
  assert.deepEqual(
    { p1: byKey.crawling.p1, median: byKey.crawling.median, p99: byKey.crawling.p99 },
    { p1: 5.2, median: 8.3, p99: 13.5 }
  );
  assert.deepEqual(
    {
      p1: byKey.standing_assisted.p1,
      median: byKey.standing_assisted.median,
      p99: byKey.standing_assisted.p99,
    },
    { p1: 4.8, median: 7.4, p99: 11.4 }
  );
  assert.deepEqual(
    {
      p1: byKey.walking_assisted.p1,
      median: byKey.walking_assisted.median,
      p99: byKey.walking_assisted.p99,
    },
    { p1: 5.9, median: 9.0, p99: 13.7 }
  );
  assert.deepEqual(
    { p1: byKey.standing_alone.p1, median: byKey.standing_alone.median, p99: byKey.standing_alone.p99 },
    { p1: 6.9, median: 10.8, p99: 16.9 }
  );
  assert.deepEqual(
    { p1: byKey.walking_alone.p1, median: byKey.walking_alone.median, p99: byKey.walking_alone.p99 },
    { p1: 8.2, median: 12.0, p99: 17.6 }
  );
});

test('MILESTONES: 每項皆有 name／emoji；crawling 附跳過比例註解', () => {
  for (const m of MILESTONES) {
    assert.ok(m.name && m.name.length > 0, `${m.key} 缺 name`);
    assert.ok(m.emoji && m.emoji.length > 0, `${m.key} 缺 emoji`);
  }
  const crawling = MILESTONES.find((m) => m.key === 'crawling');
  assert.ok(/4\.3%/.test(crawling.note), '手膝爬行應註解約 4.3% 跳過比例');
});

// ---------------------------------------------------------------------------
// ageInMonths
// ---------------------------------------------------------------------------

test('ageInMonths: 跨月計算正確（約 1 個月）', () => {
  const months = ageInMonths('2025-07-21', '2025-08-21');
  assert.ok(Math.abs(months - 1.0) < 0.15, `預期約 1.0 個月，實際 ${months}`);
});

test('ageInMonths: 跨年計算正確（約 12 個月）', () => {
  const months = ageInMonths('2025-07-21', '2026-07-21');
  assert.ok(Math.abs(months - 12.0) < 0.15, `預期約 12.0 個月，實際 ${months}`);
});

test('ageInMonths: 同一天為 0 個月', () => {
  assert.equal(ageInMonths('2025-07-21', '2025-07-21'), 0);
});

test('ageInMonths: 回傳值取一位小數', () => {
  const months = ageInMonths('2025-07-21', '2025-09-05');
  assert.equal(months, Math.round(months * 10) / 10);
});

// ---------------------------------------------------------------------------
// classifyAttainment — 以 WHO 獨坐（sitting）實際數字造例：p1=3.8, median=5.9, p99=9.2
// ---------------------------------------------------------------------------

test('classifyAttainment: within — 5 個月達成獨坐，落在正常窗口內', () => {
  const sitting = MILESTONES.find((m) => m.key === 'sitting');
  assert.equal(classifyAttainment(5, sitting), 'within');
});

test('classifyAttainment: early — 3 個月達成獨坐，早於 p1 3.8', () => {
  const sitting = MILESTONES.find((m) => m.key === 'sitting');
  assert.equal(classifyAttainment(3, sitting), 'early');
});

test('classifyAttainment: late — 10 個月才達成獨坐，晚於 p99 9.2', () => {
  const sitting = MILESTONES.find((m) => m.key === 'sitting');
  assert.equal(classifyAttainment(10, sitting), 'late');
});

test('classifyAttainment: 邊界值 p1／p99 本身視為 within', () => {
  const sitting = MILESTONES.find((m) => m.key === 'sitting');
  assert.equal(classifyAttainment(3.8, sitting), 'within');
  assert.equal(classifyAttainment(9.2, sitting), 'within');
});

// ---------------------------------------------------------------------------
// buildTimeline
// ---------------------------------------------------------------------------

test('buildTimeline: 六項齊全且順序與 MILESTONES 一致', () => {
  const timeline = buildTimeline('2025-07-21', []);
  assert.equal(timeline.length, 6);
  assert.deepEqual(
    timeline.map((t) => t.key),
    MILESTONES.map((m) => m.key)
  );
  for (const t of timeline) {
    assert.equal(t.achievedMonths, null);
    assert.equal(t.attainment, null);
  }
});

test('buildTimeline: 有達成紀錄時 achievedMonths 與 attainment 正確（獨坐 6 個月大，within）', () => {
  const records = [{ key: 'sitting', achievedDate: '2026-01-21' }];
  const timeline = buildTimeline('2025-07-21', records);
  const sitting = timeline.find((t) => t.key === 'sitting');
  assert.equal(sitting.achievedMonths, 6.0);
  assert.equal(sitting.attainment, 'within');

  // 其餘項目未記錄，維持 null
  const others = timeline.filter((t) => t.key !== 'sitting');
  for (const t of others) {
    assert.equal(t.achievedMonths, null);
    assert.equal(t.attainment, null);
  }
});

test('buildTimeline: 出生日期為空字串時 achievedMonths 全為 null 且不丟例外', () => {
  const records = [{ key: 'sitting', achievedDate: '2026-01-21' }];
  assert.doesNotThrow(() => {
    const timeline = buildTimeline('', records);
    for (const t of timeline) {
      assert.equal(t.achievedMonths, null);
      assert.equal(t.attainment, null);
    }
  });
});

test('buildTimeline: 出生日期為 undefined 時同樣安全（不丟例外）', () => {
  assert.doesNotThrow(() => {
    const timeline = buildTimeline(undefined, [{ key: 'sitting', achievedDate: '2026-01-21' }]);
    assert.equal(timeline.find((t) => t.key === 'sitting').achievedMonths, null);
  });
});
