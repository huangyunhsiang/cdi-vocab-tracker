/**
 * store.js — 資料層唯一入口
 *
 * 兩種後端對上層 API 完全一致：
 *   - 預設：localStorage（key 前綴 cdi_）
 *   - 若全域存在 FIREBASE_CONFIG（由 js/firebase-config.js 提供，該檔已 gitignore）
 *     **且**使用者已透過 Google 登入 → 改走 Firestore（compat SDK CDN），啟用離線持久化快取。
 *     只有 config 存在、尚未登入時，仍走 localStorage（見 selectBackend）。
 *
 * 集合結構（Firestore）：
 *   families/{familyId}/words/{wordId}
 *   families/{familyId}/gestures/{gestureId}
 *   families/{familyId}/milestones/{milestoneKey}
 *   families/{familyId}/growth/{growthId}
 *   families/{familyId}/meta/wordlist　（{ entries: [...] }）
 *   families/{familyId}/meta/profile　（{ babyBirthDate: 'YYYY-MM-DD', babySex: 'boys'|'girls' }）
 *   families/{familyId}/meta/devchecks　（{ checks: { "months_domain_index": true, ... } }）
 *
 * 對外 API：
 *   init(): Promise<void>
 *   backendName(): 'localStorage' | 'firestore'
 *   listWords(): Promise<WordRecord[]>
 *   upsertWord(word): Promise<WordRecord>
 *   deleteWord(id): Promise<void>
 *   listGestures(): Promise<GestureRecord[]>
 *   upsertGesture(gesture): Promise<GestureRecord>
 *   deleteGesture(id): Promise<void>
 *   listMilestones(): Promise<MilestoneRecord[]>
 *   upsertMilestone(record): Promise<MilestoneRecord>
 *   deleteMilestone(key): Promise<void>
 *   listGrowth(): Promise<GrowthRecord[]>
 *   upsertGrowth(record): Promise<GrowthRecord>
 *   deleteGrowth(id): Promise<void>
 *   getBabyBirthDate(): Promise<string|null>
 *   setBabyBirthDate(dateStr): Promise<void>
 *   getBabySex(): Promise<string>　— 'boys' | 'girls'，預設 'boys'
 *   setBabySex(sex): Promise<void>
 *   exportAll(): Promise<{words, gestures, milestones, growth, babyBirthDate, babySex}>
 *   importAll(data): Promise<void>
 *   clearAll(): Promise<void>
 *   listWordlistEntries(): Promise<WordlistEntry[]>
 *   saveWordlistEntries(entries): Promise<void>
 *   getDevChecks(): Promise<Object<string, boolean>>
 *   setDevCheck(key, bool): Promise<void>
 *
 * Auth API（僅在有 FIREBASE_CONFIG 時有意義；無 config 時皆為 no-op／回傳 null）：
 *   hasFirebaseConfig(): boolean
 *   waitForFirstAuthState(): Promise<firebase.User|null>　— App 啟動時等一次，避免閃爍換源
 *   getCurrentUser(): firebase.User|null
 *   onAuthChange(cb): () => void　— 訂閱後續登入狀態變化，回傳取消訂閱函式
 *   signInWithGoogle(): Promise<void>　— 依裝置類型走 popup 或 redirect
 *   signOutUser(): Promise<void>
 *   reinitBackend(): Promise<void>　— 登入/登出後重新選擇並初始化後端
 */

const LS_PREFIX = 'cdi_';
const LS_WORDS_KEY = LS_PREFIX + 'words';
const LS_GESTURES_KEY = LS_PREFIX + 'gestures';
const LS_WORDLIST_KEY = LS_PREFIX + 'wordlist';
const LS_MILESTONES_KEY = LS_PREFIX + 'milestones';
const LS_GROWTH_KEY = LS_PREFIX + 'growth';
const LS_DEVCHECKS_KEY = LS_PREFIX + 'devchecks';
const LS_BABY_BIRTH_KEY = LS_PREFIX + 'baby_birth';
const LS_BABY_SEX_KEY = LS_PREFIX + 'baby_sex';
const DEFAULT_BABY_SEX = 'boys';
const FAMILY_ID = 'default';

function genId() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

// ---------------------------------------------------------------------------
// localStorage backend
// ---------------------------------------------------------------------------

