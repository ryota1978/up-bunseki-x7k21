"""
ステップ3: Excel成果物生成

このスクリプトを実行すると:
  - 中間データJSON（all_records_v5.json, all_cc_v4.json, paypay_sales.json）を読み込み
  - 19シート構成の分析Excelを生成
  - /mnt/user-data/outputs/経費分類ベース_2025年8月-2026年5月_完全版.xlsx を保存

このファイルは骨組みのみ。各シートの詳細な生成関数は
excel_sheets/ サブディレクトリに分割することを推奨。
"""

import os
import json
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import BarChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.utils import get_column_letter

from config import (
    WORK_DIR, OUTPUT_XLSX, TARGET_MONTHS, STORES, SHEET_ORDER, STYLE
)


# ============ 共通スタイル ============
HEADER_FILL = PatternFill("solid", start_color=STYLE["primary_color"])
HEADER_FONT = Font(name=STYLE["font_normal"], bold=True, color="FFFFFF", size=11)
TITLE_FONT = Font(name=STYLE["font_normal"], bold=True, size=14, color=STYLE["primary_color"])
SECTION_FONT = Font(name=STYLE["font_normal"], bold=True, size=12, color=STYLE["primary_color"])
NORMAL_FONT = Font(name=STYLE["font_normal"], size=10)
SUBHEADER_FILL = PatternFill("solid", start_color=STYLE["sub_header"])
BORDER = Border(
    left=Side(style="thin", color="BFBFBF"),
    right=Side(style="thin", color="BFBFBF"),
    top=Side(style="thin", color="BFBFBF"),
    bottom=Side(style="thin", color="BFBFBF"),
)


def load_data():
    """中間データJSONを読み込み"""
    with open(os.path.join(WORK_DIR, "all_records_v5.json"), encoding="utf-8") as f:
        records = json.load(f)
    with open(os.path.join(WORK_DIR, "all_cc_v4.json"), encoding="utf-8") as f:
        cc = json.load(f)
    paypay = {}
    paypay_path = os.path.join(WORK_DIR, "paypay_sales.json")
    if os.path.exists(paypay_path):
        with open(paypay_path, encoding="utf-8") as f:
            paypay = json.load(f)
    return records, cc, paypay


def create_dashboard_sheet(wb, records, cc):
    """ダッシュボード：月別売上vs費用vsクレジット引落"""
    ws = wb.create_sheet("ダッシュボード")
    ws["A1"] = "📊 経費・売上ダッシュボード（2025年8月〜2026年5月）"
    ws["A1"].font = Font(name=STYLE["font_normal"], bold=True, size=16, color=STYLE["primary_color"])
    ws.merge_cells("A1:H1")

    # 月別集計
    month_total = defaultdict(lambda: {"売上": 0, "費用": 0, "クレジット引落": 0})
    for r in records:
        if not r["amount"] or r["month"] not in TARGET_MONTHS:
            continue
        if r["account"].startswith("_"):
            continue
        if r["account"].startswith("売上"):
            month_total[r["month"]]["売上"] += r["amount"]
        elif r["account"] == "クレジット引落":
            month_total[r["month"]]["クレジット引落"] += r["amount"]
        else:
            month_total[r["month"]]["費用"] += r["amount"]

    # ヘッダー
    ws["A3"] = "■ 月別 売上 vs 費用 vs クレジット引落"
    ws["A3"].font = SECTION_FONT

    hdrs = ["月度", "売上", "費用", "クレジット引落", "差引"]
    for ci, h in enumerate(hdrs, 1):
        c = ws.cell(row=4, column=ci, value=h)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = Alignment(horizontal="center")
        c.border = BORDER

    # データ
    for i, m in enumerate(TARGET_MONTHS, 5):
        d = month_total[m]
        ws.cell(row=i, column=1, value=m).font = NORMAL_FONT
        ws.cell(row=i, column=2, value=d["売上"])
        ws.cell(row=i, column=3, value=d["費用"])
        ws.cell(row=i, column=4, value=d["クレジット引落"])
        ws.cell(row=i, column=5, value=f"=B{i}-C{i}")
        for col in range(1, 6):
            cell = ws.cell(row=i, column=col)
            cell.border = BORDER
            cell.font = NORMAL_FONT
            if col >= 2:
                cell.number_format = "#,##0;-#,##0;-"

    # 合計行
    total_r = 4 + len(TARGET_MONTHS) + 1
    ws.cell(row=total_r, column=1, value="合計").font = Font(bold=True, name=STYLE["font_normal"])
    ws.cell(row=total_r, column=1).fill = SUBHEADER_FILL
    for ci in range(2, 6):
        col = get_column_letter(ci)
        c = ws.cell(row=total_r, column=ci, value=f"=SUM({col}5:{col}{total_r-1})")
        c.number_format = "#,##0;-#,##0;-"
        c.font = Font(bold=True, name=STYLE["font_normal"])
        c.fill = SUBHEADER_FILL

    # グラフ
    chart = BarChart()
    chart.type = "col"
    chart.style = 11
    chart.title = "月別 売上 vs 費用 vs クレジット引落"
    chart.height = 12
    chart.width = 24
    data = Reference(ws, min_col=2, min_row=4, max_col=4, max_row=4 + len(TARGET_MONTHS))
    cats = Reference(ws, min_col=1, min_row=5, max_row=4 + len(TARGET_MONTHS))
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.y_axis.number_format = "#,##0"
    ws.add_chart(chart, "G3")

    # 列幅
    for c, w in {"A": 12, "B": 14, "C": 14, "D": 14, "E": 14}.items():
        ws.column_dimensions[c].width = w


