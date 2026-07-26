"""
まとめ買い候補 シート

Amazon商品明細からリピート購入商品を抽出し、まとめ買い・法人契約による
節約余地を試算する。

商品名は表記ゆれが大きいため、型番・ブランドを手がかりに「商品グループ」へ
正規化してから回数を数える。
"""

import re
from collections import defaultdict

from config import TARGET_MONTHS
from ._common import (
    new_sheet, set_title, section, set_widths, write_header, write_row,
    note_block, SUBHEADER_FILL, WARNING_FILL, ACCENT_FONT, BOLD_FONT,
    YEN, YEN_MARK, PCT,
)
from .amazon_analysis import categorize, allocate


SHEET_NAME = "まとめ買い候補"

# 商品グループへの正規化（型番優先。上から順に評価）
GROUP_PATTERNS = [
    ("エプソン IP11 シリーズ互換インク", [r"IP11"]),
    ("エプソン IP01 シリーズ互換インク", [r"IP01", r"IPO1"]),
    ("EPSON GP-730用 GJICインク", [r"GJIC", r"GP-?730"]),
    ("エプソン ICTM70 系リサイクルインク", [r"ICTM70", r"JIT-ETM"]),
    ("エプソン IC82 系純正インク", [r"IC(BK|CL)82"]),
    ("エプソン KAM 系互換インク", [r"KAM-"]),
    ("ブラザー LC3111 系インク", [r"LC3111"]),
    ("ブラザー TN70J/DR-70J トナー・ドラム", [r"TN70", r"DR-?70"]),
    ("メンテナンスボックス", [r"メンテナンスボックス", r"PX4MB"]),
    ("感熱レジロール紙", [r"感熱", r"レジロール"]),
    ("プリンタ本体", [r"プリンター\s*A4", r"PX-S887\s*FAX"]),
    ("コピー用紙 A4 500枚", [r"コピー用紙", r"PaperOne"]),
    ("ラミネートフィルム A4", [r"ラミネート"]),
    ("封筒（窓付き・OPP等）", [r"封筒", r"OPP"]),
    ("医療用スクラブ", [r"スクラブ", r"アンファミエ"]),
    ("スチールラック", [r"スチールラック", r"メタルラック", r"ラック"]),
    ("ウォールポケット", [r"ウォールポケット"]),
    ("クイックルワイパー・ワックスシート", [r"クイックル", r"ワックスシート"]),
    ("い・ろ・は・す（水）", [r"い・ろ・は・す", r"いろはす"]),
    ("ハイドロコロイド絆創膏", [r"絆創膏", r"キズクイック"]),
    ("トイレマジックリン等 洗剤", [r"マジックリン", r"キュキュット", r"バスタブクレンジング"]),
    ("非常用トイレ・防災用品", [r"非常用トイレ", r"BOS", r"アルミシート", r"サバイバル"]),
    ("三角コーン+ウエイト", [r"三角コーン", r"コーンウエイト"]),
    ("ケーブル・結束バンド類", [r"結束バンド", r"ケーブル", r"ケーブルタイ", r"コードクリップ"]),
    ("電源タップ・コンセント", [r"電源タップ", r"コンセントタップ", r"タコ足"]),
    ("乾電池", [r"乾電池", r"アルカリ電池"]),
    ("自転車タイヤ・チューブ", [r"自転車", r"タイヤ", r"チューブ"]),
    ("フェイスタオル", [r"タオル"]),
    ("第2類医薬品（外用薬）", [r"第2類医薬品", r"第２類医薬品", r"ビーソフテン", r"ヒルマイルド"]),
]

# 購入回数に応じた優先度・想定割引率
TIERS = [
    (10, "🔴最優先", 0.10, "Amazon Business・年契約で10%引き想定"),
    (5, "🟠優先", 0.08, "卸経由・まとめ買いで8%引き想定"),
    (3, "🟡推奨", 0.05, "年2-3回まとめ買いで5%引き想定"),
    (2, "🟢検討", 0.00, "回数が少ないため、まずは発注タイミングの集約から"),
]

