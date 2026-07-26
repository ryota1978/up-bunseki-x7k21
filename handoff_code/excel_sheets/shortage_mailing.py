"""
不足薬郵送_在庫指標 シート

不足薬の他店舗・他薬局への郵送コストを「在庫を絞りすぎていないか」の
指標として運用するためのテンプレートシート。

判明している郵送関連の実データ（日本郵便・ヤマト等）は自動で拾って掲載し、
以降は各店舗の管理薬剤師が黄色セルに毎月入力する運用を想定する。
"""

import re
from collections import defaultdict

from config import TARGET_MONTHS, STORES
from ._common import (
    new_sheet, set_title, section, set_widths, write_header, write_row,
    note_block, SUBHEADER_FILL, WARNING_FILL, BORDER, NORMAL_FONT, BOLD_FONT,
    YEN, YEN_MARK,
)


SHEET_NAME = "不足薬郵送_在庫指標"

MAILING_PATTERNS = [
    r"郵便", r"ユウビン", r"切手", r"レターパック", r"ヤマト", r"クロネコ",
    r"宅急便", r"佐川", r"ゆうパック", r"送料", r"郵送",
]

# テンプレートを用意する直近月数
TEMPLATE_MONTHS = 6

# 判定基準
THRESHOLDS = [
    ("1店舗あたり月の郵送回数", "0〜4回/月", "良好", "🟢 在庫は適正水準"),
    ("1店舗あたり月の郵送回数", "5〜10回/月", "要注意", "🟡 在庫やや絞りすぎ"),
    ("1店舗あたり月の郵送回数", "10回超/月", "問題", "🔴 在庫絞りすぎ＋発注見直し必要"),
    ("店舗別の郵送費比較", "他店の2倍以上", "偏り大", "🔴 該当店舗の在庫プロセス見直し"),
    ("月次トレンド", "増加傾向", "悪化", "🟡 発注量見直し検討"),
    ("月次トレンド", "減少傾向", "改善", "🟢 在庫補充タイミングが適切"),
]

# 在庫 vs 郵送代 のトレードオフ シナリオ（在庫金額と郵送代は仮置きの検討用）
SCENARIOS = [
    ("A: 在庫絞りすぎ", 800000, 8000, "🔴 郵送多い・在庫が少なすぎ"),
    ("B: 適度な在庫", 1200000, 3000, "🟢 最適バランス"),
    ("C: 在庫過多", 2000000, 500, "🟡 郵送少ないが資金固定"),
    ("D: 極端な在庫過多", 3000000, 0, "🔴 資金効率が悪い"),
]
OPPORTUNITY_RATE = 0.08  # 運転資金の機会損失（年率）


def find_mailing_records(records, cc):
    """郵送関連の実データを拾う"""
    found = []
    for r in records or []:
        if not r.get("amount"):
            continue
        blob = f"{r.get('filename', '')} {r.get('vendor', '')} {r.get('tag', '')}"
        if any(re.search(p, blob) for p in MAILING_PATTERNS):
            found.append((r.get("month") or "-", "領収書",
                          r.get("vendor") or r.get("filename", ""), r["amount"]))
    for r in cc or []:
        if not r.get("amount"):
            continue
        blob = f"{r.get('vendor', '')} {r.get('tag', '')}"
        if any(re.search(p, blob) for p in MAILING_PATTERNS):
            found.append((r.get("payment_month") or "-", "クレジット",
                          r.get("vendor") or "", r["amount"]))
    found.sort()
    return found


