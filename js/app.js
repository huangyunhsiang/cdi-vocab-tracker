/**
 * app.js — UI 邏輯（記錄／曲線／分析／題本／設定 五個分頁）
 *
 * 依賴：store.js（資料層）、analytics.js（純函式分析）、categories.js（類別架構）、
 * wordlist-loader.js（題本解析）、全域 Chart（CDN 載入的 Chart.js）。
 */

import * as store from './store.js';
import * as analytics from './analytics.js';
import { CATEGORIES, GESTURE_TYPES, getCategoryById } from './categories.js';
import { parseWordlist } from './wordlist-loader.js';

const todayStr = () => new Date().toISOString().slice(0, 10);

let wordsCache = [];
let gesturesCache = [];
let wordlistCache = [];

let chartCumulative = null;
let chartWeekly = null;
let chartCategory = null;

// ---------------------------------------------------------------------------
// 初始化
// ---------------------------------------------------------------------------

async function main() {
  await store.init();
  updateBackendDisplay();

  populateSelect(document.getElementById('input-category'), CATEGORIES, (c) => `${c.emoji} ${c.name}`, (c) => c.id);
  populateSelect(document.getElementById('input-gesture'), GESTURE_TYPES, (g) => `${g.emoji} ${g.name}`, (g) => g.id);

  document.getElementById('input-gesture-date').value = todayStr();

  setupTabNav();
  setupRecordForm();
  setupWordlistTab();
  setupSettingsTab();
  setupCloudSyncUI();

  await refreshAll();
}

function updateBackendDisplay() {
  const name = store.backendName();
  const label = name === 'firestore' ? '雲端同步（Firestore）' : '本機儲存（localStorage）';
  document.getElementById('sync-status').textContent = name === 'firestore' ? '雲端同步' : '本機儲存';
  const settingsLabel = document.getElementById('settings-backend-name');
  if (settingsLabel) settingsLabel.textContent = label;
}

function populateSelect(selectEl, items, labelFn, valueFn) {
  selectEl.innerHTML = '';
  for (const item of items) {
    const opt = document.createElement('option');
    opt.value = valueFn(item);
    opt.textContent = labelFn(item);
    selectEl.appendChild(opt);
  }
}

async function refreshAll() {
  wordsCache = await store.listWords();
  gesturesCache = await store.listGestures();
  wordlistCache = await store.listWordlistEntries();

  renderWordList();
  renderCurveTab();
  renderAnalysisTab();
  renderWordlistPreview();
}

// ---------------------------------------------------------------------------
// 分頁切換
// ---------------------------------------------------------------------------

function setupTabNav() {
  const buttons = document.querySelectorAll('nav.tab-bar button');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');

      if (btn.dataset.tab === 'tab-curve') renderCurveTab();
      if (btn.dataset.tab === 'tab-analysis') renderAnalysisTab();
    });
  });
}

// ---------------------------------------------------------------------------
// 記錄頁
// ---------------------------------------------------------------------------

function setupRecordForm() {
  const checkUnderstands = document.getElementById('check-understands');
  const dateUnderstands = document.getElementById('date-understands');
  const checkSays = document.getElementById('check-says');
  const dateSays = document.getElementById('date-says');

  checkUnderstands.addEventListener('change', () => {
    dateUnderstands.disabled = !checkUnderstands.checked;
    if (checkUnderstands.checked && !dateUnderstands.value) dateUnderstands.value = todayStr();
  });

  checkSays.addEventListener('change', () => {
    dateSays.disabled = !checkSays.checked;
    if (checkSays.checked && !dateSays.value) dateSays.value = todayStr();
  });

  document.getElementById('btn-add-word').addEventListener('click', onAddWord);
  document.getElementById('btn-add-gesture').addEventListener('click', onAddGesture);
  document.getElementById('input-search').addEventListener('input', renderWordList);
}

