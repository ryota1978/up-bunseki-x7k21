"""
接待交際費_内訳分析 シート

領収書（松幸農産等の贈答）とクレジット（会食・贈答）を合算し、
取引先名のキーワードで「贈答 / 会食 / その他」に細分類する。
"""

import re
from collections import defaultdict

from openpyxl.chart import PieChart, Reference
from openpyxl.chart.label import DataLabelList

from ._common import (
    new_sheet, set_title, section, set_widths, write_header, write_row,
    note_block, SUBHEADER_FILL, YEN, PCT,
)


SHEET_NAME = "接待交際費_内訳分析"

GIFT_PATTERNS = [
    r"高島屋", r"タカシマヤ", r"松幸", r"贈答", r"マツザカヤ", r"三越", r"ミツコシ",
    r"ギフト", r"スマロ", r"オチユウゲン", r"オセイボ", r"ヒヤツカテン", r"百貨店",
]
DINING_PATTERNS = [
    r"焼肉", r"ヤキニク", r"寿司", r"スシ", r"ズシ", r"バル", r"ステ−キ", r"ステーキ",
    r"シヨクドウ", r"食堂", r"サカバ", r"酒場", r"サケドコロ", r"イザカヤ", r"居酒屋",
    r"レストラン", r"ギュウカク", r"カフエ", r"コーヒー", r"ハマズシ", r"ソウサン",
    r"イナセ", r"ポニアネラ", r"モモヤ", r"オオシマヤ", r"タカヤ", r"ノツポ",
]


def subcategory(name):
    v = name or ""
    for p in GIFT_PATTERNS:
        if re.search(p, v):
            return "贈答（高島屋・松幸農産等）"
    for p in DINING_PATTERNS:
        if re.search(p, v):
            return "会食（焼肉・寿司・バル等）"
    return "その他"


def aggregate(records, cc):
    by_cat = defaultdict(lambda: [0, 0])
    by_vendor = defaultdict(lambda: [None, 0, 0])
    by_month = defaultdict(lambda: [0, 0])
    src = {"receipt": [0, 0], "credit": [0, 0]}

    def add(name, amount, month, kind):
        cat = subcategory(name)
        by_cat[cat][0] += 1
        by_cat[cat][1] += amount
        by_vendor[name][0] = cat
        by_vendor[name][1] += 1
        by_vendor[name][2] += amount
        by_month[month][0] += 1
        by_month[month][1] += amount
        src[kind][0] += 1
        src[kind][1] += amount

    for r in records or []:
        if r.get("account") != "接待交際費" or not r.get("amount"):
            continue
        name = (r.get("vendor") or r.get("filename") or "不明").strip()
        add(name, r["amount"], r.get("month") or "-", "receipt")

    for r in cc or []:
        if r.get("account") != "接待交際費" or not r.get("amount"):
            continue
        if r.get("biz_flag") == "私的（家族）":
            continue
        name = (r.get("vendor") or "不明").strip()
        add(name, r["amount"], r.get("payment_month") or "-", "credit")

    return dict(by_cat), dict(by_vendor), dict(by_month), src