def create_sheet(wb, records=None, cc=None):
    ws = new_sheet(wb, SHEET_NAME)
    set_title(ws, "📦 不足薬郵送費 = 在庫絞りすぎ指標", "A1:I1")

    # ---------- コンセプト ----------
    section(ws, 3, "■ コンセプト")
    note_block(ws, 4, [
        "不足薬を他店舗・他薬局に郵送するコストは、在庫管理の最適化指標になります：",
        "  • 郵送代が多い月 = 在庫切れ多発 = 在庫を絞りすぎ",
        "  • 郵送代が少ない月 = 在庫が十分（ただし在庫過多のリスクもあり）",
        "  • 各店舗の郵送代を追跡することで、店舗別の在庫管理レベルが可視化されます",
        "",
        "目標: 郵送代と在庫金額のバランス点を見つけ、トータルコストを最小化する",
    ])

    # ---------- 現状の判明データ ----------
    sec1 = 12
    section(ws, sec1, "■ 現状の判明データ（限定的）")
    found = find_mailing_records(records, cc)
    total_found = sum(f[3] for f in found)

    ws.cell(row=sec1 + 1, column=1,
            value="⚠️ 会計データに現れている郵送関連の支出はごく限られています"
            ).fill = WARNING_FILL

    fr = write_header(ws, sec1 + 2, ["月度", "データ元", "取引先", "金額"])
    f_first = fr
    if found:
        for m, src, vendor, amt in found:
            fr = write_row(ws, fr, [m, src, vendor, amt], number_cols={4})
        write_row(ws, fr, ["合計", "", f"{len(found)}件",
                           f"=SUM(D{f_first}:D{fr - 1})"],
                  number_cols={4}, bold=True, fill=SUBHEADER_FILL)
        fr += 1
    else:
        fr = write_row(ws, fr, ["-", "-", "該当データなし", 0], number_cols={4})

    note_block(ws, fr + 1, [
        f"→ 判明分は合計 ¥{total_found:,}（{len(found)}件）にとどまります",
        "→ 不足薬の郵送代は「小口現金経由」「店頭現金払い」で会計に上がっていない可能性が高いです",
        "→ そのため以下の入力テンプレートで実態を記録することから始めます",
    ])

    # ---------- 月次入力テンプレート ----------
    sec2 = fr + 6
    section(ws, sec2, "■ 月次入力テンプレート（各店舗の管理薬剤師が記入）")
    ws.cell(row=sec2 + 1, column=1,
            value="📝 黄色セルに毎月の数値を入力 → 合計欄が自動計算されます"
            ).fill = WARNING_FILL

    thdr = sec2 + 2
    write_header(ws, thdr, ["月", "店舗", "ヤマト便\n回数", "ヤマト便\n金額",
                            "郵便\n回数", "郵便\n金額", "合計\n回数", "合計\n金額", "備考"])

    tr = thdr + 1
    template_months = TARGET_MONTHS[-TEMPLATE_MONTHS:]
    month_total_rows = []
    for m in template_months:
        block_first = tr
        for s in STORES:
            ws.cell(row=tr, column=1, value=m).font = NORMAL_FONT
            ws.cell(row=tr, column=2, value=f"{s['name']}({s['location']})").font = NORMAL_FONT
            for ci in (3, 4, 5, 6):
                c = ws.cell(row=tr, column=ci, value=0)
                c.fill = WARNING_FILL          # 入力セル
                c.number_format = YEN if ci in (4, 6) else "0"
                c.font = NORMAL_FONT
            c = ws.cell(row=tr, column=7, value=f"=C{tr}+E{tr}")
            c.font = NORMAL_FONT
            c = ws.cell(row=tr, column=8, value=f"=D{tr}+F{tr}")
            c.number_format = YEN
            c.font = NORMAL_FONT
            for ci in range(1, 10):
                ws.cell(row=tr, column=ci).border = BORDER
            tr += 1
        block_last = tr - 1
        # 月計行
        ws.cell(row=tr, column=1, value=m).font = BOLD_FONT
        ws.cell(row=tr, column=2, value="月計").font = BOLD_FONT
        for ci in range(3, 9):
            col = chr(ord("A") + ci - 1)
            c = ws.cell(row=tr, column=ci,
                        value=f"=SUM({col}{block_first}:{col}{block_last})")
            c.font = BOLD_FONT
            c.fill = SUBHEADER_FILL
            c.number_format = YEN if ci in (4, 6, 8) else "0"
        for ci in range(1, 10):
            ws.cell(row=tr, column=ci).border = BORDER
            if ci <= 2:
                ws.cell(row=tr, column=ci).fill = SUBHEADER_FILL
        month_total_rows.append(tr)
        tr += 1

    # ---------- 判定基準 ----------
    sec3 = tr + 2
    section(ws, sec3, "■ 判定基準（記入後の読み方）")
    jr = write_header(ws, sec3 + 1, ["指標", "水準", "評価", "アクション"])
    for row in THRESHOLDS:
        jr = write_row(ws, jr, list(row))

    # ---------- トレードオフ計算 ----------
    sec4 = jr + 2
    section(ws, sec4, "■ 在庫過多 vs 郵送代 のトレードオフ計算")
    ws.cell(row=sec4 + 1, column=1,
            value=f"💡 在庫を抱えるコスト = 在庫金額 × {OPPORTUNITY_RATE:.0%}"
                  "（運転資金の機会損失/年）として試算")

    sr = write_header(ws, sec4 + 2,
                      ["シナリオ", "在庫金額/店", f"在庫機会損失\n(年率{OPPORTUNITY_RATE:.0%})",
                       "郵送代/月", "郵送代/年", "合計コスト/年", "備考"])
    s_first = sr
    for name, stock, mail_m, note in SCENARIOS:
        sr = write_row(ws, sr, [
            name, stock,
            f"=ROUND(B{sr}*{OPPORTUNITY_RATE},0)",
            mail_m,
            f"=D{sr}*12",
            f"=C{sr}+E{sr}",
            note,
        ], number_cols={2, 3, 4, 5, 6})
    s_last = sr - 1

    note_block(ws, sr + 1, [
        "💡 ポイント：",
        "  • 在庫を絞りすぎても（郵送代増）、在庫過多でも（資金固定）、合計コストは上がります",
        f"  • シナリオB（適度な在庫）が最もトータルコストが低くなります（F{s_first + 1}セル参照）",
        "  • 「郵送代を減らす」と「在庫を増やす」は両立可能。在庫の適正化が最も効果的です",
        "  • 在庫金額・郵送代の前提値は検討用の仮置きです。実測値が集まったら差し替えてください",
    ])

    # ---------- 改善アクション ----------
    note_block(ws, sr + 8, [
        "■ 具体的な改善アクション",
        "",
        "【STEP 1 - 今月から / 投資¥0】 まず実態把握",
        "  ✅ 各店舗の管理薬剤師に、不足薬郵送のたびに以下を記録依頼:",
        "     - 日付 / 送り先 / 内容 / 郵送方法（ヤマト・レターパック等）/ 金額",
        "  ✅ 上記の月次テンプレに毎月入力（このシート）",
        "  ✅ 3ヶ月続けると、どの店舗の在庫が絞りすぎか見えてきます",
        "",
        "【STEP 2 - 3ヶ月後】 在庫管理の改善",
        "  💡 郵送回数が多い薬剤の発注頻度・発注量を見直し",
        "  💡 「不足薬リスト」を作成 → 翌月の発注に反映",
        "  💡 メディセオ等の卸経由の融通も検討（卸の方が早く・安い場合あり）",
        "",
        "【STEP 3 - 中長期】 在庫管理システム化",
        "  💡 ファーマシフト等のシステムで在庫を自動管理",
        "  💡 店舗間の在庫情報共有（LINE WORKSの活用）",
        "",
        "📊 KPI: 月の不足薬郵送代を「1店舗¥2,000以下」に管理することを目標に",
    ])

    set_widths(ws, {"A": 14, "B": 30, "C": 12, "D": 14, "E": 12, "F": 14,
                    "G": 12, "H": 14, "I": 30})
    return ws