def create_journal_sheet(wb, records):
    """仕訳明細シート：全レコードを1行ずつ"""
    ws = wb.create_sheet("仕訳明細")
    URIAGE_FILL = PatternFill("solid", start_color=STYLE["urihi_fill"])

    headers = ["月度", "日付", "勘定科目", "補助タグ", "取引先", "金額", "ファイル名"]
    for col, h in enumerate(headers, 1):
        c = ws.cell(row=1, column=col, value=h)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = Alignment(horizontal="center")
        c.border = BORDER

    row = 2
    for r in records:
        ws.cell(row=row, column=1, value=r["month"])
        ws.cell(row=row, column=2, value=r.get("date", ""))
        ws.cell(row=row, column=3, value=r["account"])
        ws.cell(row=row, column=4, value=r.get("tag", ""))
        ws.cell(row=row, column=5, value=r.get("vendor", ""))
        ws.cell(row=row, column=6, value=r["amount"])
        ws.cell(row=row, column=7, value=r["filename"])

        fill = URIAGE_FILL if r["account"].startswith("売上") else None
        for col in range(1, 8):
            cell = ws.cell(row=row, column=col)
            cell.font = NORMAL_FONT
            cell.border = BORDER
            if fill:
                cell.fill = fill
            if col == 6:
                cell.number_format = "#,##0;-;-"
                cell.alignment = Alignment(horizontal="right")
        row += 1

    # 列幅
    for col, w in {"A": 10, "B": 12, "C": 16, "D": 14, "E": 40, "F": 12, "G": 60}.items():
        ws.column_dimensions[col].width = w

    ws.auto_filter.ref = f"A1:G{row-1}"
    ws.freeze_panes = "A2"


def create_credit_sheet(wb, cc):
    """クレジット明細シート"""
    ws = wb.create_sheet("クレジット明細_オリコ")
    ws["A1"] = "💳 オリコ利用明細（全期間）"
    ws["A1"].font = TITLE_FONT
    ws.merge_cells("A1:I1")

    # ヘッダー
    hdrs = ["支払月", "ご利用日", "ご利用者", "ご利用先", "勘定科目", "補助タグ", "金額", "備考", "事業/私的"]
    hdr_row = 3
    for ci, h in enumerate(hdrs, 1):
        c = ws.cell(row=hdr_row, column=ci, value=h)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = Alignment(horizontal="center")
        c.border = BORDER

    # データ
    for ri, r in enumerate(cc, hdr_row + 1):
        ws.cell(row=ri, column=1, value=r.get("payment_month", ""))
        ws.cell(row=ri, column=2, value=r.get("date", ""))
        ws.cell(row=ri, column=3, value=r.get("user", ""))
        ws.cell(row=ri, column=4, value=r.get("vendor", ""))
        ws.cell(row=ri, column=5, value=r.get("account", ""))
        ws.cell(row=ri, column=6, value=r.get("tag", ""))
        ws.cell(row=ri, column=7, value=r["amount"])
        ws.cell(row=ri, column=8, value="")
        ws.cell(row=ri, column=9, value=r.get("biz_flag", ""))

        for col in range(1, 10):
            cell = ws.cell(row=ri, column=col)
            cell.font = NORMAL_FONT
            cell.border = BORDER
            if col == 7:
                cell.number_format = "#,##0"

    # 列幅
    for col, w in {"A": 10, "B": 14, "C": 8, "D": 40, "E": 14, "F": 12, "G": 12, "H": 18, "I": 12}.items():
        ws.column_dimensions[col].width = w

    ws.auto_filter.ref = f"A{hdr_row}:I{hdr_row + len(cc)}"
    ws.freeze_panes = f"A{hdr_row + 1}"


def apply_sheet_order(wb):
    """シートの順序を config で指定した順に並び替え"""
    for idx, name in enumerate(SHEET_ORDER):
        if name in wb.sheetnames:
            cur = wb.sheetnames.index(name)
            wb.move_sheet(name, offset=idx - cur)


def main():
    print("=" * 60)
    print("STEP 3: Excel生成")
    print("=" * 60)

    records, cc, paypay = load_data()

    # 新規Workbookでスタート（既存Excelを上書き）
    wb = Workbook()
    # デフォルト作成される "Sheet" を削除
    if "Sheet" in wb.sheetnames:
        del wb["Sheet"]

    # 基本シート作成（骨組み）
    print("シート作成中...")
    create_dashboard_sheet(wb, records, cc)
    create_journal_sheet(wb, records)
    create_credit_sheet(wb, cc)

    # 他のシートは詳細な生成関数を別途実装
    # excel_sheets/dashboard.py, expense.py, payment.py, ...

    # シート順を整える
    apply_sheet_order(wb)

    # 保存
    os.makedirs(os.path.dirname(OUTPUT_XLSX), exist_ok=True)
    wb.save(OUTPUT_XLSX)
    print(f"\n✅ 保存: {OUTPUT_XLSX}")

    # 数式検証
    verify_formulas()


def verify_formulas():
    """Excel数式の検証（recalc_helper.py使用）"""
    try:
        from skills.recalc_helper import verify_excel
        result = verify_excel(OUTPUT_XLSX)
        print(f"数式検証: {result}")
    except ImportError:
        print("recalc_helper.py が見つかりません。数式検証をスキップします。")


if __name__ == "__main__":
    main()
    print("\n" + "=" * 60)
    print("✅ すべての処理完了")
    print(f"  成果物: {OUTPUT_XLSX}")
    print("=" * 60)
