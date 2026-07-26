"""
お客様決済_店舗別売上 シート

PayPay は店舗別MID→店舗名のマッピングがあるため店舗×月の完全データを持てる。
Airペイ / メルペイ は店舗別に分解できないため、判明分を参考データとして併記する。
"""

import re
from collections import defaultdict

from openpyxl.chart import BarChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList

from config import TARGET_MONTHS, STORES
from ._common import (
    new_sheet, set_title, section, set_widths, write_header, write_row,
    note_block, NORMAL_FONT, BOLD_FONT, SUBHEADER_FILL, WARNING_FILL,
    BORDER, YEN, PCT,
)


SHEET_NAME = "お客様決済_店舗別売上"

# 店舗別に分解できない決済サービスの判定パターン
OTHER_SERVICE_PATTERNS = [
    ("Airペイ QR", r"エアペイQR|AirペイQR|エアペイ.*QR|コード決済"),
    ("Airメイト", r"エアメイト|Airメイト"),
    ("Airペイ（クレジット）", r"エアペイ|Airペイ"),
    ("メルペイ", r"メル[ぺペ]イ"),
    ("メルカリ", r"メルカリ"),
]


def classify_other_service(filename):
    for name, pat in OTHER_SERVICE_PATTERNS:
        if re.search(pat, filename or "", re.IGNORECASE):
            return name
    return None


def find_out_of_range(paypay):
    """
    TARGET_MONTHS の外に落ちている PayPay データを拾う。

    元PDFのファイル名の年が誤っている（例: 20260201 とすべきところが 20250201）
    ケースがあり、そのまま集計すると金額が黙って欠落するため、
    シート上に明示して運用側が元ファイル名を直せるようにする。
    """
    out = []
    for kind, block in (("売上", paypay.get("sales", {})),
                        ("手数料", paypay.get("fees", {}))):
        for store, months in block.items():
            for m, amt in months.items():
                if m not in TARGET_MONTHS:
                    out.append((kind, store, m, amt))
    out.sort()
    return out


def collect_other_services(records):
    """PayPay以外の決済サービスのレコードを拾う（店舗別分解不可）"""
    rows = []
    totals = defaultdict(int)
    for r in records:
        acct = r.get("account") or ""
        if not acct.startswith("売上"):
            continue
        if not r.get("amount"):
            continue
        fn = r.get("filename") or ""
        if re.search(r"paypay|ペイペイ", fn, re.IGNORECASE):
            continue
        svc = classify_other_service(fn)
        if not svc:
            continue
        rows.append((fn, r.get("month") or "-", svc, r["amount"]))
        totals[svc] += r["amount"]
    rows.sort(key=lambda x: (x[1], -x[3]))
    return rows, dict(totals)


