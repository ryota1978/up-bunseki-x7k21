"""
通信費_内訳分析 シート

領収書（プロジェクト側）とクレジット（オリコ）の両方から通信費を集約し、
取引先別の月次推移・シェア・サービス種別内訳を出す。
"""

import re
from collections import defaultdict

from openpyxl.chart import BarChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.utils import get_column_letter

from config import TARGET_MONTHS
from ._common import (
    new_sheet, set_title, section, set_widths, write_header, write_row,
    note_block, month_cross_table, SUBHEADER_FILL, YEN, PCT,
)


SHEET_NAME = "通信費_内訳分析"

# 取引先名の正規化（領収書のvendor/tag と クレジットのtag を1つの名前に寄せる）
VENDOR_ALIASES = [
    ("NTT（固定電話/光回線/モバイル）", [r"NTT", r"ドコモ", r"ニシニホン"]),
    ("DMM（挟間研至さん会員費）", [r"DMM"]),
    ("ChatGPT（OpenAI）", [r"ChatGPT", r"OpenAI", r"ＣＨＡＴＧＰＴ", r"ＯＰＥＮＡＩ"]),
    ("Claude（Anthropic）", [r"Claude", r"Anthropic", r"ＣＬＡＵＤＥ"]),
    ("Apple", [r"Apple", r"ＡＰＰＬＥ", r"iCloud"]),
    ("Google/YouTube", [r"Google", r"YouTube", r"ＧＯＯＧＬＥ", r"ＹＯＵＴＵＢＥ"]),
    ("ジョブカン", [r"ジョブカン", r"ジヨブカン"]),
    ("Zoom", [r"Zoom", r"ＺＯＯＭ"]),
    ("LINE WORKS", [r"ラインワークス", r"LINE.?WORKS", r"ライン.*ワークス"]),
    ("ユージェイ（HP維持費）", [r"ユージェイ", r"^UJ$"]),
    ("USEN（BGM）", [r"USEN", r"ユウセン"]),
    ("X（旧Twitter）", [r"^X（", r"X.?CORP", r"旧Twitter"]),
    ("RayL（モバイル）", [r"RayL", r"レイル"]),
    ("フラッシュモバイル", [r"フラッシュモバイル"]),
    ("ハイホー（プロバイダ）", [r"ハイホー", r"プロバイダ"]),
    ("Pollo AI", [r"Pollo", r"ＰＯＬＬＯ"]),
    ("Dropbox", [r"Dropbox", r"ＤＲＯＰＢＯＸ"]),
    ("Remember the Milk", [r"Remember", r"ＲＭＩＬＫ"]),
    ("ガスパル", [r"ガスパル"]),
]

# サービス種別の分類
SERVICE_TYPES = {
    "通信回線（固定/モバイル/プロバイダ）": [
        "NTT（固定電話/光回線/モバイル）", "RayL（モバイル）",
        "フラッシュモバイル", "ハイホー（プロバイダ）",
    ],
    "業務SaaS": ["ジョブカン", "Zoom", "LINE WORKS", "Dropbox", "Remember the Milk", "Apple"],
    "AIサービス": ["ChatGPT（OpenAI）", "Claude（Anthropic）", "Pollo AI"],
    "会員費": ["DMM（挟間研至さん会員費）"],
    "HP維持費": ["ユージェイ（HP維持費）"],
    "BGM/その他": ["USEN（BGM）", "ガスパル"],
    "SNS/動画": ["Google/YouTube", "X（旧Twitter）"],
}


def normalize_vendor(*candidates):
    """vendor / tag / filename のいずれかから正規化した取引先名を得る"""
    blob = " ".join(c for c in candidates if c)
    for name, pats in VENDOR_ALIASES:
        for p in pats:
            if re.search(p, blob, re.IGNORECASE):
                return name
    return "その他通信"


def service_type_of(vendor):
    for st, members in SERVICE_TYPES.items():
        if vendor in members:
            return st
    return "BGM/その他"


def aggregate(records, cc):
    """取引先 × 月 の通信費集計（領収書＋クレジット）"""
    data = defaultdict(lambda: defaultdict(int))
    counts = {"receipt": 0, "credit": 0}
    totals = {"receipt": 0, "credit": 0}

    for r in records:
        if r.get("account") != "通信費" or not r.get("amount"):
            continue
        m = r.get("month")
        if m not in TARGET_MONTHS:
            continue
        v = normalize_vendor(r.get("vendor"), r.get("tag"), r.get("filename"))
        data[v][m] += r["amount"]
        counts["receipt"] += 1
        totals["receipt"] += r["amount"]

    for r in cc:
        if r.get("account") != "通信費" or not r.get("amount"):
            continue
        if r.get("biz_flag") == "私的（家族）":
            continue
        m = r.get("payment_month")
        if m not in TARGET_MONTHS:
            continue
        v = normalize_vendor(r.get("tag"), r.get("vendor"))
        data[v][m] += r["amount"]
        counts["credit"] += 1
        totals["credit"] += r["amount"]

    return {k: dict(v) for k, v in data.items()}, counts, totals


