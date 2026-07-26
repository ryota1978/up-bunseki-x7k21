"""
電気代_削減シミュレーション シート

電気代_店舗別分析 で推定した店舗別実績をベースに、
最も電気代の高い店舗（志摩）を「他店舗平均」まで下げた場合の削減額を試算する。
削減額は実データから毎回再計算する（固定値をハードコードしない）。
"""

from openpyxl.chart import BarChart, Reference

from ._common import (
    new_sheet, set_title, section, set_widths, write_header, write_row,
    note_block, SUBHEADER_FILL, ACCENT_FONT, SUCCESS_FONT, BOLD_FONT,
    YEN, YEN_MARK, PCT,
)
from .electric_by_store import infer_grimms_stores, summarize, STORE_SEQUENCE


SHEET_NAME = "電気代_削減シミュレーション"

# handoff 7.2 準拠の削減施策（レンジはレンジのまま保持）
MEASURES = [
    ("LED照明化", "蛍光灯→LED全交換", "▲10〜15%", "¥30〜50万", "2〜3年",
     "明るさ向上、寿命10倍"),
    ("空調設定見直し", "夏28℃/冬20℃に統一・タイマー導入", "▲5〜10%", "¥0", "即効性",
     "従業員啓発のみ"),
    ("エアコン更新", "10年超の機種を高効率機に交換", "▲15〜20%", "¥30〜50万/台", "5〜7年",
     "夏冬の電気代差が大きい店向き"),
    ("冷蔵庫の見直し", "古い冷蔵庫の高効率機への更新", "▲5〜10%", "¥20〜40万", "5年",
     "24時間稼働なので効果大"),
    ("デマンドコントローラ", "ピーク電力抑制装置の導入", "▲5〜8%", "¥30〜80万", "5〜8年",
     "契約電力を下げて基本料金減"),
    ("電力会社の見直し", "グリムスから新電力への切替（複数社比較）", "▲3〜8%", "¥0", "即効性",
     "解約金がないか要確認"),
    ("太陽光発電", "屋根に5〜10kW設置", "▲30〜50%", "¥150〜300万", "8〜10年",
     "補助金活用で短縮可能"),
    ("待機電力カット", "プリンタ等のスリープ運用徹底", "▲2〜5%", "¥0", "即効性",
     "従業員啓発のみ"),
]


def simulate(cc):
    """
    最も月平均が高い店舗を「同月に稼働している他店舗の単純平均」まで
    下げた場合の削減額を月ごとに計算する。
    """
    rows = infer_grimms_stores(cc or [])
    by_store, matrix, months = summarize(rows)
    if not by_store:
        return None

    # 月平均が最大の店舗を対象にする
    target = max(by_store.items(), key=lambda kv: sum(kv[1]) / len(kv[1]))[0]
    others = [s[0] for s in STORE_SEQUENCE if s[0] != target and s[0] in by_store]

    sim = []
    for m in months:
        cur = matrix.get(target, {}).get(m)
        if cur is None:
            continue
        vals = [matrix.get(o, {}).get(m) for o in others]
        live = [v for v in vals if v]
        avg = round(sum(live) / len(live)) if live else 0
        sim.append({
            "month": m,
            "current": cur,
            "others": {o: matrix.get(o, {}).get(m) or 0 for o in others},
            "avg": avg,
            "saving": max(cur - avg, 0),
        })

    n = len(sim)
    cur_total = sum(s["current"] for s in sim)
    save_total = sum(s["saving"] for s in sim)
    return {
        "target": target,
        "others": others,
        "sim": sim,
        "n_months": n,
        "current_total": cur_total,
        "saving_total": save_total,
        "current_avg": cur_total // n if n else 0,
        "saving_avg": save_total // n if n else 0,
        "annual_saving": round(save_total * 12 / n) if n else 0,
        "rate": (save_total / cur_total) if cur_total else 0,
    }


