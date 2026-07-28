"""
データ抽出関数

- PDFファイルからテキスト抽出
- 画像化されたPDFからOCR
- オリコCSV読み込み（Shift_JIS）
- ファイル名からのメタデータ抽出
"""

import os
import re
import csv
import logging
import warnings

warnings.filterwarnings("ignore")
logging.getLogger("pdfminer").setLevel(logging.ERROR)
logging.getLogger("pdfplumber").setLevel(logging.ERROR)


# ============ ファイル名からメタデータ抽出 ============

def extract_date_from_filename(filename):
    """
    ファイル名から日付を抽出する。

    パターン例:
        "20251201_..." → 2025/12
        "224_20251201_..." → 2025/12
        "9月分" → None（月不明）

    Returns:
        "YYYY/MM" 形式の文字列、または None
    """
    m = re.search(r"(20\d{2})(\d{2})(\d{2})", filename)
    if m:
        return f"{m.group(1)}/{m.group(2)}"
    return None


def extract_amount_from_filename(filename):
    """
    ファイル名末尾から金額を抽出する。

    パターン例:
        "..._65789_..." → 65789
        "..._12345.pdf" → 12345

    Returns:
        int または None
    """
    # 末尾パターン: _数字.拡張子
    m = re.search(r"_(\d{3,7})(?:\.[a-zA-Z]+)$", filename)
    if m:
        amt = int(m.group(1))
        if 100 <= amt <= 10_000_000:
            return amt
    
    # 中間パターン: _数字_ で最も金額らしいもの
    matches = re.findall(r"_(\d{3,7})(?=[_\.])", filename)
    for m in matches:
        amt = int(m)
        if 100 <= amt <= 10_000_000:
            return amt
    return None


# ============ PDF抽出 ============

def extract_pdf_text(pdf_path):
    """
    PDFから全ページのテキストを抽出。

    テキスト層があるPDF専用。画像化されたPDFは空文字を返す。
    """
    try:
        import pdfplumber
        text_parts = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text_parts.append(page.extract_text() or "")
        return "\n".join(text_parts)
    except Exception as e:
        return ""


def ocr_pdf(pdf_path, dpi=200, lang="jpn+eng"):
    """
    画像化されたPDFをOCRしてテキスト取得。

    tesseract-ocr-jpn 必須。時間かかる。

    Args:
        pdf_path: PDFパス
        dpi: 解像度（高いほど正確・遅い）
        lang: OCR言語（jpn+eng推奨）

    Returns:
        抽出テキスト
    """
    try:
        from pdf2image import convert_from_path
        import pytesseract

        images = convert_from_path(pdf_path, dpi=dpi)
        text_parts = []
        for img in images:
            text_parts.append(pytesseract.image_to_string(img, lang=lang))
        return "\n".join(text_parts)
    except Exception as e:
        return ""


# ============ PayPay明細から店舗・金額抽出 ============

def parse_paypay_pdf(pdf_path, filename):
    """
    PayPay支払明細PDFから店舗・金額を抽出。

    PayPay MID または 屋号で店舗識別。

    Returns:
        {"store": str, "amount": int, "month": str} or None
    """
    from config import PAYPAY_MID_TO_STORE

    text = extract_pdf_text(pdf_path)
    if not text:
        return None

    # 屋号から店舗特定（優先）
    yago_m = re.search(r"屋号[::]\s*(ひかり\S+)", text)
    store = yago_m.group(1).strip() if yago_m else None

    # 屋号が取れない場合はMIDで
    if not store:
        mid_m = re.search(r"MID[::]\s*(\d{15,20})", text)
        if mid_m:
            store = PAYPAY_MID_TO_STORE.get(mid_m.group(1))

    if not store:
        return None

    # 月度（ファイル名から）
    month = extract_date_from_filename(filename)

    # 金額（ファイル名から、末尾）
    amount = extract_amount_from_filename(filename)

    return {"store": store, "amount": amount, "month": month}


# ============ オリコCSV読み込み ============

