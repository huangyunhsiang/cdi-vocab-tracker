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
 *   exportAll(): Promise<{words, gestures}>
 *   importAll(data): Promise<void>
 *   clearAll(): Promise<void>
 *   listWordlistEntries(): Promise<WordlistEntry[]>
 *   saveWordlistEntries(entries): Promise<void>
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

  async exportAll() {
    return {
      words: this._read(LS_WORDS_KEY),
      gestures: this._read(LS_GESTURES_KEY),
    };
  },

  async importAll(data) {
    if (Array.isArray(data.words)) this._write(LS_WORDS_KEY, data.words);
    if (Array.isArray(data.gestures)) this._write(LS_GESTURES_KEY, data.gestures);
  },

  async clearAll() {
    localStorage.removeItem(LS_WORDS_KEY);
    localStorage.removeItem(LS_GESTURES_KEY);
    localStorage.removeItem(LS_WORDLIST_KEY);
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

    async exportAll() {
      const [words, gestures] = await Promise.all([this.listWords(), this.listGestures()]);
      return { words, gestures };
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
      await batch.commit();
    },

    async clearAll() {
      const [words, gestures] = await Promise.all([this.listWords(), this.listGestures()]);
      const batch = db.batch();
      for (const w of words) batch.delete(familyDoc('words').doc(w.id));
      for (const g of gestures) batch.delete(familyDoc('gestures').doc(g.id));
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
  };
}

// ---------------------------------------------------------------------------
// Auth（Google 登入；僅在 FIREBASE_CONFIG 存在時生效）
// ---------------------------------------------------------------------------

let authInited = false;
let firstAuthStatePromise = null;

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

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
  if (isMobileDevice()) {
    await auth.signInWithRedirect(provider);
  } else {
    await auth.signInWithPopup(provider);
  }
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