def create_sheet(wb, records=None, cc=None):
    ws = new_sheet(wb, SHEET_NAME)
    set_title(ws, "🍴 接待交際費 詳細内訳", "A1:F1")

    by_cat, by_vendor, by_month, src = aggregate(records, cc)
    total = sum(v[1] for v in by_cat.values())

    # ---------- サマリ ----------
    section(ws, 3, "■ サマリ（データソース別）")
    r = write_header(ws, 4, ["区分", "件数", "金額"])
    s_first = r
    r = write_row(ws, r, ["領収書（贈答・農産物等）", src["receipt"][0], src["receipt"][1]],
                  number_cols={3})
    r = write_row(ws, r, ["クレジット（会食・贈答）", src["credit"][0], src["credit"][1]],
                  number_cols={3})
    write_row(ws, r, ["合計", f"=SUM(B{s_first}:B{r - 1})", f"=SUM(C{s_first}:C{r - 1})"],
              number_cols={3}, bold=True, fill=SUBHEADER_FILL)

    # ---------- 種別内訳 ----------
    sec2 = r + 3
    section(ws, sec2, "■ 種別ごとの内訳")
    cr = write_header(ws, sec2 + 1, ["種別", "件数", "金額", "シェア"])
    c_first = cr
    for cat, (n, amt) in sorted(by_cat.items(), key=lambda kv: -kv[1][1]):
        cr = write_row(ws, cr, [cat, n, amt, (amt / total if total else 0)],
                       number_cols={3}, pct_cols={4})
    c_last = cr - 1
    write_row(ws, cr, ["合計", f"=SUM(B{c_first}:B{c_last})",
                       f"=SUM(C{c_first}:C{c_last})", 1],
              number_cols={3}, pct_cols={4}, bold=True, fill=SUBHEADER_FILL)

    # ---------- 取引先ランキング ----------
    sec3 = cr + 3
    section(ws, sec3, "■ 取引先別ランキング（TOP 20）")
    vr = write_header(ws, sec3 + 1, ["順位", "取引先", "種別", "回数", "金額"])
    ranked = sorted(by_vendor.items(), key=lambda kv: -kv[1][2])[:20]
    for i, (v, (cat, n, amt)) in enumerate(ranked, 1):
        vr = write_row(ws, vr, [i, v, cat, n, amt], number_cols={5})

    # ---------- 月別推移 ----------
    sec4 = vr + 2
    section(ws, sec4, "■ 月別 推移")
    mr = write_header(ws, sec4 + 1, ["月度", "件数", "金額"])
    m_first = mr
    for m in sorted(by_month):
        n, amt = by_month[m]
        mr = write_row(ws, mr, [m, n, amt], number_cols={3})
    write_row(ws, mr, ["合計", f"=SUM(B{m_first}:B{mr - 1})",
                       f"=SUM(C{m_first}:C{mr - 1})"],
              number_cols={3}, bold=True, fill=SUBHEADER_FILL)

    # ---------- グラフ ----------
    pie = PieChart()
    pie.title = "接待交際費 種別シェア"
    pie.height = 11
    pie.width = 13
    pd = Reference(ws, min_col=3, min_row=c_first, max_row=c_last)
    pc = Reference(ws, min_col=1, min_row=c_first, max_row=c_last)
    pie.add_data(pd, titles_from_data=False)
    pie.set_categories(pc)
    pie.dataLabels = DataLabelList()
    pie.dataLabels.showPercent = True
    ws.add_chart(pie, "G4")

    gift = by_cat.get("贈答（高島屋・松幸農産等）", [0, 0])
    dining = by_cat.get("会食（焼肉・寿司・バル等）", [0, 0])
    peak = max(by_month.items(), key=lambda kv: kv[1][1]) if by_month else ("-", [0, 0])
    note_block(ws, mr + 3, [
        "📝 接待交際費の特徴",
        f"• 合計 ¥{total:,}（領収書＋クレジット事業分）",
        f"• 贈答 ¥{gift[1]:,}（{gift[0]}件） / 会食 ¥{dining[1]:,}（{dining[0]}件）",
        f"• ピーク月は {peak[0]} の ¥{peak[1][1]:,}",
        "• 高島屋系はお中元・お歳暮の贈答品が中心",
        "• 単価の低い飲食（ハマ寿司等）が多数ある場合は、福利厚生費への再分類を検討する余地があります",
        "",
        "📌 区分の判定ルール",
        "• 贈答: 「高島屋」「松幸」「百貨店」「ギフト」等を含む取引先",
        "• 会食: 「焼肉」「寿司」「バル」「ステーキ」「食堂」「酒場」等を含む取引先",
        "• その他: 上記いずれにも当てはまらないもの",
    ])

    set_widths(ws, {"A": 12, "B": 44, "C": 26, "D": 10, "E": 14, "F": 14})
    return ws
