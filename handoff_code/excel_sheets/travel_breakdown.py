"""
旅費交通費_内訳分析 シート

オリコ明細の旅費交通費を、取引先名のキーワードで
「宿泊 / 交通 / タクシー」に細分類して集計する。
"""

import re
from collections import defaultdict

from openpyxl.chart import PieChart, Reference
from openpyxl.chart.label import DataLabelList

from ._common import (
    new_sheet, set_title, section, set_widths, write_header, write_row,
    note_block, SUBHEADER_FILL, YEN, PCT,
)


SHEET_NAME = "旅費交通費_内訳分析"

# 区分判定（上から順に評価）。オリコの取引先名は全角カタカナ。
SUBCATEGORIES = [
    ("タクシー", [r"タクシ", r"ＴＡＸＩ", r"ゴ−（タクシ", r"アプリハイ", r"ＭＫ"]),
    ("宿泊", [r"ホテル", r"ＨＯＴＥＬ", r"イン$", r"リヨカン", r"旅館",
              r"アゴダ", r"ＡＧＯＤＡ", r"ブツキング", r"ジヤランネツト",
              r"ラクテンﾄﾗﾍﾞﾙ", r"テンボウダイ", r"リゾート"]),
    ("交通", [r"ＥＴＣ", r"近鉄", r"キンテツ", r"キンキニツポンテツドウ", r"ＪＲ",
              r"シンカンセン", r"ＡＮＡ", r"ＪＡＬ", r"コウツウ", r"テツドウ",
              r"タイムズ", r"パーキング", r"バス", r"エキ"]),
]


def subcategory(vendor):
    v = vendor or ""
    for name, pats in SUBCATEGORIES:
        for p in pats:
            if re.search(p, v):
                return name
    return "交通"


def aggregate(cc):
    """旅費交通費のクレジット明細を区分別/取引先別/月別に集計"""
    by_cat = defaultdict(lambda: [0, 0])       # [件数, 金額]
    by_vendor = defaultdict(lambda: [None, 0, 0])  # [区分, 回数, 金額]
    by_month = defaultdict(lambda: [0, 0])
    total = 0
    for r in cc or []:
        if r.get("account") != "旅費交通費" or not r.get("amount"):
            continue
        if r.get("biz_flag") == "私的（家族）":
            continue
        cat = subcategory(r.get("vendor"))
        amt = r["amount"]
        by_cat[cat][0] += 1
        by_cat[cat][1] += amt
        v = (r.get("vendor") or "不明").strip()
        by_vendor[v][0] = cat
        by_vendor[v][1] += 1
        by_vendor[v][2] += amt
        m = r.get("payment_month") or "-"
        by_month[m][0] += 1
        by_month[m][1] += amt
        total += amt
    return dict(by_cat), dict(by_vendor), dict(by_month), total


def create_sheet(wb, records=None, cc=None):
    ws = new_sheet(wb, SHEET_NAME)
    set_title(ws, "🚄 旅費交通費 詳細内訳", "A1:F1")

    by_cat, by_vendor, by_month, total = aggregate(cc)

    # ---------- サマリ ----------
    section(ws, 3, "■ サマリ（区分別）")
    r = write_header(ws, 4, ["区分", "件数", "金額", "シェア"])
    c_first = r
    for cat, (n, amt) in sorted(by_cat.items(), key=lambda kv: -kv[1][1]):
        r = write_row(ws, r, [cat, n, amt, (amt / total if total else 0)],
                      number_cols={3}, pct_cols={4})
    c_last = r - 1
    write_row(ws, r, ["合計", f"=SUM(B{c_first}:B{c_last})",
                      f"=SUM(C{c_first}:C{c_last})", 1],
              number_cols={3}, pct_cols={4}, bold=True, fill=SUBHEADER_FILL)

    # ---------- 取引先ランキング ----------
    sec2 = r + 3
    section(ws, sec2, "■ 取引先別ランキング（TOP 20）")
    vr = write_header(ws, sec2 + 1, ["順位", "取引先", "種別", "回数", "金額"])
    ranked = sorted(by_vendor.items(), key=lambda kv: -kv[1][2])[:20]
    for i, (v, (cat, n, amt)) in enumerate(ranked, 1):
        vr = write_row(ws, vr, [i, v, cat, n, amt], number_cols={5})

    # ---------- 月別推移 ----------
    sec3 = vr + 2
    section(ws, sec3, "■ 月別 推移（支払月ベース）")
    mr = write_header(ws, sec3 + 1, ["支払月", "件数", "金額"])
    m_first = mr
    for m in sorted(by_month):
        n, amt = by_month[m]
        mr = write_row(ws, mr, [m, n, amt], number_cols={3})
    write_row(ws, mr, ["合計", f"=SUM(B{m_first}:B{mr - 1})",
                       f"=SUM(C{m_first}:C{mr - 1})"],
              number_cols={3}, bold=True, fill=SUBHEADER_FILL)

    # ---------- グラフ ----------
    pie = PieChart()
    pie.title = "旅費交通費 内訳シェア"
    pie.height = 11
    pie.width = 13
    pd = Reference(ws, min_col=3, min_row=c_first, max_row=c_last)
    pc = Reference(ws, min_col=1, min_row=c_first, max_row=c_last)
    pie.add_data(pd, titles_from_data=False)
    pie.set_categories(pc)
    pie.dataLabels = DataLabelList()
    pie.dataLabels.showPercent = True
    ws.add_chart(pie, "G4")

    # ---------- 特徴 ----------
    lodging = by_cat.get("宿泊", [0, 0])[1]
    peak_month = max(by_month.items(), key=lambda kv: kv[1][1]) if by_month else ("-", [0, 0])
    top_vendor = ranked[0] if ranked else ("-", ("-", 0, 0))
    note_block(ws, mr + 3, [
        "📝 旅費交通費の特徴",
        f"• 合計 ¥{total:,}（オリコ事業分）",
        f"• 宿泊費が ¥{lodging:,}（{(lodging / total if total else 0):.0%}）を占める",
        f"• 最大の取引先は「{top_vendor[0]}」 ¥{top_vendor[1][2]:,}（{top_vendor[1][1]}回）",
        f"• ピークは {peak_month[0]} の ¥{peak_month[1][1]:,} → 大型出張・会議の時期と推定",
        "• ETC利用は伊勢⇔松阪・湾岸長島・津 方面（業務移動）が中心",
        "",
        "📌 区分の判定ルール",
        "• タクシー: 取引先名に「タクシ」「アプリハイ」等を含む",
        "• 宿泊: 「ホテル」「アゴダ」「リゾート」「テンボウダイ」等を含む",
        "• 交通: 「ETC」「近鉄」「JR」「コウツウ」「タイムズ」等を含む（既定値）",
    ])

    set_widths(ws, {"A": 12, "B": 44, "C": 12, "D": 10, "E": 14, "F": 14})
    return ws
