# 寶寶詞彙追蹤（CDI Vocab Tracker）

給家長用的嬰幼兒詞彙發展追蹤 PWA：以 CDI（MacArthur-Bates Communicative Development Inventories）的公開類別架構為基礎，記錄孩子「聽得懂／會說」的詞彙與溝通手勢，視覺化成長曲線、偵測詞彙爆發期，並支援研究級資料匯出。

## 設計原則與版權聲明

- 本工具採「**自由記錄**」模式：記錄孩子實際出現的詞彙，以 CDI 公開的**類別架構**（人物、食物、動作詞……）分類統計。
- 台灣正式量表「華語嬰幼兒溝通發展量表（MCDI-T）」屬有版權之研究工具，**本專案不內建任何正式題本詞項**。
- 若使用者持有正式量表授權，可經「題本載入」功能以本機檔案（JSON/CSV）載入自備題本，資料只存在本機／自己的 Firebase，不隨程式散布。
- 本工具為家庭記錄與教育用途，非診斷工具；對語言發展有疑慮請諮詢語言治療師或兒童發展聯合評估中心。

## 功能（v1）

- **三軌記錄**：每個詞分「聽得懂」與「會說」兩軌（理解通常領先表達數月），另記溝通手勢（指物、揮手、點頭……）
- **成長曲線**：累積詞彙數時間曲線、週增量；50／100／200 詞里程碑；詞彙爆發期偵測
- **類別分佈**：名詞／動詞／社交詞比例與雷達圖
- **研究級匯出**：含時間戳、情境、記錄者的 CSV（UTF-8 BOM）
- **同步**：預設本機儲存（localStorage）；貼上 Firebase 設定後啟用雲端同步，夫妻雙裝置共同記錄

## 啟動

```powershell
cd C:\Users\USER\Projects\065.cdi-vocab-tracker
python -m http.server 8770
# 瀏覽器開 http://localhost:8770
```

Firebase 雲端同步設定：見 `docs\FIREBASE-SETUP.md`。

## 理論依據

- Fenson, L., Dale, P. S., Reznick, J. S., Bates, E., Thal, D. J., & Pethick, S. J. (1994). Variability in early communicative development. *Monographs of the Society for Research in Child Development, 59*(5), 1–173.
- Goldfield, B. A., & Reznick, J. S. (1990). Early lexical acquisition: Rate, content, and the vocabulary spurt. *Journal of Child Language, 17*(1), 171–183.
- 劉惠美、曹峰銘（2010）。華語嬰幼兒溝通發展量表之編製。（正式量表請洽出版單位，本專案不含題本內容）
