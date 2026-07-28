# 経費分類 分析Excel 生成システム

株式会社ユナイテッドファーマシー（4薬局運営）の経費分類と分析Excelを自動生成するシステム。

## 対象期間
2025年8月 〜 2026年5月（10ヶ月・拡張可能）

## 環境要件

```bash
# Python パッケージ
pip install pdfplumber pdf2image pytesseract openpyxl --break-system-packages

# システムパッケージ（OCR用）
apt-get install -y tesseract-ocr tesseract-ocr-jpn poppler-utils
```

## ディレクトリ構成

```
handoff_code/
├── README.md                    # このファイル
├── config.py                    # 設定・定数・マッピング
├── classifiers.py               # 分類ルール（勘定科目判定）
├── parsers.py                   # データ抽出（PDF/CSV/画像）
├── amount_corrections.py        # 金額補正マップ
├── main_extract.py              # ステップ1: データ抽出
├── main_paypay.py               # ステップ2: PayPay売上抽出
├── main_excel.py                # ステップ3: Excel生成
├── skills/
│   └── recalc_helper.py         # Excel数式検証ヘルパー
└── outputs/                     # 中間データ・成果物
```

## 使い方（3ステップ）

### ステップ1: プロジェクトファイルからデータ抽出
```bash
python main_extract.py
# → /home/claude/work/all_records_v5.json
# → /home/claude/work/all_cc_v4.json
```

### ステップ2: PayPay店舗別売上抽出
```bash
python main_paypay.py
# → /home/claude/work/paypay_sales.json
```

### ステップ3: Excel生成
```bash
python main_excel.py
# → /mnt/user-data/outputs/経費分類ベース_2025年8月-2026年5月_完全版.xlsx
```

## 一括実行
```bash
python main_extract.py && python main_paypay.py && python main_excel.py
```

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| CSV文字化け | encoding=utf-8で読んでいる | `encoding='shift_jis'` に変更 |
| PDFテキストが空 | 画像化されたPDF | pdf2image + pytesseractでOCR |
| Excel数式エラー | 関数名ミス | `recalc_helper.py` で検証 |
| ChatGPT金額が¥3,000 | 補正未適用 | `amount_corrections.py` を実行 |

## データ更新時の手順

1. 新しいオリコCSVを追加した場合 → `config.ORICO_CSV_FILES` に追記
2. 新しい月のデータを追加した場合 → `config.TARGET_MONTHS` に追記
3. 新しい取引先を追加する場合 → `classifiers.py` にパターン追記
4. 金額補正が必要な場合 → `amount_corrections.py` に追記
5. 実行: 上記の3ステップを順に実行

