import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cumulativeCurve,
  weeklyNewWords,
  detectBurst,
  categoryStats,
  toCSV,
} from '../js/analytics.js';
import { parseWordlist } from '../js/wordlist-loader.js';
import { CATEGORIES } from '../js/categories.js';

// ---------------------------------------------------------------------------
// cumulativeCurve
// ---------------------------------------------------------------------------

test('cumulativeCurve: 累積計數依日期排序正確', () => {
  const words = [
    { word: 'a', category: 'other', understandsDate: '2026-01-01', saysDate: null },
    { word: 'b', category: 'other', understandsDate: '2026-01-03', saysDate: '2026-01-05' },
    { word: 'c', category: 'other', understandsDate: '2026-01-01', saysDate: '2026-01-05' },
  ];

  const curve = cumulativeCurve(words, 'understands');
  assert.deepEqual(curve, [
    { date: '2026-01-01', count: 2 },
    { date: '2026-01-03', count: 3 },
  ]);

  const saysCurve = cumulativeCurve(words, 'says');
  assert.deepEqual(saysCurve, [{ date: '2026-01-05', count: 2 }]);
});

test('cumulativeCurve: 空陣列回傳空曲線', () => {
  assert.deepEqual(cumulativeCurve([], 'understands'), []);
});

// ---------------------------------------------------------------------------
// weeklyNewWords
// ---------------------------------------------------------------------------

test('weeklyNewWords: 依週彙總新增數', () => {
  const words = [
    { word: 'a', category: 'other', understandsDate: null, saysDate: '2026-01-05' }, // Monday
    { word: 'b', category: 'other', understandsDate: null, saysDate: '2026-01-06' }, // Tuesday, same week
    { word: 'c', category: 'other', understandsDate: null, saysDate: '2026-01-12' }, // next Monday
  ];

  const weekly = weeklyNewWords(words, 'says');
  assert.equal(weekly.length, 2);
  assert.equal(weekly[0].count, 2);
  assert.equal(weekly[1].count, 1);
  assert.ok(weekly[0].weekStart < weekly[1].weekStart);
});

// ---------------------------------------------------------------------------
// detectBurst — 三情境：未滿 50 詞 / 達標未爆發 / 爆發
// ---------------------------------------------------------------------------

test('detectBurst: 未滿 50 詞時回傳里程碑進度、不判定爆發', () => {
  const words = Array.from({ length: 30 }, (_, i) => ({
    word: `w${i}`,
    category: 'other',
    understandsDate: null,
    saysDate: '2026-01-01',
  }));

  const result = detectBurst(words);
  assert.equal(result.burst, false);
  assert.equal(result.totalSays, 30);
  assert.equal(result.milestone, null);
});

test('detectBurst: 達 50 詞但近期增量平緩，不判定爆發', () => {
  // 50 詞，平均分散在 100 天內（每 2 天一詞），近 7/14 天增量遠低於門檻
  const words = Array.from({ length: 50 }, (_, i) => {
    const day = i * 2 + 1;
    const date = new Date(Date.UTC(2026, 0, 1));
    date.setUTCDate(date.getUTCDate() + day);
    return {
      word: `w${i}`,
      category: 'other',
      understandsDate: null,
      saysDate: date.toISOString().slice(0, 10),
    };
  });

  const result = detectBurst(words);
  assert.equal(result.totalSays, 50);
  assert.equal(result.milestone, 50);
  assert.equal(result.burst, false);
});

test('detectBurst: 近 7 天新增 >=10 詞判定為爆發期', () => {
  const baseWords = Array.from({ length: 45 }, (_, i) => ({
    word: `base${i}`,
    category: 'other',
    understandsDate: null,
    saysDate: '2025-01-01',
  }));

  // 最近 7 天內新增 10 詞（含錨點當天），總數達 55 >= 50
  const burstWords = Array.from({ length: 10 }, (_, i) => ({
    word: `burst${i}`,
    category: 'other',
    understandsDate: null,
    saysDate: `2026-02-0${(i % 7) + 1}`,
  }));

  const words = [...baseWords, ...burstWords];
  const result = detectBurst(words);
  assert.equal(result.totalSays, 55);
  assert.equal(result.burst, true);
  assert.ok(result.recentCount7d >= 10);
});

test('detectBurst: 近 14 天新增 >=20 詞判定為爆發期（7 天門檻未達）', () => {
  const baseWords = Array.from({ length: 30 }, (_, i) => ({
    word: `base${i}`,
    category: 'other',
    understandsDate: null,
    saysDate: '2025-01-01',
  }));

  // 20 個詞分散在 anchor 前 8~14 天（不落在 7 天窗內），14 天窗內達 20
  const dates = [];
  for (let d = 8; d <= 14 && dates.length < 20; d++) {
    for (let k = 0; k < 3 && dates.length < 20; k++) {
      dates.push(d);
    }
  }
  const anchor = new Date(Date.UTC(2026, 2, 20));
  const burstWords = dates.map((d, i) => {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() - d);
    return {
      word: `mid${i}`,
      category: 'other',
      understandsDate: null,
      saysDate: date.toISOString().slice(0, 10),
    };
  });
  // 加入錨點本身，確保 anchorDate = 最新日期
  burstWords.push({ word: 'anchor', category: 'other', understandsDate: null, saysDate: anchor.toISOString().slice(0, 10) });

  const words = [...baseWords, ...burstWords];
  const result = detectBurst(words);
  assert.ok(result.totalSays >= 50);
  assert.ok(result.recentCount7d < 10, `recentCount7d 應 <10，實際 ${result.recentCount7d}`);
  assert.ok(result.recentCount14d >= 20, `recentCount14d 應 >=20，實際 ${result.recentCount14d}`);
  assert.equal(result.burst, true);
});

