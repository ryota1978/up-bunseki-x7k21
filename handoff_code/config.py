"""
経費分類システム 設定ファイル
株式会社ユナイテッドファーマシー

このファイルには全ての定数・マッピングを集約
"""

# ============ ディレクトリ ============
PROJECT_DIR = "/mnt/project"
WORK_DIR = "/home/claude/work"
OUTPUT_DIR = "/mnt/user-data/outputs"
OUTPUT_XLSX = f"{OUTPUT_DIR}/経費分類ベース_2025年8月-2026年5月_完全版.xlsx"

# ============ 対象期間 ============
TARGET_MONTHS = [
    "2025/08", "2025/09", "2025/10", "2025/11", "2025/12",
    "2026/01", "2026/02", "2026/03", "2026/04", "2026/05"
]

# ============ 会社情報 ============
COMPANY = {
    "name": "株式会社ユナイテッドファーマシー",
    "president": "加藤 亮太",
    "address": "三重県伊勢市中村町325-401",
    "postal": "516-0028",
    "tax_id": "T5010001192707",
}

# ============ 店舗一覧 ============
STORES = [
    {
        "name": "ひかり調剤薬局",
        "location": "志摩市阿児町鵜方",
        "role": "メイン店（最大売上）",
        "pharmacist": "加藤 亮太",
        "paypay_mid": "124392556543901696",
        "insurance_id": "26A0076635",
        "insurance_class": "F",
        "insurance_amount": 31500,
        "electric_pattern": "月初(6-13日)検針",
    },
    {
        "name": "ひかり薬局",
        "location": "松阪市射和町",
        "role": "PayPay売上首位",
        "pharmacist": "水田 健",
        "paypay_mid": "124367873366827008",
        "insurance_id": "26A0076637",
        "insurance_class": "E",
        "insurance_amount": 18000,
        "electric_pattern": "早中旬(9-13日)検針",
    },
    {
        "name": "ひかりファーマシー",
        "location": "伊勢市神久",
        "role": "在宅医療対応型",
        "pharmacist": "福田 久幸",
        "paypay_mid": "124394076962349056",
        "insurance_id": "26A0076636",
        "insurance_class": "E",
        "insurance_amount": 18000,
        "electric_pattern": "中旬(13-16日)検針",
    },
    {
        "name": "ひかりハート薬局",
        "location": "伊勢市岡本",
        "role": "2026年3月解約工事完了",
        "pharmacist": "田原 佳樹",
        "paypay_mid": None,  # PayPay未契約
        "insurance_id": "26A0076638",
        "insurance_class": "E",
        "insurance_amount": 18000,
        "electric_pattern": "下旬(24-27日)検針",
    },
]

# PayPay MID → 店舗名 マッピング
PAYPAY_MID_TO_STORE = {s["paypay_mid"]: s["name"] for s in STORES if s["paypay_mid"]}

# ============ オリコCSV → 支払月マッピング ============
# ファイルパスと対応する支払月
ORICO_CSV_FILES = [
    ("/mnt/project/FY2026/24_オリコクレジットCSV.csv", "2025/08"),
    ("/mnt/project/FY2026/128_オリコクレジットCSV.csv", "2025/10"),
    ("/mnt/project/FY2026/184_20251127_オリコクレジットCSV.csv", "2025/11"),
    ("/mnt/project/FY2026/270_20251229_オリコクレジットCSV.csv", "2025/12"),
    ("/mnt/project/FY2026/336_20260127_オリコクレジットCSV.csv", "2026/01"),
    ("/mnt/project/FY2026/408_20260227_オリコクレジットCSV.csv", "2026/02"),
    ("/mnt/project/FY2026/472_20260327_オリコクレジットCSV.csv", "2026/03"),
    ("/mnt/project/FY2026/549_20260427_オリコクレジットCSV.csv", "2026/04"),
    ("/mnt/project/FY2026/618_オリコクレジットCSV.csv", "2026/05"),
    # 2025/09 は未提供、追加時ここに記載
]

# ============ 家族カード利用ルール ============
FAMILY_CARD_RULES = {
    # キーワード → 事業/私的判定
    "ガソリン系（コスモ・アポロ等）": "事業",
    "ETC系": "事業",
    "食事系（レストラン等）": "私的",
    "自宅水道光熱": "私的",
}

# ============ Excelスタイル定数 ============
STYLE = {
    "primary_color": "305496",      # 濃紺（ヘッダー）
    "accent_color": "C00000",       # 赤（強調）
    "warning_color": "FFF2CC",      # 黄（注意）
    "success_color": "00B050",      # 緑（削減額）
    "sub_header": "D9E1F2",         # 薄青（サブヘッダー）
    "urihi_fill": "FCE4D6",         # 売上のセル
    "font_normal": "メイリオ",
    "font_code": "Consolas",
}

# ============ Excel シート順 ============
SHEET_ORDER = [
    "ダッシュボード",
    "支払先ダッシュボード",
    "月別科目集計",
    "売上分析",
    "お客様決済_店舗別売上",
    "クレジット分析",
    "通信費_内訳分析",
    "NTT料金_削減提案",
    "保険料_内訳分析",
    "旅費交通費_内訳分析",
    "接待交際費_内訳分析",
    "電気代_店舗別分析",
    "電気代_削減シミュレーション",
    "消耗品_内訳分析",
    "Amazon購入分析",
    "まとめ買い候補",
    "不足薬郵送_在庫指標",
    "仕訳明細",
    "クレジット明細_オリコ",
    "凡例_運用ガイド",
]
