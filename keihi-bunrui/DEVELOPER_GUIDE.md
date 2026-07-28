# 開発者ガイド

## モジュール構成

```
handoff_code/
├── config.py                    # 定数・マッピング（変更頻度: 中）
├── classifiers.py               # 勘定科目判定（変更頻度: 高）
├── amount_corrections.py        # 金額補正マップ（変更頻度: 中）
├── parsers.py                   # データ抽出（変更頻度: 低）
├── main_extract.py              # STEP 1 実行
├── main_paypay.py               # STEP 2 実行
├── main_excel.py                # STEP 3 実行
├── run_all.sh                   # 一括実行
├── skills/
│   └── recalc_helper.py         # Excel検証
└── excel_sheets/                # シート別モジュール
    ├── __init__.py
    ├── vendor_dashboard.py      # 支払先ダッシュボード
    └── (他のシートモジュールは順次追加)
```

## データフロー

```
[/mnt/project/]  ← ユーザーがアップロード
      ↓
  main_extract.py（配信）
   ├→ classifiers.py（分類）
   ├→ amount_corrections.py（補正）
   └→ parsers.py（抽出）
      ↓
[/home/claude/work/]
   ├─ all_records_v5.json（プロジェクト仕訳）
   └─ all_cc_v4.json（クレジット取引）
      ↓
  main_paypay.py（PayPay売上）
      ↓
   └─ paypay_sales.json
      ↓
  main_excel.py（Excel生成）
   └→ excel_sheets/*.py（各シート）
      ↓
[/mnt/user-data/outputs/経費分類ベース_2025年8月-2026年5月_完全版.xlsx]
```

## 拡張ポイント

### 新しい取引先を追加する

`classifiers.py` の該当関数にパターン追加:

```python
def classify_project_file(filename):
    # ...
    if re.search(r"新しい取引先名", fn, re.IGNORECASE):
        return ("勘定科目名", "タグ", "取引先名")
    # ...
```

`excel_sheets/vendor_dashboard.py` の `TARGET_VENDORS` にも追加:

```python
TARGET_VENDORS = {
    # ...
    "新しい取引先": ["キーワード1", "キーワード2"],
}
```

### 新しい月のデータを追加する

`config.py` の `TARGET_MONTHS` に追記:

```python
TARGET_MONTHS = [
    # 既存の月...
    "2026/06", "2026/07",  # 追加
]
```

新しいオリコCSVがあれば `ORICO_CSV_FILES` に追加:

```python
ORICO_CSV_FILES = [
    # 既存...
    ("/mnt/project/20260527_オリコクレジットCSV.csv", "2026/05"),  # 追加
]
```

### 金額補正が必要な場合

`amount_corrections.py` の該当マップに追記:

```python
SPECIAL_CORRECTIONS = {
    # 既存...
    "新しいファイル名.pdf": 正しい金額,
}
```

### 新しいシートを追加する

`excel_sheets/新シート名.py` を作成:

```python
"""新シート名 生成モジュール"""

def create_sheet(wb, records, cc):
    """
    Args:
        wb: openpyxl Workbook
        records: プロジェクト仕訳リスト
        cc: クレジット取引リスト
    """
    ws = wb.create_sheet("シート名")
    # 実装...
    return ws
```

`main_excel.py` から呼び出す:

```python
from excel_sheets.新シート名 import create_sheet as create_新シート

# main() 内で
create_新シート(wb, records, cc)
```

`config.py` の `SHEET_ORDER` に追加:

```python
SHEET_ORDER = [
    # ...
    "新シート名",
    # ...
]
```

## デバッグのヒント

### 1. 個別ファイルの処理を確認

```python
from parsers import extract_pdf_text, extract_amount_from_filename
from classifiers import classify_project_file
from amount_corrections import apply_corrections

filename = "224_20251201_65789_11月ひかり調剤薬局.pdf"

# メタデータ抽出
print(extract_amount_from_filename(filename))  # 65789
print(classify_project_file(filename))         # ('売上_調剤', ...)
print(apply_corrections(filename, 65789))      # 65789
```

### 2. CSVの読み込み確認

```python
from parsers import parse_orico_csv

records = parse_orico_csv("/mnt/project/24_オリコクレジットCSV.csv", "2025/08")
print(f"件数: {len(records)}")
print(f"合計: ¥{sum(r['amount'] for r in records):,}")
```

### 3. 中間データの中身確認

```python
import json

with open("/home/claude/work/all_records_v5.json") as f:
    records = json.load(f)

# 勘定科目別集計
from collections import Counter
print(Counter(r['account'] for r in records).most_common())

# 特定取引先のみ抽出
filtered = [r for r in records if "コムデック" in r["filename"]]
for r in filtered:
    print(r)
```

### 4. Excelの数式エラー確認

```bash
python3 /mnt/skills/public/xlsx/scripts/recalc.py \
    /mnt/user-data/outputs/経費分類ベース_2025年8月-2026年5月_完全版.xlsx
```

## テスト方法

### 単体テスト（分類ルール）

```python
# test_classifiers.py

from classifiers import classify_project_file

def test_paypay():
    result = classify_project_file("131_20251001_paypay_34894.pdf")
    assert result[0] == "売上集計"

def test_amazon():
    result = classify_project_file("225_20251201_Amazon_28902.pdf")
    assert result[0] == "消耗品費"

def test_chatgpt():
    result = classify_project_file("292_12月chatGPT.pdf")
    assert result[0] == "通信費"

if __name__ == "__main__":
    test_paypay()
    test_amazon()
    test_chatgpt()
    print("✅ 全テスト通過")
```

### 補正の妥当性確認

```python
# ChatGPTが¥312になっているか
from amount_corrections import apply_corrections

result = apply_corrections("1_20258月_chatGPT.pdf", 3000)
assert result == 312, f"Expected 312, got {result}"
print("✅ ChatGPT補正 OK")
```

## パフォーマンス

- STEP 1（データ抽出）: 約10秒 / 612ファイル
- STEP 2（PayPay抽出）: 約30秒 / 60ファイル（PDF読み込みが重い）
- STEP 3（Excel生成）: 約20秒 / 19シート

## 既知の制限事項

1. **通帳PDFのOCR**: 取引先名の抽出が困難（数字のみ抽出）
2. **画像化PDF**: `.jpeg` `.png` を PDF化した領収書は要OCR（時間かかる）
3. **CSV エンコーディング**: 必ず `shift_jis` を指定
4. **金額の推定精度**: ファイル名末尾の数字パターンで推定するため、命名規則に依存
5. **家族カード判定**: 用途（ガソリン/食事/その他）の判定は不完全 → 手動修正が必要

## 引き継ぎ時の確認事項

- [ ] Python環境（Python 3.11+）
- [ ] 必要ライブラリのインストール確認
- [ ] Tesseract日本語データの確認
- [ ] `/mnt/project/` へのアクセス権
- [ ] `/mnt/user-data/outputs/` への書き込み権
- [ ] 中間データディレクトリ `/home/claude/work/` の作成
- [ ] `run_all.sh` の実行確認
- [ ] 生成されたExcelの数式エラーが0であること
