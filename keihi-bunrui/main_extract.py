"""
ステップ1: プロジェクトファイル → 中間データJSON生成

このスクリプトを実行すると:
  - /mnt/project/ の全ファイルをスキャン
  - ファイル名から科目・月・金額・取引先を抽出
  - オリコCSV全ファイルを読み込み
  - all_records_v5.json（プロジェクト側）
  - all_cc_v4.json（クレジット側）を保存
"""

import os
import json
import sys

# 同じディレクトリのモジュールを import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import PROJECT_DIR, WORK_DIR, ORICO_CSV_FILES
from classifiers import classify_project_file, classify_credit_vendor
from parsers import (
    extract_date_from_filename,
    extract_amount_from_filename,
    parse_orico_csv,
)
from amount_corrections import apply_corrections


def extract_project_records():
    """
    /mnt/project/ 内の全ファイルからレシート仕訳を抽出。
    """
    print("=" * 60)
    print("STEP 1-A: プロジェクトファイルから仕訳データ抽出")
    print("=" * 60)

    if not os.path.exists(PROJECT_DIR):
        print(f"❌ {PROJECT_DIR} が存在しません")
        return []

    records = []
    files = sorted(os.listdir(PROJECT_DIR))
    print(f"対象ファイル数: {len(files)}")

    for filename in files:
        # ファイル名からメタデータ抽出
        month = extract_date_from_filename(filename)
        amount = extract_amount_from_filename(filename)
        
        # 金額補正適用
        if amount:
            amount = apply_corrections(filename, amount)

        # 勘定科目判定
        account, tag, vendor = classify_project_file(filename)

        records.append({
            "filename": filename,
            "month": month,
            "date": "",   # 詳細日付は後で追加可能
            "amount": amount,
            "account": account,
            "tag": tag,
            "vendor": vendor,
        })

    # 統計
    from collections import Counter
    account_counts = Counter(r["account"] for r in records)
    print(f"\n勘定科目別 件数:")
    for acc, cnt in account_counts.most_common():
        print(f"  {acc:<20s}: {cnt}件")

    # 保存
    os.makedirs(WORK_DIR, exist_ok=True)
    out_path = os.path.join(WORK_DIR, "all_records_v5.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"\n✅ 保存: {out_path}")

    return records


def extract_credit_records():
    """
    オリコCSV全ファイルから取引データ抽出。
    """
    print("\n" + "=" * 60)
    print("STEP 1-B: オリコCSVからクレジット取引抽出")
    print("=" * 60)

    all_cc = []
    for csv_path, payment_month in ORICO_CSV_FILES:
        if not os.path.exists(csv_path):
            print(f"  ⚠ 未検出: {csv_path}")
            continue

        records = parse_orico_csv(csv_path, payment_month)

        # 各レコードに勘定科目を追加
        for r in records:
            account, tag = classify_credit_vendor(r["vendor"])
            r["account"] = account
            r["tag"] = tag
            # 家族カードの判定
            if r["user"] == "家族":
                # 用途で事業/私的判定
                if any(k in r["vendor"] for k in ["アポロ", "コスモ", "エネオス", "ＥＮＥＯＳ", "ＥＴＣ"]):
                    r["biz_flag"] = "家族(事業)"
                else:
                    r["biz_flag"] = "私的（家族）"
                    # 私的の場合は科目を "_私的" に
                    r["account"] = "_私的"
            else:
                r["biz_flag"] = "事業"

        all_cc.extend(records)
        total = sum(r["amount"] for r in records)
        print(f"  ✓ {payment_month}: {len(records)}件 (¥{total:,})")

    # 保存
    out_path = os.path.join(WORK_DIR, "all_cc_v4.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_cc, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 保存: {out_path}")
    print(f"総件数: {len(all_cc)}")
    biz_total = sum(r["amount"] for r in all_cc if "事業" in r.get("biz_flag", ""))
    print(f"事業分合計: ¥{biz_total:,}")

    return all_cc


if __name__ == "__main__":
    records = extract_project_records()
    cc = extract_credit_records()

    print("\n" + "=" * 60)
    print("✅ STEP 1 完了")
    print(f"  プロジェクト仕訳: {len(records)}件")
    print(f"  クレジット取引: {len(cc)}件")
    print(f"\n  次: python main_paypay.py を実行")
    print("=" * 60)
