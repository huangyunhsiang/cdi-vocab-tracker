/**
 * categories.js — CDI 風格公開類別架構
 *
 * 版權說明：以下僅為「類別／領域」層級的公開學術架構（不含任何正式量表題本詞項）。
 * 類別劃分參考 CDI（MacArthur-Bates Communicative Development Inventories）
 * 公開文獻中描述的語意領域分類方式：
 *   Fenson, L., Dale, P. S., Reznick, J. S., Bates, E., Thal, D. J., & Pethick, S. J. (1994).
 *   Variability in early communicative development. Monographs of the Society for
 *   Research in Child Development, 59(5), 1-173.
 *
 * 本檔案不得新增任何成串題本詞項清單，僅維護「類別＋中文名＋emoji」的架構層資訊。
 *
 * @typedef {Object} CdiCategory
 * @property {string} id - 類別代碼（英文，穩定不變，供資料儲存使用）
 * @property {string} name - 中文顯示名稱
 * @property {string} emoji - 代表 emoji
 */

/** @type {CdiCategory[]} */
export const CATEGORIES = [
  { id: 'sound_animal', name: '聲音效果與動物叫聲', emoji: '🔊' },
  { id: 'animal', name: '動物', emoji: '🐶' },
  { id: 'vehicle', name: '交通工具', emoji: '🚗' },
  { id: 'toy', name: '玩具', emoji: '🧸' },
  { id: 'food_drink', name: '食物飲料', emoji: '🍎' },
  { id: 'clothing', name: '衣物', emoji: '👕' },
  { id: 'body_part', name: '身體部位', emoji: '👣' },
  { id: 'household', name: '家用品', emoji: '🏠' },
  { id: 'people', name: '人物', emoji: '👪' },
  { id: 'routine_game', name: '遊戲與例行活動', emoji: '🎲' },
  { id: 'action', name: '動作詞', emoji: '🏃' },
  { id: 'descriptive', name: '描述詞', emoji: '🎨' },
  { id: 'time', name: '時間詞', emoji: '⏰' },
  { id: 'pronoun', name: '代名詞', emoji: '🙋' },
  { id: 'question', name: '疑問詞', emoji: '❓' },
  { id: 'location', name: '位置詞', emoji: '📍' },
  { id: 'social', name: '社交詞', emoji: '👋' },
  { id: 'other', name: '其他', emoji: '✨' },
];

/**
 * 依 id 找類別，找不到回傳 other 類別。
 * @param {string} id
 * @returns {CdiCategory}
 */
export function getCategoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

/**
 * 手勢類型（CDI 概念中的「早期手勢」公開架構層級，非題本詞項）。
 * @type {{id: string, name: string, emoji: string}[]}
 */
export const GESTURE_TYPES = [
  { id: 'point', name: '指物', emoji: '👉' },
  { id: 'wave', name: '揮手', emoji: '👋' },
  { id: 'nod', name: '點頭', emoji: '🙆' },
  { id: 'shake_head', name: '搖頭', emoji: '🙅' },
  { id: 'clap', name: '拍手', emoji: '👏' },
  { id: 'raise_arms', name: '舉手', emoji: '🙌' },
  { id: 'other', name: '其他', emoji: '✨' },
];

/** 內建示範詞（≤10 個，僅供 UI 示意，均為自明常見詞彙，非題本內容） */
export const DEMO_WORDS = [
  { word: '媽媽', category: 'people' },
  { word: '爸爸', category: 'people' },
  { word: '抱抱', category: 'social' },
  { word: 'ㄋㄟㄋㄟ', category: 'food_drink' },
  { word: '掰掰', category: 'social' },
  { word: '汪汪', category: 'sound_animal' },
];
