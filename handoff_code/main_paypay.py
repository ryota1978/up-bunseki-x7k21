"""
ステップ2: PayPay明細PDFから店舗別売上抽出

このスクリプトを実行すると:
  - /mnt/project/ 内のPayPay関連PDFをスキャン
  - 屋号 or MID で店舗識別
  - 店舗×月次の売上を集計
  - paypay_sales.json を保存
"""

import os
import re
import json
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import PROJECT_DIR, WORK_DIR, PAYPAY_MID_TO_STORE
from parsers import parse_paypay_pdf


def extract_paypay_sales():
    print("=" * 60)
    print("STEP 2: PayPay店舗別売上抽出")
    print("=" * 60)

    # PayPay関連ファイル（年度サブディレクトリをまたいで再帰的に走査）
    all_files = []
    for root, _dirs, filenames in os.walk(PROJECT_DIR):
        for fn in filenames:
            all_files.append((os.path.join(root, fn), fn))
    all_files.sort(key=lambda t: t[1])
    files = [(p, f) for p, f in all_files
             if f.endswith(".pdf") and re.search(r"paypay|ペイペイ", f, re.IGNORECASE)]

    # 手数料/売上 分離
    sales_files = [(p, f) for p, f in files if "利用料" not in f]
    fee_files = [(p, f) for p, f in files if "利用料" in f]

    print(f"PayPay売上明細: {len(sales_files)}件")
    print(f"PayPay手数料: {len(fee_files)}件")

    # 店舗×月 集計
    sales_data = defaultdict(lambda: defaultdict(int))
    fees_data = defaultdict(lambda: defaultdict(int))

    for path, f in sales_files:
        result = parse_paypay_pdf(path, f)
        if not result:
            continue
        store = result["store"]
        month = result["month"]
        amount = result["amount"]
        if not (store and month and amount):
            continue
        sales_data[store][month] += amount

    for path, f in fee_files:
        result = parse_paypay_pdf(path, f)
        if not result:
            continue
        store = result["store"]
        month = result["month"]
        amount = result["amount"]
        if not (store and month and amount):
            continue
        fees_data[store][month] += amount

    # 結果表示
    print("\n=== PayPay 店舗別 入金額 ===")
    store_total = {}
    for store in sorted(sales_data.keys()):
        total = sum(sales_data[store].values())
        store_total[store] = total
        print(f"  {store:<24s} ¥{total:>10,}")

    grand_total = sum(store_total.values())
    print(f"  ---")
    print(f"  合計 ¥{grand_total:,}")

    print("\n=== PayPay 店舗別 手数料 ===")
    fee_total = 0
    for store in sorted(fees_data.keys()):
        total = sum(fees_data[store].values())
        fee_total += total
        print(f"  {store:<24s} ¥{total:>6,}")
    print(f"  ---")
    print(f"  合計 ¥{fee_total:,}")

    # 保存
    result = {
        "sales": {s: dict(sales_data[s]) for s in sales_data},
        "fees": {s: dict(fees_data[s]) for s in fees_data},
        "store_total": store_total,
        "grand_total": grand_total,
    }
    os.makedirs(WORK_DIR, exist_ok=True)
    out_path = os.path.join(WORK_DIR, "paypay_sales.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 保存: {out_path}")
    return result


if __name__ == "__main__":
    result = extract_paypay_sales()
    print("\n" + "=" * 60)
    print("✅ STEP 2 完了")
    print("  次: python main_excel.py を実行")
    print("=" * 60)