# handoff 7.2 の関連施策
SAVING_MEASURES = [
    ("① Amazon Business 法人契約", "10回以上購入の商品", "5〜10%", "¥50,000"),
    ("② プリンタ消耗品 卸経由切替", "全プリンタ用品（インク・トナー）", "10〜15%", "¥60,000"),
]


def normalize_group(name):
    for group, pats in GROUP_PATTERNS:
        for p in pats:
            if re.search(p, name, re.IGNORECASE):
                return group
    # 型番に当たらないものは先頭の語で寄せる
    base = re.sub(r"[【】\[\]（）()]", " ", name)
    return " ".join(base.split()[:3])[:40] or name[:40]


def tier_of(count):
    for threshold, label, rate, comment in TIERS:
        if count >= threshold:
            return label, rate, comment
    return "🟢検討", 0.0, "単発購入"


def aggregate(amazon):
    """商品グループごとの購入回数・推定金額・主な配送先"""
    groups = defaultdict(lambda: {"count": 0, "amount": 0,
                                  "ship": defaultdict(int), "cat": defaultdict(int),
                                  "examples": []})
    for r in amazon or []:
        if r.get("month") not in TARGET_MONTHS:
            continue
        ship = r.get("shipto") or "不明"
        for it, alloc in allocate(r):
            g = normalize_group(it["name"])
            d = groups[g]
            d["count"] += 1
            d["amount"] += alloc
            d["ship"][ship] += 1
            d["cat"][categorize(it["name"])] += alloc
            if len(d["examples"]) < 3:
                d["examples"].append(it["name"][:70])
    return dict(groups)