def parse_orico_csv(csv_path, payment_month):
    """
    オリコCSVを読み込む。

    重要: エンコーディングは shift_jis。

    CSVの列構造:
        利用日, 取引先, ?, ご利用者, 支払月, ?, 支払回数, ?, 利用金額, ...

    Args:
        csv_path: CSVファイルパス
        payment_month: この CSV の支払月（例: "2025/08"）

    Returns:
        取引レコードのリスト
    """
    records = []
    try:
        with open(csv_path, encoding="shift_jis", errors="replace") as f:
            text = f.read()
    except Exception as e:
        print(f"CSV読込エラー {csv_path}: {e}")
        return records

    for line in text.split("\n"):
        parts = line.split(",")
        if len(parts) < 9:
            continue

        # 日付が「YYYY年MM月DD日」形式かチェック
        date_str = parts[0].strip('"').strip()
        if not re.match(r"20\d{2}年\d+月\d+日", date_str):
            continue

        try:
            vendor = parts[1].strip('"').strip()
            user_type = parts[3].strip('"').strip() if len(parts) > 3 else ""
            # 金額は8番目（インデックス）に \10,000 形式で入る
            amount_str = parts[8].strip('"').replace("\\", "").replace(",", "").strip()
            amount = int(amount_str) if amount_str.isdigit() else 0
            
            records.append({
                "date": date_str,
                "vendor": vendor,
                "user": user_type,
                "amount": amount,
                "payment_month": payment_month,
            })
        except (ValueError, IndexError):
            continue

    return records


# ============ Amazon商品抽出 ============

def parse_amazon_pdf(pdf_path, filename):
    """
    Amazon領収書から商品名・配送先を抽出。

    Args:
        pdf_path: Amazon領収書PDFパス
        filename: ファイル名（月度判定用）

    Returns:
        [{"item": str, "delivery": str, "category": str, "month": str, "file": str}, ...]
    """
    text = extract_pdf_text(pdf_path)
    if not text:
        return []

    products = []

    # 配送先抽出（「お届け先」の直後）
    delivery_m = re.search(r"お届け先[\s\S]*?(?:〒\d{3}-?\d{4})?[\s\S]*?(ひかり\S+|.{5,30})", text)
    delivery = delivery_m.group(1).strip() if delivery_m else "不明"

    # 商品名抽出（「商品名」 or「品目」欄）
    item_lines = re.findall(r"商品名[\s\S]*?[\s\n](.{5,80})[\s\n]数量", text)
    if not item_lines:
        # フォールバック: それらしい行
        for line in text.split("\n"):
            if re.match(r"^\s*[A-Za-z0-9].{20,80}$", line) and not any(w in line for w in ["Amazon", "www", "http", "領収書"]):
                item_lines.append(line.strip())

    month = extract_date_from_filename(filename)

    for item in item_lines[:5]:  # 最大5商品
        category = categorize_amazon_item(item)
        products.append({
            "item": item[:100],
            "delivery": delivery[:30],
            "category": category,
            "month": month,
            "file": filename,
        })

    return products


def categorize_amazon_item(item):
    """商品名からカテゴリ判定"""
    s = item.lower()
    if re.search(r"ip01|ip11|ic\d+|jit|チップス|ヨコハマトナー|横トナ|tn70|dr70|lc31|gjic|gp-730|感熱|メンテナンスボックス|インク|トナー", s):
        return "プリンタ用品（インク・トナー）"
    if re.search(r"スチールラック|メタルラック|ダイニングチェア|ミルサー", s):
        return "オフィス家具"
    if re.search(r"ipad|monitor|モニター|スイッチングハブ|マウス|イヤホン|乾電池|hpki|カードリーダー", s):
        return "電化製品・IT機器"
    if re.search(r"クイックル|ティッシュ|トイレットペーパー|ワックス", s):
        return "清掃・消耗品"
    if re.search(r"握力計|スクラブ|ハイソックス|ハンドクリーム|felica|フェリカ|寒天ゼリー|液量計", s):
        return "医療・薬局備品"
    if re.search(r"bos|非常用トイレ|三角コーン|遮光カーテン", s):
        return "防災・安全用品"
    if re.search(r"封筒|コピー用紙|ラミネート", s):
        return "文房具・事務用品"
    if re.search(r"ドトール|ネスカフェ|いろはす|コーヒー", s):
        return "飲食・休憩用品"
    return "その他"
