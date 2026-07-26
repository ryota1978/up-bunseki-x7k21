"""
金額補正マップ

ファイル名から自動抽出した金額が誤っているケースを補正する。
特定ファイル名 → 正しい金額 のマッピング。
"""

# ============ ChatGPT 実額補正 ============
# ChatGPT Plus $22/月 → 実額¥312〜¥314/月（USDと為替で変動）
# 前回¥3,000/月と誤設定していた（20倍ズレ）
CHATGPT_CORRECTIONS = {
    "1_20258月_chatGPT.pdf": 312,
    "46_202508月_chatGPT.pdf": 312,
    "105_202509_chatGPT.pdf": 312,
    "139__202510_chatGPT.pdf": 312,
    "156_202511月_chatGPT.pdf": 312,
    "292_12月chatGPT.pdf": 312,
    "294_1月chatGPT.pdf": 314,
    "366_2月chatGPT.pdf": 314,
    "436_20260302_チャットGPT.pdf": 314,
    "20260402_チャットGPT.pdf": 314,
}

# ============ フラッシュモバイル 固定 ============
# ファイル名の金額(2182)が読み取り困難な場合の固定値
FLASH_MOBILE_FIXED = 2182

# ============ RayL 固定 ============
RAYL_FIXED = 2181

# ============ 特殊ファイル（金額誤読対策） ============
SPECIAL_CORRECTIONS = {
    # ファイル名末尾に注文番号が付いているケース
    "247_20251215_Amazon_2164_7211443_.pdf": 2164,  # 7211443は注文番号
    
    # 2件合算ケース
    "206_20251106_Amazon_330020251112_Amazon_7698.pdf": 10998,  # 3300 + 7698
    
    # クレカ振込ご案内
    "20260415_クレカ振込ご案内_137206_2026031620260331.pdf": 137206,
    
    # 日薬保険（4店舗合算）
    "382_20260209_日薬保険４店舗分領収書_86380.pdf": 86380,
}


# ============ ファイル名の年月誤り補正 ============
# ファイル名に打ち間違えた年が入っており、そのままだと TARGET_MONTHS の
# 範囲外に落ちて金額が黙って欠落するケースを補正する。
#
# 414/415 は 2026/02 分の PayPay 明細だが、ファイル名の年が "2025" に
# なっている（同じバッチの 416〜419 は正しく "20260201"）。
# 元ファイル（Dropbox）はリネームせず、パイプライン側で上書きする。
# 486 はファイル名の数字が9桁（"202600302"）で、正規表現が
# 2026 + 00 + 30 と読むため月が "2026/00" という不正な値になる。
# Dropbox上は 3月 フォルダに格納されており、前後の 480〜485 も
# 20260331、後続の 487/488 も3月分。数字も "0302"（3月2日）と読める。
FILENAME_DATE_CORRECTIONS = {
    "414_20250201_paypay_9525.pdf": "2026/02",
    "415_20250201_paypay利用料_1626.pdf": "2026/02",
    "486_202600302_amzon_2241.pdf": "2026/03",
}


def apply_date_correction(filename, extracted_month):
    """
    ファイル名から抽出した月度に、既知の誤りがあれば補正を適用する。

    金額補正（apply_corrections）と同じく、ファイル名の完全一致でのみ
    上書きする。該当しないファイルは抽出結果をそのまま返す。

    Args:
        filename: ファイル名
        extracted_month: 正規表現で抽出した "YYYY/MM" または None

    Returns:
        補正後の "YYYY/MM" または元の値
    """
    if filename in FILENAME_DATE_CORRECTIONS:
        return FILENAME_DATE_CORRECTIONS[filename]
    return extracted_month


def apply_corrections(filename, extracted_amount):
    """
    ファイル名を見て、必要な補正を適用する。

    Args:
        filename: ファイル名
        extracted_amount: 元の抽出金額

    Returns:
        補正後の金額
    """
    # ChatGPT補正
    if filename in CHATGPT_CORRECTIONS:
        return CHATGPT_CORRECTIONS[filename]

    # 特殊ファイル
    if filename in SPECIAL_CORRECTIONS:
        return SPECIAL_CORRECTIONS[filename]

    # フラッシュモバイル
    if "フラッシュモバイル" in filename:
        return FLASH_MOBILE_FIXED

    # RayL
    if "RayL" in filename or "レイル" in filename:
        return RAYL_FIXED

    return extracted_amount


# ============ 特殊分類（金額以外の補正） ============
# 特定の取引先の科目を明示的に指定
SPECIAL_CLASSIFICATIONS = {
    # SQ*ヤキニク タラフク¥76,774 → 通信費から接待交際費に修正
    "ＳＱ*ヤキニク": ("接待交際費", "会食"),
    
    # 2026年3月のNTT光回線¥36,307は岡本ひかりハート薬局の解約工事費
    # → 該当データが「20260214_NTT_36307.pdf」等なら通信費のまま
}


# ============ 日薬保険 4店舗内訳 ============
NICHIYAKU_BREAKDOWN = [
    ("26A0076635", "ひかり調剤薬局", "加藤 亮太", "F", 31500),
    ("26A0076636", "ひかりファーマシー", "福田 久幸", "E", 18000),
    ("26A0076637", "ひかり薬局", "水田 健", "E", 18000),
    ("26A0076638", "ひかりハート薬局", "田原 佳樹", "E", 18000),
    ("システム利用料", "-", "-", "10%課税", 880),
]
