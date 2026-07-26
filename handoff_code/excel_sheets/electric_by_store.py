"""
電気代_店舗別分析 シート

オリコ明細の「カ グリムス」には店舗名が入らないため、検針日（利用日の日）から
4店舗を推定する。推定ロジックは infer_grimms_stores() に集約し、
電気代_削減シミュレーション シートからも再利用する。
"""

import re
from collections import defaultdict

from openpyxl.chart import BarChart, Reference

from config import STORES
from ._common import (
    new_sheet, set_title, section, set_widths, write_header, write_row,
    note_block, NORMAL_FONT, BOLD_FONT, SUBHEADER_FILL, WARNING_FILL,
    BORDER, YEN, PCT,
)


SHEET_NAME = "電気代_店舗別分析"

# 検針日帯 → 店舗（handoff 6.3）。日帯は重なるため、
# 「利用月内での検針日の早い順」を主判定、日帯は裏付けとして併記する。
STORE_SEQUENCE = [
    ("ひかり調剤薬局(志摩)", "月初(6〜13日)検針", "売上最大・メイン店"),
    ("ひかり薬局(松阪/射和)", "早中旬(9〜13日)検針", "標準店"),
    ("ひかりファーマシー(神久)", "中旬(13〜16日)検針", "在宅医療対応・冷蔵設備多"),
    ("ひかりハート薬局(伊勢/岡本)", "下旬(24〜27日)検針", "2026/1-2で欠落→解約と一致"),
]

# 岡本(ひかりハート薬局)の解約により引落が欠落する利用月
HEART_CANCELLED_MONTHS = {"2026/01", "2026/02"}

DAY_BANDS = {
    "ひかり調剤薬局(志摩)": (6, 13),
    "ひかり薬局(松阪/射和)": (9, 13),
    "ひかりファーマシー(神久)": (13, 16),
    "ひかりハート薬局(伊勢/岡本)": (24, 27),
}


def _parse_date(s):
    """'2025年7月8日' → (2025, 7, 8)"""
    m = re.match(r"(\d+)年(\d+)月(\d+)日", s or "")
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def infer_grimms_stores(cc):
    """
    グリムス（電力会社）のクレジット明細に店舗を推定して付与する。

    推定ロジック:
      1. 利用日から「利用月（YYYY/MM）」を作る
      2. 利用月ごとに検針日（日）の昇順に並べる
      3. 早い順に 志摩 → 松阪 → 神久 → 岡本 を割り当てる
         （handoff 6.3 の検針日帯と整合。日帯が重なるケースは順序で解決）
      4. 岡本は 2026/01・2026/02 が解約により欠落するため、
         その月は3件しかなく 志摩/松阪/神久 の3店舗に割り当たる

    Returns:
        [{"usage_month", "date", "day", "store", "amount", "payment_month", "band"}]
    """
    rows = []
    by_month = defaultdict(list)
    for r in cc:
        if "グリムス" not in (r.get("vendor") or ""):
            continue
        if not r.get("amount"):
            continue
        parsed = _parse_date(r.get("date"))
        if not parsed:
            continue
        y, mo, d = parsed
        by_month[f"{y}/{mo:02d}"].append((d, r))

    for usage_month in sorted(by_month):
        entries = sorted(by_month[usage_month], key=lambda x: x[0])
        for idx, (day, r) in enumerate(entries):
            if idx < len(STORE_SEQUENCE):
                store = STORE_SEQUENCE[idx][0]
            else:
                store = "不明"
            lo, hi = DAY_BANDS.get(store, (0, 31))
            band_ok = lo <= day <= hi
            rows.append({
                "usage_month": usage_month,
                "date": f"{usage_month}/{day:02d}",
                "day": day,
                "store": store,
                "amount": r["amount"],
                "payment_month": r.get("payment_month") or "",
                "band": f"{lo}〜{hi}日" + ("" if band_ok else " ※日帯外"),
            })
    return rows