async function onAddWord() {
  const wordInput = document.getElementById('input-word');
  const word = wordInput.value.trim();
  if (!word) {
    showToast('請輸入詞彙');
    return;
  }

  const category = document.getElementById('input-category').value;
  const checkUnderstands = document.getElementById('check-understands');
  const checkSays = document.getElementById('check-says');
  const recorder = document.getElementById('input-recorder').value;
  const note = document.getElementById('input-note').value.trim();

  if (!checkUnderstands.checked && !checkSays.checked) {
    showToast('請至少勾選「聽得懂」或「會說」其中一項');
    return;
  }

  const record = {
    word,
    category,
    understandsDate: checkUnderstands.checked ? document.getElementById('date-understands').value || todayStr() : null,
    saysDate: checkSays.checked ? document.getElementById('date-says').value || todayStr() : null,
    recorder,
    note,
  };

  await store.upsertWord(record);
  showToast(`已新增「${word}」`);

  wordInput.value = '';
  document.getElementById('input-note').value = '';
  checkUnderstands.checked = false;
  checkSays.checked = false;
  document.getElementById('date-understands').disabled = true;
  document.getElementById('date-says').disabled = true;

  await refreshAll();
}

async function onAddGesture() {
  const gesture = document.getElementById('input-gesture').value;
  const date = document.getElementById('input-gesture-date').value || todayStr();
  const recorder = document.getElementById('input-gesture-recorder').value;

  await store.upsertGesture({ gesture, date, recorder });
  showToast('已新增手勢記錄');
  await refreshAll();
}

