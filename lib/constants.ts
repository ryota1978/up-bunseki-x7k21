/* ── 配色（依頼書 第5章） ── */
export const C = {
  bg: "#F1F2ED",
  surface: "#FFFFFF",
  ink: "#232B2E",
  sub: "#6C7680",
  faint: "#98A0A6",
  line: "#E2E4DE",
  teal: "#2C6E63",
  tealSoft: "#E4EFEB",
  amber: "#C4783A",
  amberSoft: "#F4E7D9",
  stamp: "#B23A2E",
  stampSoft: "#F6E3E0",
  navy: "#3A5570",
  navySoft: "#E5EBF1",
  plum: "#74566E",
  plumSoft: "#EFE6EE",
} as const;

export const fontStack =
  "'Hiragino Kaku Gothic ProN','Hiragino Sans','Yu Gothic','Meiryo',system-ui,sans-serif";

/* 店舗ごとに済を入れる4店舗 */
export const STORES = ["鵜方", "射和", "神久", "岡本"] as const;

/* ログインで選べる名前（この2名のみ） */
export const LOGIN_NAMES = ["加藤", "助田"] as const;

export const NO_PERSON = "（担当者なし）";

export const FLAGS = {
  meeting: {
    key: "meeting" as const,
    label: "会議",
    full: "会議への転載リスト",
    color: C.navy,
    soft: C.navySoft,
  },
  jimu: {
    key: "jimu" as const,
    label: "医療事務",
    full: "医療事務ミーティング",
    color: C.plum,
    soft: C.plumSoft,
  },
};

/* 初期データ（第6章・29組） */
export const DEFAULT_MEMBERS: { store: string; person: string }[] = [
  { store: "【本部】", person: "助田" },
  { store: "ひかり調剤（鵜方）", person: "谷口（医療事務）" },
  { store: "ひかり調剤（鵜方）", person: "廣岡（医療事務）" },
  { store: "ひかり調剤（鵜方）", person: "谷村（医療事務）" },
  { store: "ひかり調剤（鵜方）", person: "真鍋（薬剤師）" },
  { store: "ひかり調剤（鵜方）", person: "山崎（医療事務）" },
  { store: "ひかり調剤（鵜方）", person: "浜口（パート医療事務）" },
  { store: "【全店舗】", person: "全体会議　通知" },
  { store: "【全体（医療事務ミーティング）】", person: "通知" },
  { store: "ひかりハート薬局（岡本）", person: "田原（薬剤師）" },
  { store: "ひかりハート薬局（岡本）", person: "三橋（医療事務）" },
  { store: "ひかりハート薬局（岡本）", person: "佐野（薬剤師）" },
  { store: "ひかりハート薬局（岡本）", person: "森田（パート医療事務）" },
  { store: "【本部・ひかり調剤（鵜方）】", person: "加藤（代表）" },
  { store: "ひかりファーマシー（神久）", person: "高橋（医療事務）" },
  { store: "ひかりファーマシー（神久）", person: "櫻井（薬剤師）" },
  { store: "ひかりファーマシー（神久）", person: "池田（医療事務）" },
  { store: "ひかりファーマシー（神久）", person: "江藤（パート医療事務）" },
  { store: "ひかりファーマシー（神久）", person: "新川（薬剤師）" },
  { store: "ひかり薬局（射和）", person: "水田（薬剤師）" },
  { store: "ひかり薬局（射和）", person: "浅利（薬剤師）" },
  { store: "ひかり薬局（射和）", person: "北村（医療事務）" },
  { store: "ひかり薬局（射和）", person: "山本（医療事務）" },
  { store: "ひかり薬局（射和）", person: "うらら（パート医療事務）" },
  { store: "ひかり薬局（射和）", person: "若山（パート医療事務）" },
  { store: "【ひかり薬局（射和）】", person: "" },
  { store: "【ひかりハート薬局（岡本）】", person: "" },
  { store: "【ひかり調剤（鵜方）】", person: "" },
  { store: "【ひかりファーマシー（神久）】", person: "" },
];

export const TASK_SORTS: { id: "due" | "store" | "person" | "new"; label: string }[] = [
  { id: "due", label: "期日順" },
  { id: "store", label: "店舗別" },
  { id: "person", label: "人別" },
  { id: "new", label: "新しい順" },
];

export const MEMBER_SORTS: { id: "added" | "store" | "person" | "count"; label: string }[] = [
  { id: "added", label: "登録順" },
  { id: "store", label: "店舗名順" },
  { id: "person", label: "担当者順" },
  { id: "count", label: "案件の多い順" },
];

export const ME_KEY = "up-bunseki-me";