const localBackend = {
  name: 'localStorage',

  async init() {
    // no-op
  },

  _read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('讀取 localStorage 失敗', key, e);
      return [];
    }
  },

  _write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  async listWords() {
    return this._read(LS_WORDS_KEY);
  },

  async upsertWord(word) {
    const words = this._read(LS_WORDS_KEY);
    const idx = words.findIndex((w) => w.id === word.id);
    const record = { ...word, id: word.id || genId() };
    if (idx >= 0) {
      words[idx] = record;
    } else {
      words.push(record);
    }
    this._write(LS_WORDS_KEY, words);
    return record;
  },

  async deleteWord(id) {
    const words = this._read(LS_WORDS_KEY).filter((w) => w.id !== id);
    this._write(LS_WORDS_KEY, words);
  },

  async listGestures() {
    return this._read(LS_GESTURES_KEY);
  },

  async upsertGesture(gesture) {
    const gestures = this._read(LS_GESTURES_KEY);
    const idx = gestures.findIndex((g) => g.id === gesture.id);
    const record = { ...gesture, id: gesture.id || genId() };
    if (idx >= 0) {
      gestures[idx] = record;
    } else {
      gestures.push(record);
    }
    this._write(LS_GESTURES_KEY, gestures);
    return record;
  },

  async deleteGesture(id) {
    const gestures = this._read(LS_GESTURES_KEY).filter((g) => g.id !== id);
    this._write(LS_GESTURES_KEY, gestures);
  },

  async listMilestones() {
    return this._read(LS_MILESTONES_KEY);
  },

  async upsertMilestone(record) {
    const milestones = this._read(LS_MILESTONES_KEY);
    const idx = milestones.findIndex((m) => m.key === record.key);
    const saved = { ...record };
    if (idx >= 0) {
      milestones[idx] = saved;
    } else {
      milestones.push(saved);
    }
    this._write(LS_MILESTONES_KEY, milestones);
    return saved;
  },

  async deleteMilestone(key) {
    const milestones = this._read(LS_MILESTONES_KEY).filter((m) => m.key !== key);
    this._write(LS_MILESTONES_KEY, milestones);
  },

  async listGrowth() {
    return this._read(LS_GROWTH_KEY);
  },

  async upsertGrowth(record) {
    const growth = this._read(LS_GROWTH_KEY);
    const idx = growth.findIndex((g) => g.id === record.id);
    const saved = { ...record, id: record.id || genId() };
    if (idx >= 0) {
      growth[idx] = saved;
    } else {
      growth.push(saved);
    }
    this._write(LS_GROWTH_KEY, growth);
    return saved;
  },

  async deleteGrowth(id) {
    const growth = this._read(LS_GROWTH_KEY).filter((g) => g.id !== id);
    this._write(LS_GROWTH_KEY, growth);
  },

  _readMap(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('讀取 localStorage（map）失敗', key, e);
      return {};
    }
  },

  async getDevChecks() {
    return this._readMap(LS_DEVCHECKS_KEY);
  },

  async setDevCheck(key, bool) {
    const checks = this._readMap(LS_DEVCHECKS_KEY);
    if (bool) {
      checks[key] = true;
    } else {
      delete checks[key];
    }
    this._write(LS_DEVCHECKS_KEY, checks);
  },

  async getBabyBirthDate() {
    return localStorage.getItem(LS_BABY_BIRTH_KEY) || null;
  },

  async setBabyBirthDate(dateStr) {
    localStorage.setItem(LS_BABY_BIRTH_KEY, dateStr);
  },

  async getBabySex() {
    return localStorage.getItem(LS_BABY_SEX_KEY) || DEFAULT_BABY_SEX;
  },

  async setBabySex(sex) {
    localStorage.setItem(LS_BABY_SEX_KEY, sex);
  },

  async exportAll() {
    return {
      words: this._read(LS_WORDS_KEY),
      gestures: this._read(LS_GESTURES_KEY),
      milestones: this._read(LS_MILESTONES_KEY),
      growth: this._read(LS_GROWTH_KEY),
      devchecks: this._readMap(LS_DEVCHECKS_KEY),
      babyBirthDate: localStorage.getItem(LS_BABY_BIRTH_KEY) || null,
      babySex: localStorage.getItem(LS_BABY_SEX_KEY) || DEFAULT_BABY_SEX,
    };
  },

  async importAll(data) {
    if (Array.isArray(data.words)) this._write(LS_WORDS_KEY, data.words);
    if (Array.isArray(data.gestures)) this._write(LS_GESTURES_KEY, data.gestures);
    if (Array.isArray(data.milestones)) this._write(LS_MILESTONES_KEY, data.milestones);
    if (Array.isArray(data.growth)) this._write(LS_GROWTH_KEY, data.growth);
    if (data.devchecks && typeof data.devchecks === 'object' && !Array.isArray(data.devchecks)) {
      this._write(LS_DEVCHECKS_KEY, data.devchecks);
    }
    if (typeof data.babyBirthDate === 'string' && data.babyBirthDate) {
      localStorage.setItem(LS_BABY_BIRTH_KEY, data.babyBirthDate);
    }
    if (typeof data.babySex === 'string' && data.babySex) {
      localStorage.setItem(LS_BABY_SEX_KEY, data.babySex);
    }
  },

  async clearAll() {
    localStorage.removeItem(LS_WORDS_KEY);
    localStorage.removeItem(LS_GESTURES_KEY);
    localStorage.removeItem(LS_WORDLIST_KEY);
    localStorage.removeItem(LS_MILESTONES_KEY);
    localStorage.removeItem(LS_GROWTH_KEY);
    localStorage.removeItem(LS_DEVCHECKS_KEY);
    localStorage.removeItem(LS_BABY_BIRTH_KEY);
    localStorage.removeItem(LS_BABY_SEX_KEY);
  },

  async listWordlistEntries() {
    return this._read(LS_WORDLIST_KEY);
  },

  async saveWordlistEntries(entries) {
    this._write(LS_WORDLIST_KEY, entries);
  },
};

