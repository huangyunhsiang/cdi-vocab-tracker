# Firebase 雲端同步設定教學

本工具預設使用 localStorage（純本機儲存，無需任何設定）。若想讓爸爸、媽媽兩台裝置共同記錄，
可依以下步驟設定 Firebase（Firestore），設定後資料會同步到雲端。

## 步驟一：建立 Firebase 專案

1. 開啟 https://console.firebase.google.com/
2. 「新增專案」→ 輸入專案名稱（例如 `cdi-vocab-tracker`）→ 依畫面指示建立
3. 建立完成後進入專案主控台

## 步驟二：開啟 Firestore 資料庫

1. 左側選單「建構」→「Firestore Database」
2. 「建立資料庫」→ 選擇地區（建議 `asia-east1` 台灣鄰近區域）
3. 安全性規則先選「正式環境模式」（稍後會用 `firebase/firestore.rules` 覆蓋）

## 步驟三：開啟 Google 登入驗證

1. 左側選單「建構」→「Authentication」→「開始使用」
2. 「Sign-in method」分頁 → 啟用「Google」登入方式
3. 加入你與家人的 Google 帳號 email（用於身分驗證）

## 步驟四：取得設定值並貼入專案

1. 左側齒輪圖示「專案設定」→「一般」分頁
2. 捲到「你的應用程式」→ 點「網頁」圖示 `</>` 新增網頁應用程式
3. 複製產生的 `firebaseConfig` 物件內容
4. 複製 `js\firebase-config.sample.js` 為同目錄下的 `js\firebase-config.js`
5. 把複製到的設定值貼進 `window.FIREBASE_CONFIG`

## 步驟五：部署安全規則

1. Firebase Console →「Firestore Database」→「規則」分頁
2. 開啟本專案的 `firebase\firestore.rules`，複製全文貼上覆蓋
3. 把規則中的 `WIFE_EMAIL_HERE` 換成恬恬老師的實際 Google 帳號 email
4. 按「發布」

## 步驟六：重新整理頁面

重新整理 `index.html`，若設定正確，畫面右上角應顯示「雲端同步：已連線」。
若顯示錯誤，請檢查瀏覽器主控台（F12）訊息，常見原因：
- `firebase-config.js` 內設定值有誤字
- Firestore 規則尚未發布，或白名單 email 拼錯
- 尚未完成 Google 登入