def create_sheet(wb, records, cc=None, paypay=None):
    ws = new_sheet(wb, SHEET_NAME)
    set_title(ws, "💳 お客様決済（PayPay/メルペイ/Airペイ）店舗別売上", "A1:I1")

    paypay = paypay or {}
    sales = paypay.get("sales", {})
    fees = paypay.get("fees", {})

    pp_total = sum(sum(v.values()) for v in sales.values())
    pp_fee_total = sum(sum(v.values()) for v in fees.values())

    other_rows, other_totals = collect_other_services(records)

    # ---------- サマリ ----------
    section(ws, 3, "■ サマリ")
    r = write_header(ws, 4, ["決済サービス", "売上合計\n（10ヶ月）", "月平均", "把握状況", "備考"])

    summary_first = r
    r = write_row(ws, r, ["PayPay", pp_total, pp_total // 10, "詳細データあり",
                          f"{len(sales)}店舗の月次データ判明（MID→店舗名の対応あり）"],
                  number_cols={2, 3})
    for svc, amt in sorted(other_totals.items(), key=lambda kv: -kv[1]):
        r = write_row(ws, r, [svc, amt, amt // 10, "全店舗合算のみ",
                              "店舗別MIDの対応表がなく、店舗単位に分解できません"],
                      number_cols={2, 3})
    summary_last = r - 1

    total_r = r
    write_row(ws, total_r, ["合計",
                            f"=SUM(B{summary_first}:B{summary_last})",
                            f"=SUM(C{summary_first}:C{summary_last})", "", ""],
              number_cols={2, 3}, bold=True, fill=SUBHEADER_FILL)

    # ---------- PayPay 店舗別 × 月別 ----------
    sec2 = total_r + 3
    section(ws, sec2, "■ PayPay 店舗別 × 月別 入金額（詳細データ）")
    hdr = sec2 + 1
    write_header(ws, hdr, ["店舗"] + TARGET_MONTHS + ["合計", "月平均"])

    store_order = [s["name"] for s in STORES if s["name"] in sales]
    store_order += [s for s in sales if s not in store_order]

    rr = hdr + 1
    pp_first = rr
    ncol = 1 + len(TARGET_MONTHS)
    for st in store_order:
        ws.cell(row=rr, column=1, value=st).font = NORMAL_FONT
        ws.cell(row=rr, column=1).border = BORDER
        for j, m in enumerate(TARGET_MONTHS, 2):
            c = ws.cell(row=rr, column=j, value=sales.get(st, {}).get(m, 0))
            c.number_format = YEN
            c.font = NORMAL_FONT
            c.border = BORDER
        c = ws.cell(row=rr, column=ncol + 1, value=f"=SUM(B{rr}:K{rr})")
        c.number_format = YEN
        c.font = BOLD_FONT
        c.border = BORDER
        c = ws.cell(row=rr, column=ncol + 2, value=f"=ROUND(L{rr}/{len(TARGET_MONTHS)},0)")
        c.number_format = YEN
        c.font = NORMAL_FONT
        c.border = BORDER
        rr += 1
    pp_last = rr - 1

    pp_total_row = rr
    ws.cell(row=pp_total_row, column=1, value="月合計").font = BOLD_FONT
    ws.cell(row=pp_total_row, column=1).fill = SUBHEADER_FILL
    ws.cell(row=pp_total_row, column=1).border = BORDER
    for j in range(2, ncol + 3):
        col = chr(ord("A") + j - 1)
        c = ws.cell(row=pp_total_row, column=j, value=f"=SUM({col}{pp_first}:{col}{pp_last})")
        c.number_format = YEN
        c.font = BOLD_FONT
        c.fill = SUBHEADER_FILL
        c.border = BORDER

    # ---------- PayPay 手数料 ----------
    sec3 = pp_total_row + 2
    section(ws, sec3, "■ PayPay 決済手数料（店舗別）")
    fhdr = sec3 + 1
    write_header(ws, fhdr, ["店舗", "手数料合計", "売上合計", "手数料率"])
    fr = fhdr + 1
    f_first = fr
    for st in store_order:
        fee = sum(fees.get(st, {}).values())
        sal = sum(sales.get(st, {}).values())
        ws.cell(row=fr, column=1, value=st).font = NORMAL_FONT
        c = ws.cell(row=fr, column=2, value=fee); c.number_format = YEN
        c = ws.cell(row=fr, column=3, value=sal); c.number_format = YEN
        c = ws.cell(row=fr, column=4, value=f"=IF(C{fr}=0,0,B{fr}/C{fr})")
        c.number_format = PCT
        for ci in range(1, 5):
            cell = ws.cell(row=fr, column=ci)
            cell.border = BORDER
            if cell.font.name is None:
                cell.font = NORMAL_FONT
        fr += 1
    f_last = fr - 1
    write_row(ws, fr, ["合計", f"=SUM(B{f_first}:B{f_last})",
                       f"=SUM(C{f_first}:C{f_last})",
                       f"=IF(C{fr}=0,0,B{fr}/C{fr})"],
              number_cols={2, 3}, pct_cols={4}, bold=True, fill=SUBHEADER_FILL)

    # ---------- グラフ ----------
    bar = BarChart()
    bar.type = "col"
    bar.grouping = "stacked"
    bar.overlap = 100
    bar.title = "PayPay 店舗別 月次入金額（積上げ）"
    bar.height = 11
    bar.width = 22
    bar.y_axis.number_format = "#,##0"
    d = Reference(ws, min_col=2, min_row=hdr, max_col=ncol, max_row=pp_last)
    cats = Reference(ws, min_col=1, min_row=pp_first, max_row=pp_last)
    bar.add_data(d, titles_from_data=True, from_rows=True)
    bar.set_categories(cats)
    ws.add_chart(bar, f"A{fr + 3}")

    pie = PieChart()
    pie.title = "PayPay 店舗別 シェア"
    pie.height = 11
    pie.width = 13
    pd = Reference(ws, min_col=ncol + 1, min_row=pp_first, max_row=pp_last)
    pc = Reference(ws, min_col=1, min_row=pp_first, max_row=pp_last)
    pie.add_data(pd, titles_from_data=False)
    pie.set_categories(pc)
    pie.dataLabels = DataLabelList()
    pie.dataLabels.showPercent = True
    ws.add_chart(pie, f"L{fr + 3}")

    # ---------- 対象期間外データ（ファイル名の年誤り疑い） ----------
    oor = find_out_of_range(paypay)
    sec_oor = fr + 26
    if oor:
        section(ws, sec_oor, "⚠️ 対象期間外に落ちている PayPay データ（元ファイル名の年の誤り疑い）")
        c = ws.cell(row=sec_oor + 1, column=1,
                    value="下記は TARGET_MONTHS の範囲外のため上表に含まれていません。"
                          "元PDFのファイル名の年を修正のうえ再抽出してください。")
        c.fill = WARNING_FILL
        ohdr0 = sec_oor + 2
        orow0 = write_header(ws, ohdr0, ["区分", "店舗", "検出された月度", "金額"])
        for kind, store, m, amt in oor:
            orow0 = write_row(ws, orow0, [kind, store, m, amt],
                              number_cols={4}, fill=WARNING_FILL)
        sec4 = orow0 + 2
    else:
        sec4 = sec_oor

    # ---------- Airペイ/メルペイ 参考データ ----------
    section(ws, sec4, "■ Airペイ系・メルペイ 判明分の参考データ（店舗別分解不可）")
    ohdr = sec4 + 1
    write_header(ws, ohdr, ["ファイル名", "月度", "サービス", "金額"])
    orow = ohdr + 1
    for fn, m, svc, amt in other_rows:
        orow = write_row(ws, orow, [fn, m, svc, amt], number_cols={4})

    # ---------- 注釈 ----------
    ranked = sorted(((st, sum(sales.get(st, {}).values())) for st in store_order),
                    key=lambda x: -x[1])
    no_paypay = [s["name"] for s in STORES if not s.get("paypay_mid")]

    notes = ["🔍 重要な気付き", ""]
    for i, (st, amt) in enumerate(ranked, 1):
        share = amt / pp_total if pp_total else 0
        notes.append(f"{i}️⃣ {st}　¥{amt:,} ({share:.1%})")
    notes += [
        "",
        f"• PayPay売上首位は {ranked[0][0]} " if ranked else "",
        f"• {'/'.join(no_paypay)} はPayPay未契約（MIDなし）のため本表に現れません",
        f"• PayPay手数料 合計¥{pp_fee_total:,} / 売上¥{pp_total:,} = "
        f"{(pp_fee_total / pp_total if pp_total else 0):.2%}",
        "",
        "📝 注釈",
    ] + ([
        f"• ⚠️ 対象期間外に {len(oor)}件（計¥{sum(x[3] for x in oor):,}）のPayPayデータがあります。",
        "  元PDFのファイル名の年が誤っている可能性が高く、修正すると上表の金額が増えます。",
    ] if oor else []) + [
        "• PayPay は店舗別の支払明細書PDFがあり、MID→店舗名の対応から店舗×月の完全データが取れています",
        "• Airペイ系は全店舗合算と店舗別が混在しており、店舗別の精密な集計には管理画面の確認が必要です",
        "• 本シートでは Airペイ を店舗按分せず、全店舗合算の判明値のみを掲載しています（推測値を作らない方針）",
        "",
        "💡 より正確なデータが必要な場合：",
        "  - Airメイト管理画面で店舗別フィルターが可能",
        "  - PayPay for Business で店舗別CSV出力が可能",
        "  - メルペイ管理画面で月次CSV出力が可能",
    ]
    note_block(ws, orow + 2, [n for n in notes if n != ""] or [""])

    set_widths(ws, {"A": 34, "B": 13, "C": 13, "D": 13, "E": 13, "F": 13,
                    "G": 13, "H": 13, "I": 13, "J": 13, "K": 13, "L": 14, "M": 13})
    ws.freeze_panes = "B5"
    return ws