// ---------------------------------------------------------------------------
// categoryStats
// ---------------------------------------------------------------------------

test('categoryStats: 各類別計數與比例正確', () => {
  const words = [
    { word: 'a', category: 'people', understandsDate: '2026-01-01', saysDate: '2026-01-02' },
    { word: 'b', category: 'people', understandsDate: '2026-01-01', saysDate: null },
    { word: 'c', category: 'animal', understandsDate: '2026-01-01', saysDate: '2026-01-02' },
  ];

  const stats = categoryStats(words, CATEGORIES);
  const people = stats.find((s) => s.id === 'people');
  const animal = stats.find((s) => s.id === 'animal');

  assert.equal(people.understands, 2);
  assert.equal(people.says, 1);
  assert.equal(animal.understands, 1);
  assert.equal(animal.says, 1);

  // 總理解 3、總表達 2
  assert.equal(Math.round(people.understandsRatio * 100), Math.round((2 / 3) * 100));
  assert.equal(Math.round(people.saysRatio * 100), Math.round((1 / 2) * 100));
});

test('categoryStats: 無資料時比例為 0 不噴錯', () => {
  const stats = categoryStats([], CATEGORIES);
  for (const s of stats) {
    assert.equal(s.understands, 0);
    assert.equal(s.understandsRatio, 0);
  }
});

// ---------------------------------------------------------------------------
// toCSV
// ---------------------------------------------------------------------------

test('toCSV: 開頭為 UTF-8 BOM 且欄位正確', () => {
  const words = [
    {
      word: '媽媽',
      category: 'people',
      understandsDate: '2026-01-01',
      saysDate: '2026-01-05',
      note: '看到媽媽時說的',
      recorder: '爸爸',
    },
  ];
  const gestures = [{ gesture: '指物', date: '2026-01-02', note: '', recorder: '媽媽' }];

  const csv = toCSV(words, gestures);

  assert.equal(csv.charCodeAt(0), 0xfeff, 'CSV 第一個字元必須是 UTF-8 BOM');

  const withoutBom = csv.slice(1);
  const lines = withoutBom.split('\r\n');
  assert.equal(lines[0], '類型,詞彙,類別,軌道,日期,情境備註,記錄者');
  assert.equal(lines[1], '詞彙,媽媽,people,理解,2026-01-01,看到媽媽時說的,爸爸');
  assert.equal(lines[2], '詞彙,媽媽,people,表達,2026-01-05,看到媽媽時說的,爸爸');
  assert.equal(lines[3], '手勢,指物,,手勢,2026-01-02,,媽媽');
});

test('toCSV: 欄位含逗號時正確跳脫', () => {
  const words = [
    { word: 'test', category: 'other', understandsDate: '2026-01-01', saysDate: null, note: 'a,b', recorder: '爸爸' },
  ];
  const csv = toCSV(words, []);
  assert.ok(csv.includes('"a,b"'));
});

// ---------------------------------------------------------------------------
// parseWordlist
// ---------------------------------------------------------------------------

test('parseWordlist: 合法 JSON 解析正確', () => {
  const text = JSON.stringify([
    { word: '狗狗', category: 'animal' },
    { word: '車車', category: 'vehicle' },
  ]);
  const result = parseWordlist(text, 'json');
  assert.equal(result.ok, true);
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].word, '狗狗');
});

test('parseWordlist: 合法 CSV（含標頭）解析正確', () => {
  const text = 'word,category\n狗狗,animal\n車車,vehicle';
  const result = parseWordlist(text, 'csv');
  assert.equal(result.ok, true);
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[1].category, 'vehicle');
});

test('parseWordlist: 壞格式 JSON 回傳 ok:false 附錯誤訊息', () => {
  const result = parseWordlist('{not valid json', 'json');
  assert.equal(result.ok, false);
  assert.ok(result.error.length > 0);
});

test('parseWordlist: 壞格式 CSV（缺詞彙欄）回傳 ok:false', () => {
  const text = 'word,category\n,animal';
  const result = parseWordlist(text, 'csv');
  assert.equal(result.ok, false);
});

test('parseWordlist: 空字串輸入回傳 ok:false', () => {
  const result = parseWordlist('', 'json');
  assert.equal(result.ok, false);
});

test('parseWordlist: 不支援的類型回傳 ok:false', () => {
  const result = parseWordlist('word,category', 'xml');
  assert.equal(result.ok, false);
});
