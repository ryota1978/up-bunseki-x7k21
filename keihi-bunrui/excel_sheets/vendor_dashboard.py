"""
支払先ダッシュボード シート

35社の主要支払先を可視化。
- ランキング（金額順）
- 月別マトリクス
- 科目別サマリ
- データバー付き
"""

import re
from collections import defaultdict
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.chart import PieChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import DataBarRule

from config import TARGET_MONTHS


# 気になる支払先の一覧（追加は自由に）
TARGET_VENDORS = {
    "コムデック": ["コムデック"],
    "インディード(Indeed)": ["インディード", "indeed"],
    "電気(グリムス)": ["グリムス"],
    "水道": ["水道", "スイドウ", "上下水"],
    "ガス(ガスパル)": ["ガス", "ガスパル", "エルピー"],
    "セコム": ["セコム"],
    "ファーマシフト": ["ファーマシフト"],
    "ソロエルアリーナ": ["ソロエル", "アリーナ"],
    "LINE WORKS": ["ラインワークス", "ライン.*ワークス"],
    "AMEX(UJ)": ["UJ", "ユージェイ", "アメリカンエキスプレス", "アメックス"],
    "ラクスル": ["ラクスル"],
    "リバイバルドラッグ": ["リバドラ", "リバイバル"],
    "サンポート(施設技術料)": ["サンポート"],
    "日薬保険": ["日薬"],
    "BIアカウンティング(税理士)": ["BIアカウンティング", "ＢＩ"],
    "遠興": ["遠興"],
    "百五証券": ["百五"],
    "JCB": ["JCB"],
    "松幸農産(贈答)": ["松幸"],
    "高島屋": ["高島屋", "タカシマヤ"],
    "松永先生(外注)": ["松永"],
    "野村先生(外注)": ["野村"],
    "渡部先生(eNECT)": ["渡部", "eNECT", "eNEXT"],
    "志摩の里": ["志摩の里"],
    "中原先生": ["中原"],
    "法子先生": ["法子"],
    "NTT": ["NTT"],
    "DMM(挟間先生)": ["DMM"],
    "ドコモ": ["ドコモ", "ドコモビジネス"],
    "Apple": ["apple", "Apple", "ＡＰＰＬＥ"],
    "ChatGPT": ["chatGPT", "チャットGPT", "ＣＨＡＴＧＰＴ", "ＯＰＥＮＡＩ"],
    "Claude": ["Claude", "ＣＬＡＵＤＥ", "ＡＮＴＨＲＯＰＩＣ"],
    "Zoom": ["Zoom", "ＺＯＯＭ"],
    "ジョブカン": ["ジョブカン", "ジヨブカン"],
    "Google": ["google", "ＧＯＯＧＬＥ"],
    "Amazon(消耗品)": ["Amazon", "amazon", "amzon", "ＡＭＡＺＯＮ"],
    "メディセオ": ["メディセオ"],
    "志摩センター(仕入)": ["志摩センター"],
    "シンフォニア商事": ["シンフォニア"],
    "三井住友海上(保険)": ["三井住友"],
}

# カテゴリ色マップ
CATEGORY_COLORS = {
    "外注費": "F8CBAD",
    "消耗品費": "FFF2CC",
    "水道光熱費": "FFD966",
    "支払手数料": "DDEBF7",
    "保険料": "C6E0B4",
    "接待交際費": "F4B084",
    "広告宣伝費": "BDD7EE",
    "通信費": "E2EFDA",
    "仕入高": "D9D9D9",
    "旅費交通費": "FCE4D6",
    "売上": "FF9999",
    "その他": "EDEDED",
}


def get_category(account):
    """勘定科目からカテゴリ判定"""
    if not account:
        return "その他"
    for key in CATEGORY_COLORS:
        if key.replace("費", "").replace("高", "") in account:
            return key
    return "その他"


def aggregate_vendors(records, cc):
    """
    プロジェクト+クレジットデータから支払先別集計。

    Returns:
        {vendor_name: {"total": int, "p_count": int, "c_count": int,
                      "main_account": str, "monthly": {"YYYY/MM": int}}}
    """
    result = {}

    for name, patterns in TARGET_VENDORS.items():
        p_amount = 0
        p_count = 0
        c_amount = 0
        c_count = 0
        accts = defaultdict(int)
        monthly = defaultdict(int)

        # プロジェクト側
        for r in records:
            if not r["amount"]:
                continue
            for pat in patterns:
                if re.search(pat, r["filename"] or "", re.IGNORECASE):
                    p_amount += r["amount"]
                    p_count += 1
                    accts[r["account"]] += r["amount"]
                    if r["month"]:
                        monthly[r["month"]] += r["amount"]
                    break

        # クレジット側（事業分のみ）
        for r in cc:
            if not r["amount"]:
                continue
            if r.get("biz_flag") == "私的（家族）":
                continue
            for pat in patterns:
                if re.search(pat, r["vendor"] or "", re.IGNORECASE):
                    c_amount += r["amount"]
                    c_count += 1
                    accts[r.get("account") or "不明"] += r["amount"]
                    if r.get("payment_month"):
                        monthly[r["payment_month"]] += r["amount"]
                    break

        total = p_amount + c_amount
        if total == 0:
            continue

        main_acct = max(accts.items(), key=lambda x: x[1])[0] if accts else "-"
        result[name] = {
            "p_count": p_count,
            "c_count": c_count,
            "total": total,
            "monthly_avg": total // 10,
            "main_account": main_acct,
            "monthly": dict(monthly),
        }

    return result