// ---------------------------------------------------------------------------
// Firestore backend（僅在全域 FIREBASE_CONFIG 存在時啟用）
// ---------------------------------------------------------------------------

function createFirestoreBackend(firebaseConfig) {
  /** @type {firebase.firestore.Firestore | null} */
  let db = null;

  function familyDoc(sub) {
    return db.collection('families').doc(FAMILY_ID).collection(sub);
  }

  return {
    name: 'firestore',

    async init() {
      if (typeof firebase === 'undefined') {
        throw new Error('Firebase compat SDK 尚未載入，請確認 index.html 有引入 CDN script');
      }
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      try {
        await db.enablePersistence({ synchronizeTabs: true });
      } catch (e) {
        console.warn('Firestore 離線持久化未啟用（可能多分頁或瀏覽器不支援）', e);
      }

      // 匿名／Google 登入視設定而定，這裡假設呼叫端已完成登入流程。
    },

    async listWords() {
      const snap = await familyDoc('words').get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },

    async upsertWord(word) {
      const id = word.id || genId();
      const record = { ...word, id };
      await familyDoc('words').doc(id).set(record);
      return record;
    },

    async deleteWord(id) {
      await familyDoc('words').doc(id).delete();
    },

    async listGestures() {
      const snap = await familyDoc('gestures').get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },

    async upsertGesture(gesture) {
      const id = gesture.id || genId();
      const record = { ...gesture, id };
      await familyDoc('gestures').doc(id).set(record);
      return record;
    },

    async deleteGesture(id) {
      await familyDoc('gestures').doc(id).delete();
    },

    async listMilestones() {
      const snap = await familyDoc('milestones').get();
      return snap.docs.map((d) => d.data());
    },

    async upsertMilestone(record) {
      const saved = { ...record };
      await familyDoc('milestones').doc(record.key).set(saved);
      return saved;
    },

    async deleteMilestone(key) {
      await familyDoc('milestones').doc(key).delete();
    },

    async listGrowth() {
      const snap = await familyDoc('growth').get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },

    async upsertGrowth(record) {
      const id = record.id || genId();
      const saved = { ...record, id };
      await familyDoc('growth').doc(id).set(saved);
      return saved;
    },

    async deleteGrowth(id) {
      await familyDoc('growth').doc(id).delete();
    },

    async getBabyBirthDate() {
      const doc = await db.collection('families').doc(FAMILY_ID).collection('meta').doc('profile').get();
      return doc.exists ? doc.data().babyBirthDate || null : null;
    },

    async setBabyBirthDate(dateStr) {
      await db
        .collection('families')
        .doc(FAMILY_ID)
        .collection('meta')
        .doc('profile')
        .set({ babyBirthDate: dateStr }, { merge: true });
    },

    async getBabySex() {
      const doc = await db.collection('families').doc(FAMILY_ID).collection('meta').doc('profile').get();
      return doc.exists ? doc.data().babySex || 'boys' : 'boys';
    },

    async setBabySex(sex) {
      await db
        .collection('families')
        .doc(FAMILY_ID)
        .collection('meta')
        .doc('profile')
        .set({ babySex: sex }, { merge: true });
    },

    async exportAll() {
      const [words, gestures, milestones, growth, devchecks, babyBirthDate, babySex] = await Promise.all([
        this.listWords(),
        this.listGestures(),
        this.listMilestones(),
        this.listGrowth(),
        this.getDevChecks(),
        this.getBabyBirthDate(),
        this.getBabySex(),
      ]);
      return { words, gestures, milestones, growth, devchecks, babyBirthDate, babySex };
    },

    async importAll(data) {
      const batch = db.batch();
      for (const w of data.words || []) {
        const id = w.id || genId();
        batch.set(familyDoc('words').doc(id), { ...w, id });
      }
      for (const g of data.gestures || []) {
        const id = g.id || genId();
        batch.set(familyDoc('gestures').doc(id), { ...g, id });
      }
      for (const m of data.milestones || []) {
        batch.set(familyDoc('milestones').doc(m.key), { ...m });
      }
      for (const gr of data.growth || []) {
        const id = gr.id || genId();
        batch.set(familyDoc('growth').doc(id), { ...gr, id });
      }
      if (data.devchecks && typeof data.devchecks === 'object' && !Array.isArray(data.devchecks)) {
        batch.set(
          db.collection('families').doc(FAMILY_ID).collection('meta').doc('devchecks'),
          { checks: data.devchecks },
          { merge: true }
        );
      }
      if (typeof data.babyBirthDate === 'string' && data.babyBirthDate) {
        batch.set(
          db.collection('families').doc(FAMILY_ID).collection('meta').doc('profile'),
          { babyBirthDate: data.babyBirthDate },
          { merge: true }
        );
      }
      if (typeof data.babySex === 'string' && data.babySex) {
        batch.set(
          db.collection('families').doc(FAMILY_ID).collection('meta').doc('profile'),
          { babySex: data.babySex },
          { merge: true }
        );
      }
      await batch.commit();
    },

    async clearAll() {
      const [words, gestures, milestones, growth] = await Promise.all([
        this.listWords(),
        this.listGestures(),
        this.listMilestones(),
        this.listGrowth(),
      ]);
      const batch = db.batch();
      for (const w of words) batch.delete(familyDoc('words').doc(w.id));
      for (const g of gestures) batch.delete(familyDoc('gestures').doc(g.id));
      for (const m of milestones) batch.delete(familyDoc('milestones').doc(m.key));
      for (const gr of growth) batch.delete(familyDoc('growth').doc(gr.id));
      batch.delete(db.collection('families').doc(FAMILY_ID).collection('meta').doc('profile'));
      batch.delete(db.collection('families').doc(FAMILY_ID).collection('meta').doc('devchecks'));
      await batch.commit();
    },

    async listWordlistEntries() {
      const doc = await db.collection('families').doc(FAMILY_ID).collection('meta').doc('wordlist').get();
      return doc.exists ? doc.data().entries || [] : [];
    },

    async saveWordlistEntries(entries) {
      await db
        .collection('families')
        .doc(FAMILY_ID)
        .collection('meta')
        .doc('wordlist')
        .set({ entries });
    },

    async getDevChecks() {
      const doc = await db.collection('families').doc(FAMILY_ID).collection('meta').doc('devchecks').get();
      return doc.exists ? doc.data().checks || {} : {};
    },

    async setDevCheck(key, bool) {
      const checks = await this.getDevChecks();
      if (bool) {
        checks[key] = true;
      } else {
        delete checks[key];
      }
      await db
        .collection('families')
        .doc(FAMILY_ID)
        .collection('meta')
        .doc('devchecks')
        .set({ checks });
    },
  };
}

