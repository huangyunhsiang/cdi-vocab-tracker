import test from 'node:test';
import assert from 'node:assert/strict';

import { currentCheckpoint, checkpointProgress } from '../js/dev-check.js';
import { DEV_MILESTONES } from '../js/dev-milestones.js';

// ---------------------------------------------------------------------------
// currentCheckpoint
// ---------------------------------------------------------------------------

test('currentCheckpoint: 13 個月大 → 回傳 12（最接近已達到的檢查點）', () => {
  // 生日 2025-07-21，對照日 2026-08-21 約 13 個月
  const result = currentCheckpoint('2025-07-21', '2026-08-21');
  assert.equal(result, 12);
});

test('currentCheckpoint: 未滿 2 個月（1 個月）→ 回傳最小檢查點 2', () => {
  // 生日 2025-07-21，對照日 2025-08-21 約 1 個月
  const result = currentCheckpoint('2025-07-21', '2025-08-21');
  assert.equal(result, 2);
});

test('currentCheckpoint: 超過 60 個月（約 70 個月）→ 回傳最大檢查點 60', () => {
  // 生日 2020-01-21，對照日 2025-11-21 約 70 個月
  const result = currentCheckpoint('2020-01-21', '2025-11-21');
  assert.equal(result, 60);
});

test('currentCheckpoint: 2.5 歲（約 30 個月）→ 回傳 30', () => {
  // 生日 2023-01-21，對照日 2025-07-21 約 30 個月
  const result = currentCheckpoint('2023-01-21', '2025-07-21');
  assert.equal(result, 30);
});

test('currentCheckpoint: 出生日期無效（空字串）→ 回傳 null', () => {
  assert.equal(currentCheckpoint('', '2026-01-01'), null);
});

test('currentCheckpoint: 出生日期為 undefined → 回傳 null', () => {
  assert.equal(currentCheckpoint(undefined, '2026-01-01'), null);
});

test('currentCheckpoint: 恰好落在檢查點月齡上（12 個月整）→ 回傳該檢查點', () => {
  // 生日 2025-01-21，對照日 2026-01-21 恰好 12 個月
  const result = currentCheckpoint('2025-01-21', '2026-01-21');
  assert.equal(result, 12);
});

// ---------------------------------------------------------------------------
// checkpointProgress
// ---------------------------------------------------------------------------

test('checkpointProgress: 空 checkedMap → 全部 done 為 0，total 正確', () => {
  const entry12 = DEV_MILESTONES.find((m) => m.months === 12);
  const expectedTotal = Object.values(entry12.domains).reduce((sum, arr) => sum + arr.length, 0);

  const progress = checkpointProgress({}, 12);
  assert.equal(progress.total, expectedTotal);
  assert.equal(progress.done, 0);

  for (const domain of Object.keys(entry12.domains)) {
    assert.equal(progress.byDomain[domain].total, entry12.domains[domain].length);
    assert.equal(progress.byDomain[domain].done, 0);
  }
});

test('checkpointProgress: 勾選部分項目 → done 與 byDomain 正確累計', () => {
  const checkedMap = {
    '12_social_emotional_0': true,
    '12_language_0': true,
    '12_language_1': true,
  };
  const progress = checkpointProgress(checkedMap, 12);

  assert.equal(progress.byDomain.social_emotional.done, 1);
  assert.equal(progress.byDomain.language.done, 2);
  assert.equal(progress.byDomain.cognitive.done, 0);
  assert.equal(progress.byDomain.movement.done, 0);
  assert.equal(progress.done, 3);
});

test('checkpointProgress: 全部勾選 → done 等於 total', () => {
  const entry2 = DEV_MILESTONES.find((m) => m.months === 2);
  const checkedMap = {};
  for (const domain of Object.keys(entry2.domains)) {
    entry2.domains[domain].forEach((_, index) => {
      checkedMap[`2_${domain}_${index}`] = true;
    });
  }

  const progress = checkpointProgress(checkedMap, 2);
  assert.equal(progress.done, progress.total);
});

test('checkpointProgress: 不存在的月齡檢查點 → total/done 皆為 0', () => {
  const progress = checkpointProgress({}, 999);
  assert.equal(progress.total, 0);
  assert.equal(progress.done, 0);
  assert.deepEqual(progress.byDomain, {});
});

test('checkpointProgress: checkedMap 為 null → 視為空，不丟例外', () => {
  assert.doesNotThrow(() => {
    const progress = checkpointProgress(null, 12);
    assert.equal(progress.done, 0);
  });
});