def create_sheet(wb, records, cc):
    """支払先ダッシュボードシートを作成"""
    from openpyxl.styles import Border, Side

    # 共通スタイル
    HEADER_FILL = PatternFill("solid", start_color="305496")
    HEADER_FONT = Font(name="メイリオ", bold=True, color="FFFFFF", size=11)
    TITLE_FONT = Font(name="メイリオ", bold=True, size=14, color="305496")
    SECTION_FONT = Font(name="メイリオ", bold=True, size=12, color="305496")
    NORMAL_FONT = Font(name="メイリオ", size=10)
    SUBHEADER_FILL = PatternFill("solid", start_color="D9E1F2")
    BORDER = Border(
        left=Side(style="thin", color="BFBFBF"),
        right=Side(style="thin", color="BFBFBF"),
        top=Side(style="thin", color="BFBFBF"),
        bottom=Side(style="thin", color="BFBFBF"),
    )

    # 集計
    vendor_data = aggregate_vendors(records, cc)
    total_amount = sum(d["total"] for d in vendor_data.values())

    # シート作成
    if "支払先ダッシュボード" in wb.sheetnames:
        del wb["支払先ダッシュボード"]
    ws = wb.create_sheet("支払先ダッシュボード")

    ws["A1"] = "🏢 支払先ダッシュボード（全経費の可視化）"
    ws["A1"].font = TITLE_FONT
    ws.merge_cells("A1:P1")

    # サマリ
    ws["A3"] = "■ 全体サマリ（10ヶ月分・事業分のみ）"
    ws["A3"].font = SECTION_FONT

    ws.cell(row=4, column=1, value="主要支払先の数").font = Font(name="メイリオ", bold=True)
    ws.cell(row=4, column=1).fill = SUBHEADER_FILL
    ws.cell(row=4, column=2, value=f"{len(vendor_data)} 社").font = Font(name="メイリオ", bold=True, size=12, color="C00000")

    ws.cell(row=5, column=1, value="合計支出").font = Font(name="メイリオ", bold=True)
    ws.cell(row=5, column=1).fill = SUBHEADER_FILL
    c = ws.cell(row=5, column=2, value=total_amount)
    c.font = Font(name="メイリオ", bold=True, size=12, color="C00000")
    c.number_format = "¥#,##0"

    # ランキングテーブル
    ws["A9"] = "■ 支払先ランキング（金額順・カテゴリ別色分け）"
    ws["A9"].font = SECTION_FONT
    ws.merge_cells("A9:P9")

    hdrs = ["順位", "支払先", "科目", "件数", "合計金額", "月平均", "シェア"] + TARGET_MONTHS
    for ci, h in enumerate(hdrs, 1):
        c = ws.cell(row=10, column=ci, value=h)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = Alignment(horizontal="center", wrap_text=True)
        c.border = BORDER

    sorted_r = sorted(vendor_data.items(), key=lambda x: -x[1]["total"])
    for ri, (name, d) in enumerate(sorted_r, 11):
        cat = get_category(d["main_account"])
        color = CATEGORY_COLORS.get(cat, "FFFFFF")
        fill = PatternFill("solid", start_color=color)

        ws.cell(row=ri, column=1, value=ri - 10).font = Font(name="メイリオ", bold=True)
        ws.cell(row=ri, column=2, value=name).font = Font(name="メイリオ", bold=True, size=10)
        ws.cell(row=ri, column=3, value=cat).font = NORMAL_FONT
        ws.cell(row=ri, column=4, value=d["p_count"] + d["c_count"]).font = NORMAL_FONT

        c = ws.cell(row=ri, column=5, value=d["total"])
        c.number_format = "#,##0"
        c.font = Font(name="メイリオ", bold=True)

        c = ws.cell(row=ri, column=6, value=d["monthly_avg"])
        c.number_format = "#,##0"

        c = ws.cell(row=ri, column=7, value=d["total"] / total_amount)
        c.number_format = "0.0%"

        # 月別
        for j, m in enumerate(TARGET_MONTHS, 8):
            v = d.get("monthly", {}).get(m, 0)
            c = ws.cell(row=ri, column=j, value=v)
            c.number_format = "#,##0;-;-"

        for ci in range(1, len(hdrs) + 1):
            ws.cell(row=ri, column=ci).border = BORDER
            ws.cell(row=ri, column=ci).fill = fill

    # データバー
    from openpyxl.formatting.rule import DataBarRule
    bar_rule = DataBarRule(
        start_type="min", end_type="max", color="638EC6",
        showValue=True, minLength=0, maxLength=100
    )
    ws.conditional_formatting.add(f"E11:E{10 + len(sorted_r)}", bar_rule)

    # 列幅
    ws.column_dimensions["A"].width = 6
    ws.column_dimensions["B"].width = 28
    ws.column_dimensions["C"].width = 14
    for c in "DEFG":
        ws.column_dimensions[c].width = 12
    for j in range(8, 8 + len(TARGET_MONTHS)):
        ws.column_dimensions[get_column_letter(j)].width = 12
    ws.freeze_panes = "B11"

    return ws