// ---------------------------------------------------------------------------
// Auth（Google 登入；僅在 FIREBASE_CONFIG 存在時生效）
// ---------------------------------------------------------------------------

let authInited = false;
let firstAuthStatePromise = null;

function ensureAuthApp() {
  if (typeof firebase === 'undefined') {
    throw new Error('Firebase compat SDK 尚未載入，請確認 index.html 有引入 firebase-auth-compat CDN script');
  }
  if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(window.FIREBASE_CONFIG);
  }
  return firebase.auth();
}

export function hasFirebaseConfig() {
  return typeof window !== 'undefined' && !!window.FIREBASE_CONFIG;
}

export function getCurrentUser() {
  if (!hasFirebaseConfig() || typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
    return null;
  }
  return firebase.auth().currentUser;
}

// App 啟動時呼叫一次，等待 Firebase 回報「目前到底有沒有登入」，
// 避免畫面先以 localStorage 開，登入態確認後又跳成 Firestore 的閃爍。
export function waitForFirstAuthState() {
  if (!hasFirebaseConfig()) {
    return Promise.resolve(null);
  }
  if (firstAuthStatePromise) {
    return firstAuthStatePromise;
  }
  firstAuthStatePromise = new Promise((resolve) => {
    let auth;
    try {
      auth = ensureAuthApp();
    } catch (e) {
      console.warn('Firebase Auth 初始化失敗，改用本機模式', e);
      resolve(null);
      return;
    }
    const unsubscribe = auth.onAuthStateChanged((user) => {
      authInited = true;
      unsubscribe();
      resolve(user || null);
    });
  });
  return firstAuthStatePromise;
}