def summarize(rows):
    """店舗別サマリ / 店舗×利用月マトリクス を返す"""
    by_store = defaultdict(list)
    matrix = defaultdict(dict)
    months = sorted({r["usage_month"] for r in rows})
    for r in rows:
        by_store[r["store"]].append(r["amount"])
        matrix[r["store"]][r["usage_month"]] = r["amount"]
    return by_store, matrix, months


def create_sheet(wb, records=None, cc=None):
    ws = new_sheet(wb, SHEET_NAME)
    set_title(ws, "⚡ 電気代（グリムス）店舗別分析", "A1:M1")

    rows = infer_grimms_stores(cc or [])
    by_store, matrix, months = summarize(rows)
    grand = sum(r["amount"] for r in rows)

    # ---------- 推定根拠 ----------
    section(ws, 3, "■ 店舗推定の根拠")
    note_block(ws, 4, [
        "クレジット明細では「カ グリムス」だけで店舗名が分からないため、複数の手がかりから推定しています：",
        "① 検針日帯（利用月内で4店舗の検針日が月初→下旬の順に並ぶ）",
        "② 金額レベル（売上規模＝営業時間＝電気使用量と相関）",
        "③ 店舗特性（在宅医療対応のひかりファーマシーは冷蔵設備が多い）",
        "④ 岡本のひかりハート薬局は2026年3月解約工事 → 2026/01・02の欠落と一致",
        "⑤ 割当は「利用月内で検針日の早い順に 志摩→松阪→神久→岡本」で行っています",
    ])

    # 検針日帯の対応表
    band_hdr = 11
    section(ws, band_hdr - 1, "■ 検針日帯と店舗の対応")
    r = write_header(ws, band_hdr, ["検針日帯", "推定店舗", "月平均（実データ）", "根拠"])
    for store, band, reason in STORE_SEQUENCE:
        amts = by_store.get(store, [])
        avg = sum(amts) // len(amts) if amts else 0
        r = write_row(ws, r, [band, store, avg, reason], number_cols={3})

    # ---------- 店舗別サマリ ----------
    sec2 = r + 2
    section(ws, sec2, "■ 店舗別 サマリ")
    shdr = sec2 + 1
    rr = write_header(ws, shdr, ["店舗名", "件数", "合計金額", "月平均", "最大月", "最小月", "シェア"])
    s_first = rr
    for store, band, reason in STORE_SEQUENCE:
        amts = by_store.get(store, [])
        if not amts:
            continue
        rr = write_row(ws, rr, [
            store, len(amts), sum(amts), sum(amts) // len(amts),
            max(amts), min(amts), (sum(amts) / grand if grand else 0),
        ], number_cols={3, 4, 5, 6}, pct_cols={7})
    s_last = rr - 1
    write_row(ws, rr, ["合計", f"=SUM(B{s_first}:B{s_last})",
                       f"=SUM(C{s_first}:C{s_last})", "", "", "", 1],
              number_cols={3}, pct_cols={7}, bold=True, fill=SUBHEADER_FILL)

    # ---------- 店舗別 月次推移 ----------
    sec3 = rr + 3
    section(ws, sec3, "■ 店舗別 月次推移（利用月ベース）")
    mhdr = sec3 + 1
    store_names = [s[0] for s in STORE_SEQUENCE]
    write_header(ws, mhdr, ["利用月"] + store_names + ["月合計"])
    mr = mhdr + 1
    m_first = mr
    for m in months:
        ws.cell(row=mr, column=1, value=m).font = NORMAL_FONT
        ws.cell(row=mr, column=1).border = BORDER
        for j, st in enumerate(store_names, 2):
            v = matrix.get(st, {}).get(m)
            if v is None:
                cell = ws.cell(row=mr, column=j, value="(解約)")
                cell.fill = WARNING_FILL
            else:
                cell = ws.cell(row=mr, column=j, value=v)
                cell.number_format = YEN
            cell.font = NORMAL_FONT
            cell.border = BORDER
        c = ws.cell(row=mr, column=len(store_names) + 2,
                    value=f"=SUM(B{mr}:{chr(ord('A') + len(store_names))}{mr})")
        c.number_format = YEN
        c.font = BOLD_FONT
        c.border = BORDER
        mr += 1
    m_last = mr - 1
    ws.cell(row=mr, column=1, value="合計").font = BOLD_FONT
    ws.cell(row=mr, column=1).fill = SUBHEADER_FILL
    ws.cell(row=mr, column=1).border = BORDER
    for j in range(2, len(store_names) + 3):
        col = chr(ord("A") + j - 1)
        c = ws.cell(row=mr, column=j, value=f"=SUM({col}{m_first}:{col}{m_last})")
        c.number_format = YEN
        c.font = BOLD_FONT
        c.fill = SUBHEADER_FILL
        c.border = BORDER
    matrix_total_row = mr

    # ---------- グラフ ----------
    chart = BarChart()
    chart.type = "col"
    chart.grouping = "stacked"
    chart.overlap = 100
    chart.title = "電気代 店舗別 月次推移（積上げ）"
    chart.height = 12
    chart.width = 24
    chart.y_axis.number_format = "#,##0"
    d = Reference(ws, min_col=2, min_row=mhdr, max_col=1 + len(store_names), max_row=m_last)
    cats = Reference(ws, min_col=1, min_row=m_first, max_row=m_last)
    chart.add_data(d, titles_from_data=True)
    chart.set_categories(cats)
    ws.add_chart(chart, f"H{sec3}")

    # ---------- 考察 ----------
    top_store = max(by_store.items(), key=lambda kv: sum(kv[1]) / len(kv[1]))
    top_avg = sum(top_store[1]) // len(top_store[1])
    others = [sum(v) // len(v) for k, v in by_store.items() if k != top_store[0]]

    sec4 = matrix_total_row + 3
    section(ws, sec4, f"■ なぜ「{top_store[0]}」だけが高いのか？")
    note_block(ws, sec4 + 1, [
        f"月平均¥{top_avg:,}（他店 ¥{min(others):,}〜¥{max(others):,}）の理由を考察",
        "",
        "① 【売場面積が広い】 メイン店として広い → 照明・冷暖房の負荷が大きい",
        "② 【営業時間が長い】 早朝〜夜の長時間営業で稼働時間が長い可能性",
        "③ 【冷蔵庫・冷凍庫が多い】 医薬品保管の冷蔵設備が多い（24時間稼働）",
        "④ 【PC・機器類が多い】 タブレット・モニター・プリンター等の機器数",
        f"⑤ 【季節変動の幅が大きい】 最大¥{max(top_store[1]):,} vs 最小¥{min(top_store[1]):,} → エアコン依存度が高い",
        "⑥ 【調剤機器の電力】 メイン店に大型調剤機器（自動分包機等）があれば消費電力大",
        "",
        "💡 削減ヒント（詳細は「電気代_削減シミュレーション」シート）:",
        "  • 夏冬の空調設定（28℃/20℃推奨）の見直し",
        "  • LED照明への切り替え（未対応であれば）",
        "  • 待機電力（プリンター等のスリープ運用）",
        "  • 太陽光発電パネル導入の検討（投資回収7〜10年）",
    ])

    # ---------- 全引落明細 ----------
    sec5 = sec4 + 18
    section(ws, sec5, "■ 全引落明細（推定店舗つき）")
    dhdr = sec5 + 1
    dr = write_header(ws, dhdr, ["利用月", "検針日", "推定店舗", "金額", "支払月", "該当日帯"])
    d_first = dr
    for row in rows:
        dr = write_row(ws, dr, [
            row["usage_month"], row["date"], row["store"], row["amount"],
            row["payment_month"], row["band"],
        ], number_cols={4})
    write_row(ws, dr, ["合計", "", "", f"=SUM(D{d_first}:D{dr - 1})", "", ""],
              number_cols={4}, bold=True, fill=SUBHEADER_FILL)

    set_widths(ws, {"A": 14, "B": 26, "C": 24, "D": 24, "E": 26, "F": 20,
                    "G": 12, "H": 12, "I": 12, "J": 12, "K": 12, "L": 12, "M": 12})
    return ws
