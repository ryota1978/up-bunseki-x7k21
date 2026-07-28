#!/bin/bash
# 一括実行スクリプト
# 3ステップを順に実行する

set -e  # エラーで停止

cd "$(dirname "$0")"

echo "============================================================"
echo "経費分類Excel 生成システム 一括実行"
echo "============================================================"

# 環境確認
python3 -c "import pdfplumber, openpyxl" 2>/dev/null || {
    echo "❌ 必要なパッケージがインストールされていません"
    echo "以下を実行してください:"
    echo "  pip install pdfplumber pdf2image pytesseract openpyxl --break-system-packages"
    exit 1
}

# ステップ1: データ抽出
echo ""
echo "▶ STEP 1: プロジェクトファイルからデータ抽出"
python3 main_extract.py

# ステップ2: PayPay売上抽出
echo ""
echo "▶ STEP 2: PayPay売上抽出"
python3 main_paypay.py

# ステップ3: Excel生成
echo ""
echo "▶ STEP 3: Excel生成"
python3 main_excel.py

echo ""
echo "============================================================"
echo "✅ 完了！成果物は /mnt/user-data/outputs/ を確認"
echo "============================================================"