// 訂閱後續登入狀態變化（登入、登出、被踢出）；回傳取消訂閱函式。
export function onAuthChange(cb) {
  if (!hasFirebaseConfig()) {
    return () => {};
  }
  let auth;
  try {
    auth = ensureAuthApp();
  } catch (e) {
    console.warn('Firebase Auth 初始化失敗', e);
    return () => {};
  }
  return auth.onAuthStateChanged(cb);
}

export async function signInWithGoogle() {
  const auth = ensureAuthApp();
  const provider = new firebase.auth.GoogleAuthProvider();
  // 一律用 popup（含手機）：本 app 網域（github.io）與 authDomain（firebaseapp.com）
  // 不同，signInWithRedirect 會因手機瀏覽器第三方 storage 隔離（Safari ITP／Chrome
  // storage partitioning）而在跳轉回來後拿不到登入狀態。popup 完成後直接回傳結果，
  // 不依賴跨網域 storage，較可靠。若 popup 被瀏覽器攔截，錯誤碼會是 auth/popup-blocked。
  const result = await auth.signInWithPopup(provider);
  return result.user;
}

export async function signOutUser() {
  if (!hasFirebaseConfig() || typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
    return;
  }
  await firebase.auth().signOut();
}

// ---------------------------------------------------------------------------
// 後端選擇
// ---------------------------------------------------------------------------

let backend = null;

function selectBackend() {
  if (typeof window !== 'undefined' && window.FIREBASE_CONFIG && getCurrentUser()) {
    return createFirestoreBackend(window.FIREBASE_CONFIG);
  }
  return localBackend;
}

export async function init() {
  if (hasFirebaseConfig()) {
    await waitForFirstAuthState();
  }
  backend = selectBackend();
  await backend.init();
}

// 登入／登出後呼叫：重新選擇後端並初始化。回傳新後端名稱。
export async function reinitBackend() {
  backend = selectBackend();
  await backend.init();
  return backend.name;
}

export function backendName() {
  return backend ? backend.name : selectBackend().name;
}

function ensureInit() {
  if (!backend) {
    throw new Error('store 尚未初始化，請先呼叫 init()');
  }
}

export async function listWords() {
  ensureInit();
  return backend.listWords();
}

export async function upsertWord(word) {
  ensureInit();
  return backend.upsertWord(word);
}

export async function deleteWord(id) {
  ensureInit();
  return backend.deleteWord(id);
}

export async function listGestures() {
  ensureInit();
  return backend.listGestures();
}

export async function upsertGesture(gesture) {
  ensureInit();
  return backend.upsertGesture(gesture);
}

export async function deleteGesture(id) {
  ensureInit();
  return backend.deleteGesture(id);
}

export async function exportAll() {
  ensureInit();
  return backend.exportAll();
}

export async function importAll(data) {
  ensureInit();
  return backend.importAll(data);
}

export async function clearAll() {
  ensureInit();
  return backend.clearAll();
}

export async function listWordlistEntries() {
  ensureInit();
  return backend.listWordlistEntries();
}

export async function saveWordlistEntries(entries) {
  ensureInit();
  return backend.saveWordlistEntries(entries);
}

export async function listMilestones() {
  ensureInit();
  return backend.listMilestones();
}

export async function upsertMilestone(record) {
  ensureInit();
  return backend.upsertMilestone(record);
}

export async function deleteMilestone(key) {
  ensureInit();
  return backend.deleteMilestone(key);
}

export async function getBabyBirthDate() {
  ensureInit();
  return backend.getBabyBirthDate();
}

export async function setBabyBirthDate(dateStr) {
  ensureInit();
  return backend.setBabyBirthDate(dateStr);
}

export async function listGrowth() {
  ensureInit();
  return backend.listGrowth();
}

export async function upsertGrowth(record) {
  ensureInit();
  return backend.upsertGrowth(record);
}

export async function deleteGrowth(id) {
  ensureInit();
  return backend.deleteGrowth(id);
}

export async function getBabySex() {
  ensureInit();
  return backend.getBabySex();
}

export async function setBabySex(sex) {
  ensureInit();
  return backend.setBabySex(sex);
}

export async function getDevChecks() {
  ensureInit();
  return backend.getDevChecks();
}

export async function setDevCheck(key, bool) {
  ensureInit();
  return backend.setDevCheck(key, bool);
}