def create_sheet(wb, records=None, cc=None, amazon=None):
    ws = new_sheet(wb, SHEET_NAME)
    set_title(ws, "🛒 まとめ買い候補分析（リピート購入商品）", "A1:I1")

    if not amazon:
        ws["A3"] = "amazon_products_v3.json が見つからないため分析できません。"
        ws["A3"].fill = WARNING_FILL
        return ws

    groups = aggregate(amazon)
    n_kinds = len(groups)
    repeat = {g: d for g, d in groups.items() if d["count"] >= 2}
    bulk = {g: d for g, d in groups.items() if d["count"] >= 3}
    single = n_kinds - len(repeat)

    # ---------- サマリ ----------
    section(ws, 3, "■ 同じ商品を何回買っているか、まとめ買いで節約できそうな候補")
    r = 5
    for label, val in [
        ("総商品グループ数", f"{n_kinds} 種類"),
        ("リピート購入 (2回以上)", f"{len(repeat)} 種類"),
        ("まとめ買い推奨 (3回以上)", f"{len(bulk)} 種類"),
        ("単発購入", f"{single} 種類"),
    ]:
        ws.cell(row=r, column=1, value=label).fill = SUBHEADER_FILL
        ws.cell(row=r, column=2, value=val).font = BOLD_FONT
        r += 1

    # ---------- ランキング ----------
    sec2 = r + 2
    section(ws, sec2, "■ まとめ買い緊急度ランキング（購入回数順）")
    hdr = sec2 + 1
    rr = write_header(ws, hdr, ["優先度", "順位", "商品グループ", "カテゴリ", "購入回数",
                                "推定金額", "主な配送先", "節約余地", "コメント"])
    ranked = sorted(repeat.items(), key=lambda kv: (-kv[1]["count"], -kv[1]["amount"]))
    first = rr
    total_saving = 0
    for i, (g, d) in enumerate(ranked, 1):
        label, rate, comment = tier_of(d["count"])
        cat = max(d["cat"].items(), key=lambda kv: kv[1])[0] if d["cat"] else "-"
        ships = ", ".join(f"{s}({n})" for s, n in
                          sorted(d["ship"].items(), key=lambda kv: -kv[1])[:2])
        saving = round(d["amount"] * rate)
        total_saving += saving
        rr = write_row(ws, rr, [label, i, g, cat, d["count"], d["amount"],
                                ships, saving, comment],
                       number_cols={6, 8})
    last = rr - 1
    if ranked:
        write_row(ws, rr, ["合計", "", f"{len(ranked)} 種類", "",
                           f"=SUM(E{first}:E{last})", f"=SUM(F{first}:F{last})", "",
                           f"=SUM(H{first}:H{last})", "想定割引率を適用した節約余地"],
                  number_cols={6, 8}, bold=True, fill=SUBHEADER_FILL)
        rr += 1

    # ---------- プリンタ用品の集約分析 ----------
    sec3 = rr + 2
    section(ws, sec3, "🖨️ プリンタ用品（インク・トナー）の集約分析")
    printer_cat = "プリンタ用品（インク・トナー）"
    p_groups = {g: d for g, d in groups.items()
                if d["cat"] and max(d["cat"].items(), key=lambda kv: kv[1])[0] == printer_cat}
    p_count = sum(d["count"] for d in p_groups.values())
    p_amount = sum(d["amount"] for d in p_groups.values())

    ws.cell(row=sec3 + 1, column=1, value="プリンタ用品 合計").fill = SUBHEADER_FILL
    ws.cell(row=sec3 + 1, column=2,
            value=f"{p_count} 回購入 / {len(p_groups)} 種類 / 推定¥{p_amount:,}").font = ACCENT_FONT

    note_block(ws, sec3 + 3, [
        "• Amazon購入の中で最も重要なカテゴリ（抽出できた商品行の中では最大）",
        "• 4店舗で同じプリンタ機種を使っていれば、Amazon Business年契約で10-15%の節約が可能",
        "• 在庫共有化（本社ストック → 各店舗配送）で在庫切れリスクと配送回数を削減できます",
        "• 互換インクから純正インクへ戻す検討（純正は安定性が高く、長期的に故障リスク減）",
        "• 各店舗のインク使用量を月次で記録 → 在庫切れ寸前の発注パターンを脱却",
    ])

    # ---------- 節約シミュレーション ----------
    sec4 = sec3 + 10
    section(ws, sec4, "💰 節約シミュレーション")
    mr = write_header(ws, sec4 + 1, ["施策", "対象", "想定割引率", "年間節約額"])
    for row in SAVING_MEASURES:
        mr = write_row(ws, mr, list(row))
    write_row(ws, mr, ["合計", "handoff 7.2 の想定値", "", "¥110,000"],
              bold=True, fill=SUBHEADER_FILL)
    mr += 1

    ws.cell(row=mr + 1, column=1,
            value=f"※ 本シートの購入回数から機械的に算出した節約余地は ¥{total_saving:,} です"
            ).fill = WARNING_FILL
    ws.cell(row=mr + 2, column=1,
            value="※ ただし商品名を抽出できた領収書は全体の一部のため、実際の節約余地はこれより大きい可能性があります"
            ).fill = WARNING_FILL

    # ---------- 実行ステップ ----------
    note_block(ws, mr + 4, [
        "📋 実行ステップ",
        "",
        "STEP 1: Amazon Business（法人アカウント）に無料登録する",
        "STEP 2: 上のランキング上位（🔴最優先・🟠優先）の商品を「定期おトク便」または年間契約の対象にする",
        "STEP 3: プリンタ消耗品の年間使用量を試算する（本シートの購入回数×数量が目安）",
        "STEP 4: 互換インクメーカーに直接見積り依頼（インクのチップス、ヨコハマトナー等）",
        "STEP 5: 月1回のまとめ発注に変更（在庫切れ防止のため安全在庫を本社に保管）",
        "STEP 6: 半年後に節約効果を測定 → 必要に応じてさらなる改善",
        "",
        "📝 注釈",
        "• 商品グループは型番・ブランド名を手がかりに表記ゆれを寄せています",
        "• 画像のみのPDF領収書は商品名が取れないため、本シートの集計に含まれていません",
        "• そのため実際のリピート回数は、ここに表示されている回数より多い可能性があります",
    ])

    set_widths(ws, {"A": 12, "B": 8, "C": 40, "D": 26, "E": 12, "F": 14,
                    "G": 36, "H": 14, "I": 44})
    return ws
