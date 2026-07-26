"""
NTT料金_削減提案 シート

通信費のうちNTT系の実支出を集計し、削減施策とその期待効果（handoff 7.2）を提示する。
金額レンジで示されている施策はレンジのまま掲載し、擬似的な精度を作らない。
"""

import re
from collections import defaultdict

from config import TARGET_MONTHS, STORES
from ._common import (
    new_sheet, set_title, section, set_widths, write_header, write_row,
    note_block, SUBHEADER_FILL, WARNING_FILL, ACCENT_FONT, BOLD_FONT,
    YEN, YEN_MARK, PCT,
)


SHEET_NAME = "NTT料金_削減提案"

NTT_PATTERNS = [r"NTT", r"ニシニホン", r"ドコモ", r"DOCOMO"]

# NTT内訳の判定（利用料金 / 光回線 / ドコモビジネス）
NTT_SUBTYPES = [
    ("NTTドコモビジネス", [r"ドコモ", r"DOCOMO"], "業務用モバイル通信"),
    ("NTT西_利用料金（電話料合算）", [r"ゴリヨウリヨウキン", r"利用料金"],
     "複数回線の通話料・回線料合算（最大コスト）"),
    ("NTT西_光回線（フレッツ光）", [r".*"], "店舗のインターネット回線（4店舗分含む）"),
]

# handoff 7.2 / NTT削減施策（レンジはレンジのまま保持）
MEASURES = [
    ("🔴最優先", "請求書明細の精査", "NTT利用料金の内訳特定",
     "¥50,000〜100,000", "電話30分",
     "①使ってない回線（FAX等）の解約 ②古い割引未適用の点検"),
    ("🔴最優先", "光回線の他社乗換", "全4店舗のフレッツ光 → 光コラボ",
     "¥120,000", "工事¥0",
     "ドコモ光・ソフトバンク光・auひかり等。月¥1,000〜2,500/拠点 安"),
    ("🟠優先", "クラウドPBX導入", "店舗間内線通話の無料化",
     "¥60,000", "初期¥10〜30万", "ひかりクラウドPBX等。4店舗の内線通話料が無料に"),
    ("🟠優先", "FAXの電子化・廃止", "FAX回線解約",
     "¥36,000", "システム導入", "FAX1回線¥2,500-3,000/月×拠点数。eFax化で削減"),
    ("🟡推奨", "ひかり電話プラン見直し", "通話定額プラン適用",
     "要見積", "電話のみ", "10時間定額¥1,500/月など、現在従量制なら見直し"),
    ("🟢検討", "ドコモビジネス見直し", "プラン縮小or他社携帯",
     "要見積", "電話のみ", "使用量と料金プランの妥当性を比較"),
    ("🟢検討", "解約済み回線の確認", "岡本ひかりハート薬局 解約分",
     "要確認", "請求書確認", "解約完了後、本当に請求停止しているか月次確認"),
]


def _is_ntt(*fields):
    blob = " ".join(f for f in fields if f)
    return any(re.search(p, blob, re.IGNORECASE) for p in NTT_PATTERNS)


def _subtype(*fields):
    blob = " ".join(f for f in fields if f)
    for name, pats, desc in NTT_SUBTYPES:
        for p in pats:
            if re.search(p, blob, re.IGNORECASE):
                return name, desc
    return NTT_SUBTYPES[-1][0], NTT_SUBTYPES[-1][2]