def create_sheet(wb, records=None, cc=None):
    ws = new_sheet(wb, SHEET_NAME)

    res = simulate(cc)
    if not res:
        set_title(ws, "⚡ 電気代削減シミュレーション（データなし）", "A1:H1")
        ws["A3"] = "グリムスのクレジット明細が見つからないため試算できません。"
        return ws

    target = res["target"]
    set_title(ws, f"⚡ {target} 電気代削減シミュレーション", "A1:H1")

    # ---------- 結論 ----------
    section(ws, 3, "■ 結論")
    for i, (label, val, fmt, font) in enumerate([
        ("🎯 年間削減額（換算）", res["annual_saving"], YEN_MARK, SUCCESS_FONT),
        ("月平均削減額", res["saving_avg"], YEN_MARK, ACCENT_FONT),
        ("削減率", res["rate"], PCT, ACCENT_FONT),
    ]):
        r = 4 + i
        ws.cell(row=r, column=1, value=label).font = BOLD_FONT
        ws.cell(row=r, column=1).fill = SUBHEADER_FILL
        c = ws.cell(row=r, column=4, value=val)
        c.number_format = fmt
        c.font = font

    # ---------- 計算前提 ----------
    sec2 = 8
    section(ws, sec2, "■ 計算前提")
    note_block(ws, sec2 + 1, [
        f"• 対象店舗は月平均電気代が最大の「{target}」",
        "• 「他店舗平均」は、各月に稼働している他店舗の単純平均（解約中の店舗は除外）",
        "• 目標額 = その月の他店舗平均。削減額 = 現状 − 目標額（マイナスは0とする）",
        f"• 期間: グリムス明細が存在する {res['n_months']}ヶ月分のデータから算出",
        f"• 年間換算: {res['n_months']}ヶ月の削減額 ¥{res['saving_total']:,} × 12/{res['n_months']} "
        f"= ¥{res['annual_saving']:,}",
        "• 数値は実データから毎回再計算しています（固定値のハードコードなし）",
    ])

    # ---------- 月別シミュレーション ----------
    sec3 = sec2 + 9
    section(ws, sec3, "■ 月別 削減シミュレーション")
    others = res["others"]
    hdr = sec3 + 1
    headers = ["月", f"{target}(現状)"] + others + ["他店舗平均", "目標額", "削減額"]
    write_header(ws, hdr, headers)

    n_others = len(others)
    col_avg = 3 + n_others          # 他店舗平均
    col_goal = col_avg + 1
    col_save = col_goal + 1
    num_cols = set(range(2, col_save + 1))

    rr = hdr + 1
    first = rr
    for s in res["sim"]:
        vals = [s["month"], s["current"]] + [s["others"][o] for o in others]
        vals += [s["avg"], s["avg"], f"=MAX(B{rr}-{_col(col_goal)}{rr},0)"]
        rr = write_row(ws, rr, vals, number_cols=num_cols)
    last = rr - 1

    # 合計 / 月平均 / 年間換算（すべて数式）
    write_row(ws, rr, [f"合計({res['n_months']}ヶ月)",
                       f"=SUM(B{first}:B{last})"] + [""] * n_others +
              [f"=SUM({_col(col_avg)}{first}:{_col(col_avg)}{last})",
               f"=SUM({_col(col_goal)}{first}:{_col(col_goal)}{last})",
               f"=SUM({_col(col_save)}{first}:{_col(col_save)}{last})"],
              number_cols=num_cols, bold=True, fill=SUBHEADER_FILL)
    total_row = rr
    rr += 1
    write_row(ws, rr, ["月平均", f"=ROUND(B{total_row}/{res['n_months']},0)"] + [""] * n_others +
              [f"=ROUND({_col(col_avg)}{total_row}/{res['n_months']},0)",
               f"=ROUND({_col(col_goal)}{total_row}/{res['n_months']},0)",
               f"=ROUND({_col(col_save)}{total_row}/{res['n_months']},0)"],
              number_cols=num_cols, bold=True)
    rr += 1
    write_row(ws, rr, ["年間換算"] + [""] * (n_others + 3) +
              [f"=ROUND({_col(col_save)}{total_row}*12/{res['n_months']},0)"],
              number_cols=num_cols, bold=True, fill=SUBHEADER_FILL)
    annual_row = rr

    # ---------- グラフ ----------
    chart = BarChart()
    chart.type = "col"
    chart.title = f"{target}(現状) vs 他店舗平均(目標)"
    chart.height = 11
    chart.width = 20
    chart.y_axis.number_format = "#,##0"
    d1 = Reference(ws, min_col=2, min_row=hdr, max_row=last)
    d2 = Reference(ws, min_col=col_avg, min_row=hdr, max_row=last)
    cats = Reference(ws, min_col=1, min_row=first, max_row=last)
    chart.add_data(d1, titles_from_data=True)
    chart.add_data(d2, titles_from_data=True)
    chart.set_categories(cats)
    ws.add_chart(chart, f"{_col(col_save + 2)}{sec3}")

    # ---------- 削減施策 ----------
    sec4 = annual_row + 3
    section(ws, sec4, "■ 削減方法と効果（推定）")
    er = write_header(ws, sec4 + 1,
                      ["施策", "対策内容", "削減効果", "投資額", "回収年数", "備考"])
    for row in MEASURES:
        er = write_row(ws, er, list(row))

    # ---------- 段階的アプローチ ----------
    note_block(ws, er + 2, [
        "📋 段階的アプローチの提案",
        "",
        "【STEP 1 / 即時実行 / 投資¥0】 ← まずこれから",
        "  ✅ 空調設定 28℃/20℃に統一、業務時間外OFF、タイマー導入",
        "  ✅ 待機電力カット（プリンタスリープ徹底）",
        "  ✅ 新電力会社の見積もりを3社取得",
        "    → 想定削減: ¥30,000〜50,000/年（投資¥0なので即効）",
        "",
        "【STEP 2 / 半年以内 / 投資¥30〜80万】",
        "  💡 LED照明への全交換（蛍光灯がまだあれば）",
        "  💡 古いエアコンの診断（10年超なら更新検討）",
        "    → 想定削減: ¥100,000〜150,000/年（回収2〜5年）",
        "",
        "【STEP 3 / 中長期 / 投資¥150〜300万】",
        "  🌞 太陽光発電パネル設置（屋根条件次第）",
        "    → 想定削減: ¥200,000〜300,000/年（回収8〜10年）",
        "  ⚙️ デマンドコントローラ（契約電力削減効果）",
        "",
        f"⚠️ {target}は季節変動が大きいため、空調対策が最も効果的と考えられます",
        "⚠️ ただし患者の快適性も重要なので、過度な節約は避けてください",
        "⚠️ 「他店舗平均まで下げる」は理論上の上限であり、店舗規模差を考慮すると",
        "   実際に到達可能な削減幅はこれより小さくなる可能性があります",
    ])

    set_widths(ws, {"A": 22, "B": 32, "C": 18, "D": 16, "E": 14, "F": 34,
                    "G": 14, "H": 14, "I": 14, "J": 14})
    return ws


def _col(idx):
    from openpyxl.utils import get_column_letter
    return get_column_letter(idx)