def create_sheet(wb, records, cc):
    ws = new_sheet(wb, SHEET_NAME)
    set_title(ws, "📞 通信費 取引先別 詳細内訳（領収書＋クレジット）")

    data, counts, totals = aggregate(records or [], cc or [])
    grand = totals["receipt"] + totals["credit"]

    # ---------- サマリ ----------
    section(ws, 3, "■ サマリ")
    r = write_header(ws, 4, ["区分", "件数", "金額"])
    r = write_row(ws, r, ["領収書（プロジェクト側）", counts["receipt"], totals["receipt"]],
                  number_cols={3})
    r = write_row(ws, r, ["クレジット（オリコ）", counts["credit"], totals["credit"]],
                  number_cols={3})
    write_row(ws, r, ["合計", f"=SUM(B5:B{r - 1})", f"=SUM(C5:C{r - 1})"],
              number_cols={3}, bold=True, fill=SUBHEADER_FILL)

    # ---------- 取引先別 月次推移 ----------
    sec2 = r + 3
    section(ws, sec2, "■ 取引先別 月次推移")
    hdr, first, last, total_row, total_col = month_cross_table(
        ws, sec2 + 1, "取引先", data
    )

    # ---------- サービス種別 ----------
    sec3 = total_row + 3
    section(ws, sec3, "■ サービス種別ごとの内訳")
    st_totals = defaultdict(int)
    for v, monthly in data.items():
        st_totals[service_type_of(v)] += sum(monthly.values())
    sr = write_header(ws, sec3 + 1, ["サービス種別", "金額", "シェア"])
    st_first = sr
    for st, amt in sorted(st_totals.items(), key=lambda kv: -kv[1]):
        sr = write_row(ws, sr, [st, amt, (amt / grand if grand else 0)],
                       number_cols={2}, pct_cols={3})
    st_last = sr - 1
    write_row(ws, sr, ["合計", f"=SUM(B{st_first}:B{st_last})", 1],
              number_cols={2}, pct_cols={3}, bold=True, fill=SUBHEADER_FILL)

    # ---------- グラフ3種 ----------
    bar = BarChart()
    bar.type = "bar"
    bar.title = "通信費 取引先別 全期間合計"
    bar.height = 12
    bar.width = 16
    bar.y_axis.number_format = "#,##0"
    ncol = 1 + len(TARGET_MONTHS) + 1
    bd = Reference(ws, min_col=ncol, min_row=first, max_row=last)
    bc = Reference(ws, min_col=1, min_row=first, max_row=last)
    bar.add_data(bd, titles_from_data=False)
    bar.set_categories(bc)
    ws.add_chart(bar, f"A{sr + 3}")

    pie = PieChart()
    pie.title = "通信費 シェア（全期間合計）"
    pie.height = 12
    pie.width = 14
    pie.add_data(bd, titles_from_data=False)
    pie.set_categories(bc)
    pie.dataLabels = DataLabelList()
    pie.dataLabels.showPercent = True
    ws.add_chart(pie, f"J{sr + 3}")

    pie2 = PieChart()
    pie2.title = "通信費 サービス種別シェア"
    pie2.height = 12
    pie2.width = 14
    p2d = Reference(ws, min_col=2, min_row=st_first, max_row=st_last)
    p2c = Reference(ws, min_col=1, min_row=st_first, max_row=st_last)
    pie2.add_data(p2d, titles_from_data=False)
    pie2.set_categories(p2c)
    pie2.dataLabels = DataLabelList()
    pie2.dataLabels.showPercent = True
    ws.add_chart(pie2, f"A{sr + 28}")

    ntt = sum(data.get("NTT（固定電話/光回線/モバイル）", {}).values())
    note_block(ws, sr + 54, [
        "📝 注釈",
        f"• 通信費 合計 ¥{grand:,}（領収書 ¥{totals['receipt']:,} ＋ クレジット ¥{totals['credit']:,}）",
        f"• 最大コストは NTT系 ¥{ntt:,}（全体の{(ntt / grand if grand else 0):.1%}）→ 「NTT料金_削減提案」シート参照",
        "• ChatGPT は $22/月の実額（¥312〜¥314/月）で補正済み（amount_corrections.py）",
        "• フラッシュモバイル・RayL もファイル名からの金額誤読を固定値で補正済み",
        "• ガスパルは事務所契約のため便宜上 通信費 に分類しています（要確認）",
    ])

    set_widths(ws, {"A": 34, **{get_column_letter(i): 13 for i in range(2, len(TARGET_MONTHS) + 3)}})
    ws.freeze_panes = "B5"
    return ws