function renderWordList() {
  const listEl = document.getElementById('word-list');
  const searchTerm = (document.getElementById('input-search').value || '').trim().toLowerCase();

  let items = [...wordsCache].sort((a, b) => {
    const da = a.saysDate || a.understandsDate || '';
    const db = b.saysDate || b.understandsDate || '';
    return da < db ? 1 : -1;
  });

  if (searchTerm) {
    items = items.filter((w) => w.word.toLowerCase().includes(searchTerm));
  }

  listEl.innerHTML = '';

  if (items.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-hint';
    li.textContent = '尚無記錄，開始新增第一個詞彙吧！';
    listEl.appendChild(li);
    return;
  }

  for (const w of items) {
    const cat = getCategoryById(w.category);
    const li = document.createElement('li');

    const meta = document.createElement('div');
    meta.className = 'word-meta';

    const textDiv = document.createElement('div');
    textDiv.className = 'word-text';
    textDiv.textContent = `${cat.emoji} ${w.word}`;
    meta.appendChild(textDiv);

    const subDiv = document.createElement('div');
    subDiv.className = 'word-sub';
    const badges = [];
    if (w.understandsDate) badges.push(`理解 ${w.understandsDate}`);
    if (w.saysDate) badges.push(`表達 ${w.saysDate}`);
    subDiv.textContent = `${cat.name}｜${badges.join('　')}${w.recorder ? '｜' + w.recorder : ''}`;
    meta.appendChild(subDiv);

    li.appendChild(meta);

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';

    if (!w.saysDate) {
      const upgradeBtn = document.createElement('button');
      upgradeBtn.className = 'secondary';
      upgradeBtn.textContent = '升軌→會說';
      upgradeBtn.addEventListener('click', async () => {
        await store.upsertWord({ ...w, saysDate: todayStr() });
        showToast(`「${w.word}」已升軌為會說`);
        await refreshAll();
      });
      btnRow.appendChild(upgradeBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = '刪除';
    delBtn.addEventListener('click', async () => {
      await store.deleteWord(w.id);
      showToast(`已刪除「${w.word}」`);
      await refreshAll();
    });
    btnRow.appendChild(delBtn);

    li.appendChild(btnRow);
    listEl.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// 曲線頁
// ---------------------------------------------------------------------------

function renderCurveTab() {
  renderMilestoneBanner();
  renderCumulativeChart();
  renderWeeklyChart();
}

function renderMilestoneBanner() {
  const wrap = document.getElementById('milestone-banner-wrap');
  const burstInfo = analytics.detectBurst(wordsCache);

  wrap.innerHTML = '';
  const banner = document.createElement('div');
  banner.className = 'milestone-banner' + (burstInfo.burst ? ' burst' : '');

  if (burstInfo.burst) {
    banner.innerHTML = `<strong>🚀 偵測到詞彙爆發期！</strong><br>近 7 天新增 ${burstInfo.recentCount7d} 詞，近 14 天新增 ${burstInfo.recentCount14d} 詞`;
  } else if (burstInfo.milestone) {
    banner.innerHTML = `<strong>🎉 已達成 ${burstInfo.milestone} 詞里程碑！</strong><br>目前表達詞彙共 ${burstInfo.totalSays} 詞`;
  } else {
    banner.innerHTML = `<strong>目前表達詞彙：${burstInfo.totalSays} 詞</strong><br>距離 50 詞里程碑還有 ${Math.max(0, 50 - burstInfo.totalSays)} 詞`;
  }

  wrap.appendChild(banner);
}

function renderCumulativeChart() {
  const ctx = document.getElementById('chart-cumulative');
  if (!ctx || typeof Chart === 'undefined') return;

  const understandsCurve = analytics.cumulativeCurve(wordsCache, 'understands');
  const saysCurve = analytics.cumulativeCurve(wordsCache, 'says');

  const allDates = Array.from(new Set([...understandsCurve.map((d) => d.date), ...saysCurve.map((d) => d.date)])).sort();

  const understandsMap = new Map(understandsCurve.map((d) => [d.date, d.count]));
  const saysMap = new Map(saysCurve.map((d) => [d.date, d.count]));

  let lastU = 0;
  let lastS = 0;
  const understandsData = allDates.map((d) => {
    if (understandsMap.has(d)) lastU = understandsMap.get(d);
    return lastU;
  });
  const saysData = allDates.map((d) => {
    if (saysMap.has(d)) lastS = saysMap.get(d);
    return lastS;
  });

  if (chartCumulative) chartCumulative.destroy();
  chartCumulative = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allDates,
      datasets: [
        { label: '聽得懂（累積）', data: understandsData, borderColor: '#7c98a3', tension: 0.2 },
        { label: '會說（累積）', data: saysData, borderColor: '#c17a5a', tension: 0.2 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

function renderWeeklyChart() {
  const ctx = document.getElementById('chart-weekly');
  if (!ctx || typeof Chart === 'undefined') return;

  const weeklySays = analytics.weeklyNewWords(wordsCache, 'says');

  if (chartWeekly) chartWeekly.destroy();
  chartWeekly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: weeklySays.map((w) => w.weekStart),
      datasets: [{ label: '每週新增（會說）', data: weeklySays.map((w) => w.count), backgroundColor: '#c17a5a' }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

// ---------------------------------------------------------------------------
// 分析頁
// ---------------------------------------------------------------------------

function renderAnalysisTab() {
  renderCategoryChart();
  renderGapSummary();
}

function renderCategoryChart() {
  const ctx = document.getElementById('chart-category');
  if (!ctx || typeof Chart === 'undefined') return;

  const stats = analytics.categoryStats(wordsCache, CATEGORIES).filter((s) => s.understands > 0 || s.says > 0);

  if (chartCategory) chartCategory.destroy();
  chartCategory = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stats.map((s) => `${s.emoji}${s.name}`),
      datasets: [
        { label: '聽得懂', data: stats.map((s) => s.understands), backgroundColor: '#7c98a3' },
        { label: '會說', data: stats.map((s) => s.says), backgroundColor: '#c17a5a' },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

function renderGapSummary() {
  const wrap = document.getElementById('gap-summary');
  const totalUnderstands = wordsCache.filter((w) => w.understandsDate).length;
  const totalSays = wordsCache.filter((w) => w.saysDate).length;
  const gap = totalUnderstands - totalSays;

  wrap.innerHTML = '';
  const rows = [
    ['聽得懂總數', totalUnderstands],
    ['會說總數', totalSays],
    ['理解領先表達', gap],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `<span class="stat-label">${label}</span><span>${value}</span>`;
    wrap.appendChild(row);
  }
}

// ---------------------------------------------------------------------------
// 題本頁
// ---------------------------------------------------------------------------

function setupWordlistTab() {
  document.getElementById('input-wordlist-file').addEventListener('change', onWordlistFileChange);
}

async function onWordlistFileChange(evt) {
  const file = evt.target.files[0];
  const statusEl = document.getElementById('wordlist-status');
  if (!file) return;

  const type = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
  const text = await file.text();
  const result = parseWordlist(text, type);

  if (!result.ok) {
    statusEl.textContent = `載入失敗：${result.error}`;
    statusEl.style.color = 'var(--color-danger)';
    return;
  }

  await store.saveWordlistEntries(result.entries);
  wordlistCache = result.entries;
  statusEl.textContent = `已載入 ${result.entries.length} 筆題本詞彙（僅存本機／自家 Firebase）`;
  statusEl.style.color = 'var(--color-success)';
  renderWordlistPreview();
}

function renderWordlistPreview() {
  const listEl = document.getElementById('wordlist-preview');
  listEl.innerHTML = '';

  if (!wordlistCache || wordlistCache.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-hint';
    li.textContent = '尚未載入題本';
    listEl.appendChild(li);
    return;
  }

  for (const entry of wordlistCache.slice(0, 200)) {
    const cat = getCategoryById(entry.category);
    const li = document.createElement('li');
    li.innerHTML = `<div class="word-meta"><div class="word-text">${cat.emoji} ${escapeHtml(entry.word)}</div><div class="word-sub">${cat.name}</div></div>`;
    listEl.appendChild(li);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// 設定頁
// ---------------------------------------------------------------------------

function setupSettingsTab() {
  document.getElementById('btn-export-csv').addEventListener('click', onExportCsv);
  document.getElementById('btn-export-json').addEventListener('click', onExportJson);
  document.getElementById('input-import-json').addEventListener('change', onImportJson);
  document.getElementById('btn-clear-all').addEventListener('click', onClearAll);
}

// ---------------------------------------------------------------------------
// 雲端同步（Google 登入）
// ---------------------------------------------------------------------------

let deniedAutoSignedOut = false;

function setupCloudSyncUI() {
  const noConfigEl = document.getElementById('sync-no-config');
  const signedOutEl = document.getElementById('sync-signed-out');
  const signedInEl = document.getElementById('sync-signed-in');
  const deniedEl = document.getElementById('sync-denied');
  const emailEl = document.getElementById('sync-user-email');
  const signInBtn = document.getElementById('btn-google-signin');
  const signOutBtn = document.getElementById('btn-google-signout');

  function showOnly(el) {
    [noConfigEl, signedOutEl, signedInEl, deniedEl].forEach((e) => {
      e.style.display = e === el ? '' : 'none';
    });
  }

  function renderAuthState(user) {
    if (!store.hasFirebaseConfig()) {
      showOnly(noConfigEl);
      return;
    }
    if (user) {
      emailEl.textContent = user.email || '(未知帳號)';
      showOnly(signedInEl);
    } else {
      showOnly(signedOutEl);
    }
  }

  renderAuthState(store.getCurrentUser());

  if (!store.hasFirebaseConfig()) {
    return;
  }

  signInBtn.addEventListener('click', async () => {
    try {
      await store.signInWithGoogle();
    } catch (e) {
      console.error('Google 登入失敗', e);
      showToast('登入失敗，請稍後再試');
    }
  });

  signOutBtn.addEventListener('click', async () => {
    await store.signOutUser();
  });

  store.onAuthChange(async (user) => {
    if (!user) {
      renderAuthState(null);
      await store.reinitBackend();
      updateBackendDisplay();
      await refreshAll();
      return;
    }

    try {
      const localHadData = await checkLocalHasData();
      await store.reinitBackend();
      updateBackendDisplay();
      renderAuthState(user);

      if (localHadData) {
        await migrateLocalDataToCloudIfEmpty();
      }

      await refreshAll();
    } catch (e) {
      if (isPermissionDenied(e)) {
        showOnly(deniedEl);
        if (!deniedAutoSignedOut) {
          deniedAutoSignedOut = true;
          await store.signOutUser();
        }
        return;
      }
      console.error('登入後初始化雲端資料失敗', e);
      showToast('雲端資料載入失敗');
    }
  });
}

function isPermissionDenied(e) {
  return !!e && (e.code === 'permission-denied' || /permission-denied/i.test(e.message || ''));
}

// 登入前先讀一次「切換雲端後端之前」的本機資料快照，用來判斷是否需要遷移。
async function checkLocalHasData() {
  try {
    const raw = {
      words: JSON.parse(localStorage.getItem('cdi_words') || '[]'),
      gestures: JSON.parse(localStorage.getItem('cdi_gestures') || '[]'),
      wordlist: JSON.parse(localStorage.getItem('cdi_wordlist') || '[]'),
    };
    return raw.words.length > 0 || raw.gestures.length > 0 || raw.wordlist.length > 0;
  } catch (e) {
    return false;
  }
}

// 首次登入資料遷移：本機有資料、雲端對應集合為空 → 整批寫上雲端。
// 雲端已有資料則視為以雲端為準，本機資料保留不動，不合併、不覆蓋。
async function migrateLocalDataToCloudIfEmpty() {
  const localWords = JSON.parse(localStorage.getItem('cdi_words') || '[]');
  const localGestures = JSON.parse(localStorage.getItem('cdi_gestures') || '[]');
  const localWordlist = JSON.parse(localStorage.getItem('cdi_wordlist') || '[]');

  const cloudWords = await store.listWords();
  const cloudGestures = await store.listGestures();
  const cloudWordlist = await store.listWordlistEntries();

  const cloudIsEmpty = cloudWords.length === 0 && cloudGestures.length === 0 && cloudWordlist.length === 0;
  const localHasData = localWords.length > 0 || localGestures.length > 0 || localWordlist.length > 0;

  if (!cloudIsEmpty || !localHasData) {
    return;
  }

  if (localWords.length > 0 || localGestures.length > 0) {
    await store.importAll({ words: localWords, gestures: localGestures });
  }
  if (localWordlist.length > 0) {
    await store.saveWordlistEntries(localWordlist);
  }

  const migratedCount = localWords.length + localGestures.length + localWordlist.length;
  showToast(`已將本機 ${migratedCount} 筆記錄遷移至雲端`);
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function onExportCsv() {
  const csv = analytics.toCSV(wordsCache, gesturesCache);
  downloadFile(`cdi-vocab-${todayStr()}.csv`, csv, 'text/csv;charset=utf-8');
  showToast('CSV 已匯出');
}

async function onExportJson() {
  const data = await store.exportAll();
  downloadFile(`cdi-vocab-backup-${todayStr()}.json`, JSON.stringify(data, null, 2), 'application/json');
  showToast('JSON 備份已匯出');
}

async function onImportJson(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await store.importAll(data);
    showToast('匯入成功');
    await refreshAll();
  } catch (e) {
    showToast('匯入失敗：檔案格式錯誤');
    console.error(e);
  }
}

async function onClearAll() {
  const confirmed = confirm('確定要清除所有本機資料嗎？此動作無法復原。');
  if (!confirmed) return;
  const confirmedAgain = confirm('再次確認：這會刪除所有詞彙與手勢記錄。真的要清除嗎？');
  if (!confirmedAgain) return;

  await store.clearAll();
  showToast('資料已清除');
  await refreshAll();
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

let toastTimer = null;
function showToast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------------------
// Service worker 註冊
// ---------------------------------------------------------------------------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((e) => {
      console.warn('Service worker 註冊失敗', e);
    });
  });
}

main().catch((e) => {
  console.error('應用程式初始化失敗', e);
});
