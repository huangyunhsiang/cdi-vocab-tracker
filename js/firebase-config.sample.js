/**
 * firebase-config.sample.js — Firebase 設定樣板
 *
 * 使用方式：
 *   1. 複製本檔為同目錄下的 firebase-config.js（該檔名已列入 .gitignore，不會進版控）
 *   2. 依 docs/FIREBASE-SETUP.md 的步驟，到 Firebase Console 建立專案並開啟 Firestore
 *   3. 把下方 window.FIREBASE_CONFIG 換成你自己 Firebase 專案的設定值
 *   4. index.html 會偵測 firebase-config.js 是否存在；存在則自動改走 Firestore 同步，
 *      不存在則預設使用 localStorage（純本機儲存，不需要任何設定）
 *
 * 各欄位對應 Firebase Console → 專案設定 → 一般 → 你的應用程式 → SDK 設定與設定：
 *   apiKey / authDomain / projectId / storageBucket / messagingSenderId / appId
 */

window.FIREBASE_CONFIG = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
