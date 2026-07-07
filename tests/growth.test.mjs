import test from 'node:test';
import assert from 'node:assert/strict';

import { lmsForAge, percentileFor, zscoreFor, whoCurve } from '../js/growth.js';
import { GROWTH_STANDARDS } from '../js/growth-standards.js';

// ---------------------------------------------------------------------------
// percentileFor — 已知值驗證
// ---------------------------------------------------------------------------

test('percentileFor: 男孩 0 月體重 3.3464（=M）約第 50 百分位', () => {
  const p = percentileFor(3.3464, 0, 'weight', 'boys');
  assert.ok(Math.abs(p - 50) < 1, `預期約 50，實際 ${p}`);
});

test('percentileFor: 男孩 0 月體重 2.459312 約第 2.3 百分位', () => {
  const p = percentileFor(2.459312, 0, 'weight', 'boys');
  assert.ok(Math.abs(p - 2.3) < 1.5, `預期約 2.3，實際 ${p}`);
});

test('percentileFor: 女孩身高在合理範圍內（12 月 M 值應約第 50 百分位）', () => {
  const girlLength12mM = GROWTH_STANDARDS.indicators.length.girls.find((r) => r.m === 12).M;
  const p = percentileFor(girlLength12mM, 12, 'length', 'girls');
  assert.ok(Math.abs(p - 50) < 1, `預期約 50，實際 ${p}`);
});

test('percentileFor: 顯示值夾在 0.1~99.9 之間（極端值不顯示 0 或 100）', () => {
  const pLow = percentileFor(0.5, 0, 'weight', 'boys');
  const pHigh = percentileFor(50, 0, 'weight', 'boys');
  assert.ok(pLow >= 0.1, `極低值應夾在 >=0.1，實際 ${pLow}`);
  assert.ok(pHigh <= 99.9, `極高值應夾在 <=99.9，實際 ${pHigh}`);
});

// ---------------------------------------------------------------------------
// lmsForAge — 月齡內插
// ---------------------------------------------------------------------------

test('lmsForAge: 整數月齡直接回傳對應列（不內插）', () => {
  const lms = lmsForAge('weight', 'boys', 2);
  const row = GROWTH_STANDARDS.indicators.weight.boys.find((r) => r.m === 2);
  assert.equal(lms.M, row.M);
  assert.equal(lms.L, row.L);
  assert.equal(lms.S, row.S);
  assert.equal(lms.clamped, false);
});

test('lmsForAge: 1.5 月齡 M 值為月 1 與月 2 的線性內插（誤差極小）', () => {
  const row1 = GROWTH_STANDARDS.indicators.weight.boys.find((r) => r.m === 1);
  const row2 = GROWTH_STANDARDS.indicators.weight.boys.find((r) => r.m === 2);
  const expectedM = (row1.M + row2.M) / 2;
  const lms = lmsForAge('weight', 'boys', 1.5);
  assert.ok(Math.abs(lms.M - expectedM) < 0.001, `預期約 ${expectedM}，實際 ${lms.M}`);
});

test('lmsForAge: 超出 0-24 月範圍時夾到邊界並標記 clamped', () => {
  const lmsOver = lmsForAge('weight', 'boys', 30);
  const rowMax = GROWTH_STANDARDS.indicators.weight.boys.find((r) => r.m === 24);
  assert.equal(lmsOver.M, rowMax.M);
  assert.equal(lmsOver.clamped, true);

  const lmsUnder = lmsForAge('weight', 'boys', -2);
  const rowMin = GROWTH_STANDARDS.indicators.weight.boys.find((r) => r.m === 0);
  assert.equal(lmsUnder.M, rowMin.M);
  assert.equal(lmsUnder.clamped, true);
});

// ---------------------------------------------------------------------------
// zscoreFor
// ---------------------------------------------------------------------------

test('zscoreFor: 測量值等於 M 時 z 分數約為 0', () => {
  const z = zscoreFor(3.3464, 0, 'weight', 'boys');
  assert.ok(Math.abs(z) < 0.001, `預期約 0，實際 ${z}`);
});

// ---------------------------------------------------------------------------
// whoCurve
// ---------------------------------------------------------------------------

test('whoCurve: 50th 百分位曲線應等於各月 M 值', () => {
  const curve = whoCurve('weight', 'boys', 50);
  assert.equal(curve.length, 25);
  for (const point of curve) {
    const row = GROWTH_STANDARDS.indicators.weight.boys.find((r) => r.m === point.m);
    assert.ok(Math.abs(point.value - row.M) < 0.01, `月 ${point.m} 預期約 ${row.M}，實際 ${point.value}`);
  }
});

test('whoCurve: 頭圍 girls 50th 曲線也等於 M 值', () => {
  const curve = whoCurve('head', 'girls', 50);
  const row12 = GROWTH_STANDARDS.indicators.head.girls.find((r) => r.m === 12);
  const point12 = curve.find((p) => p.m === 12);
  assert.ok(Math.abs(point12.value - row12.M) < 0.01);
});

test('whoCurve: 97th 百分位曲線值應高於 50th', () => {
  const curve50 = whoCurve('length', 'boys', 50);
  const curve97 = whoCurve('length', 'boys', 97);
  for (let i = 0; i < curve50.length; i++) {
    assert.ok(curve97[i].value > curve50[i].value, `月 ${curve50[i].m} 97th 應高於 50th`);
  }
});