def aggregate(records, cc):
    """NTT系の月次合計と内訳区分別合計を返す"""
    monthly = defaultdict(int)
    subtype = defaultdict(int)
    n = 0
    for r in records:
        if r.get("account") != "通信費" or not r.get("amount"):
            continue
        if not _is_ntt(r.get("vendor"), r.get("tag"), r.get("filename")):
            continue
        m = r.get("month")
        if m not in TARGET_MONTHS:
            continue
        monthly[m] += r["amount"]
        st, _ = _subtype(r.get("filename"), r.get("vendor"))
        subtype[st] += r["amount"]
        n += 1
    for r in cc:
        if r.get("account") != "通信費" or not r.get("amount"):
            continue
        if r.get("biz_flag") == "私的（家族）":
            continue
        if not _is_ntt(r.get("vendor"), r.get("tag")):
            continue
        m = r.get("payment_month")
        if m not in TARGET_MONTHS:
            continue
        monthly[m] += r["amount"]
        st, _ = _subtype(r.get("vendor"))
        subtype[st] += r["amount"]
        n += 1
    return dict(monthly), dict(subtype), n


def create_sheet(wb, records, cc):
    ws = new_sheet(wb, SHEET_NAME)
    set_title(ws, "📞 NTT料金 削減提案", "A1:F1")

    monthly, subtype, n = aggregate(records or [], cc or [])
    total = sum(monthly.values())
    n_months = len([m for m in TARGET_MONTHS if monthly.get(m)]) or 1
    avg = total // n_months
    annual = avg * 12
    n_stores = len(STORES)

    # ---------- 現状 ----------
    section(ws, 3, "■ 現状（実データから集計）")
    rows = [
        (f"実績合計（{n_months}ヶ月・{n}件）", total),
        ("月平均", avg),
        ("年換算（月平均×12）", annual),
        (f"1店舗あたり月平均（{n_stores}店舗）", avg // n_stores),
    ]
    r = 4
    for label, val in rows:
        ws.cell(row=r, column=1, value=label).font = BOLD_FONT
        ws.cell(row=r, column=1).fill = SUBHEADER_FILL
        c = ws.cell(row=r, column=4, value=val)
        c.number_format = YEN_MARK
        c.font = ACCENT_FONT
        r += 1

    # ---------- 構成 ----------
    sec2 = r + 2
    section(ws, sec2, "■ NTT料金の構成（実データ）")
    sr = write_header(ws, sec2 + 1, ["項目", "実績合計", "月平均", "年換算", "シェア", "内容"])
    s_first = sr
    desc_map = {name: desc for name, _, desc in NTT_SUBTYPES}
    for name, amt in sorted(subtype.items(), key=lambda kv: -kv[1]):
        sr = write_row(ws, sr, [
            name, amt, amt // n_months, (amt // n_months) * 12,
            (amt / total if total else 0), desc_map.get(name, ""),
        ], number_cols={2, 3, 4}, pct_cols={5})
    s_last = sr - 1
    write_row(ws, sr, ["合計", f"=SUM(B{s_first}:B{s_last})",
                       f"=SUM(C{s_first}:C{s_last})", f"=SUM(D{s_first}:D{s_last})", 1, ""],
              number_cols={2, 3, 4}, pct_cols={5}, bold=True, fill=SUBHEADER_FILL)

    # ---------- 月次推移 ----------
    sec3 = sr + 3
    section(ws, sec3, "■ NTT系 月次推移")
    mr = write_header(ws, sec3 + 1, ["月度", "NTT系 支払額"])
    m_first = mr
    for m in TARGET_MONTHS:
        mr = write_row(ws, mr, [m, monthly.get(m, 0)], number_cols={2})
    write_row(ws, mr, ["合計", f"=SUM(B{m_first}:B{mr - 1})"],
              number_cols={2}, bold=True, fill=SUBHEADER_FILL)

    # ---------- NTT2026年問題 ----------
    sec4 = mr + 3
    section(ws, sec4, "⚠️ 重要: NTT2026年問題")
    wr = sec4 + 1
    for line in [
        "• 2025年2月以降、「光はじめ割」契約満了の回線から順次終了 → 月額最大¥1,419/回線 値上げ",
        "• 何もしないと自動的に高い料金プランへ移行（放置するとさらに月額増）",
        "• 2035年頃までにメタル回線（加入電話）廃止予定 → 光回線への移行必須",
        "• 2026年4月から「光はじめ割ネクスト」新規受付（戸建¥1,210/月割引、マンション¥385〜¥605/月）",
        "→ NTTから値上げの案内が来ていれば、放置せず対応が必要",
    ]:
        c = ws.cell(row=wr, column=1, value=line)
        c.fill = WARNING_FILL
        wr += 1

    # ---------- 削減施策 ----------
    sec5 = wr + 2
    section(ws, sec5, "■ 削減方法と効果（handoff 7.2 の想定値）")
    er = write_header(ws, sec5 + 1,
                      ["優先度", "施策", "対象", "想定削減/年", "投資/手間", "備考"])
    for row in MEASURES:
        er = write_row(ws, er, list(row))
    write_row(ws, er, ["合計", "定量化できた施策の単純合計", "",
                       "¥266,000〜316,000", "", "レンジ表記の施策は下限〜上限で加算"],
              bold=True, fill=SUBHEADER_FILL)

    # ---------- 段階的アプローチ ----------
    sec6 = er + 3
    note_block(ws, sec6, [
        "📋 おすすめの段階的アプローチ",
        "",
        "【STEP 1 - 今週中 / 投資¥0 / まずこれ！】",
        "  ✅ NTT西の請求書を全店舗分集める",
        "    → 「お客さま番号」と「回線種別」を一覧化",
        "    → 「使ってない回線」「重複契約」を特定",
        "    → NTT(0120-116-116)に電話して、現在の契約一覧と適用中の割引を確認",
        "    → 「光はじめ割」が終了している回線がないかチェック",
        "    → 想定削減: ¥50,000〜100,000/年",
        "",
        "【STEP 2 - 1〜2ヶ月以内 / 投資¥0】",
        "  💡 光回線の乗換見積もりを3社取得（ドコモ光・ソフトバンク光・楽天ひかり等）",
        "    → 法人プランで4店舗一括契約だと割引が大きい",
        "    → 工事費・違約金は乗換先のキャンペーンで実質¥0のことが多い",
        "    → 想定削減: ¥120,000/年",
        "",
        "【STEP 3 - 3〜6ヶ月以内 / 初期¥10〜30万】",
        "  💡 クラウドPBX導入（店舗間の内線通話無料化、スマホからの応答）",
        "    → 既存番号は維持できる(LNP対応)。4店舗あるならメリット大、回収1〜2年",
        "    → 想定削減: ¥60,000/年",
        "",
        "【STEP 4 - 中長期 / システム導入】",
        "  💡 FAX電子化 (eFax/MOVFAX)。4店舗のFAX回線解約で ¥36,000/年",
        "",
        "🔥 まずやるべきこと: STEP 1（NTTに電話）",
        "  → 0120-116-116 に「請求書の内訳を確認したい」と伝える",
        "  → 「不要な回線/FAX/オプションがないか確認したい」と相談",
        "  → 「適用可能な割引プランを教えて」と聞く",
        "",
        "📝 NTTに電話するときの確認リスト",
        "□ 各店舗の「お客さま番号」を控えておく（請求書に記載）",
        "□ 現在契約中の回線一覧を取得（フレッツ光/INS/加入電話/モバイル等）",
        "□ 各回線の「契約電話番号」「回線種別」「契約日」「料金プラン」",
        "□ 「光はじめ割」「フレッツ・あっと割」など適用中の割引一覧",
        "□ 過去6ヶ月の通話料明細（どの拠点が一番電話しているか把握）",
        "□ 使ってないFAX/INS回線がないか確認",
        "□ 解約済みの「岡本ひかりハート薬局」が完全に請求停止されているか確認",
        "□ 「光はじめ割ネクスト」への切替で月額が下がるか試算依頼",
        "",
        "⚠️ 上記の削減額は handoff 資料の想定値です。レンジで示されているものは",
        "   レンジのまま記載しており、実際の削減額は請求書精査後に確定します。",
    ])

    set_widths(ws, {"A": 30, "B": 30, "C": 32, "D": 20, "E": 16, "F": 52})
    return ws
