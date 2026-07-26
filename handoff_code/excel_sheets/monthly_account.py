"""
月別科目集計 シート

勘定科目 × 月 のクロス集計。
合計列/合計行は実際の =SUM() 数式で持たせ、Excel上で生きたピボットとして扱える。
"""

from collections import defaultdict

from openpyxl.chart import BarChart, Reference

from config import TARGET_MONTHS
from ._common import (
    new_sheet, set_title, section, set_widths, month_cross_table, YEN,
)


SHEET_NAME = "月別科目集計"


def aggregate(records):
    """勘定科目 × 月 の集計（_資料 等の除外科目はスキップ）"""
    data = defaultdict(lambda: defaultdict(int))
    for r in records:
        acct = r.get("account") or "未分類"
        if acct.startswith("_"):
            continue
        m = r.get("month")
        if m not in TARGET_MONTHS or not r.get("amount"):
            continue
        data[acct][m] += r["amount"]
    return {k: dict(v) for k, v in data.items()}


def create_sheet(wb, records, cc=None):
    ws = new_sheet(wb, SHEET_NAME)
    set_title(ws, "📋 月別 勘定科目集計")

    data = aggregate(records)
    section(ws, 3, "■ 勘定科目 × 月 クロス集計（領収書・請求書ベース）")

    hdr, first, last, total_row, total_col = month_cross_table(
        ws, 4, "勘定科目", data
    )

    # 費用科目のみを対象にした棒グラフ（売上系は除外して費用構造を見る）
    chart = BarChart()
    chart.type = "col"
    chart.style = 11
    chart.title = "勘定科目別 月次推移"
    chart.height = 12
    chart.width = 26
    chart.y_axis.number_format = "#,##0"
    data_ref = Reference(ws, min_col=2, min_row=hdr, max_col=1 + len(TARGET_MONTHS),
                         max_row=last)
    cats = Reference(ws, min_col=1, min_row=first, max_row=last)
    chart.add_data(data_ref, titles_from_data=True, from_rows=True)
    chart.set_categories(cats)
    ws.add_chart(chart, f"A{total_row + 3}")

    set_widths(ws, {"A": 20, **{chr(ord("B") + i): 13 for i in range(len(TARGET_MONTHS) + 1)}})
    ws.freeze_panes = "B5"
    return ws
