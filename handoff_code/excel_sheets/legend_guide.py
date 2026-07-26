"""
凡例_運用ガイド シート

分類ルール（classifiers.py の判定パターン）と更新手順のドキュメントシート。
分類ルール表は classifiers.py のソースから自動生成するので、
ルールを変更したらこのシートも自動的に追随する。
"""

import inspect
import re

from config import TARGET_MONTHS, SHEET_ORDER, COMPANY, STORES
from ._common import (
    new_sheet, set_title, section, set_widths, write_header, write_row,
    note_block, SUBHEADER_FILL, WARNING_FILL,
)


SHEET_NAME = "凡例_運用ガイド"

# 各シートの役割（SHEET_ORDER と対応）
SHEET_PURPOSE = {
    "ダッシュボード": "月別 売上 vs 費用 vs クレジット引落 の全体ビュー",
    "支払先ダッシュボード": "主要支払先のランキング・月別マトリクス・シェア",
    "月別科目集計": "勘定科目×月のクロス集計（合計は実数式）＋科目別推移グラフ",
    "売上分析": "取引先別×月別の売上推移（積上げ棒）",
    "お客様決済_店舗別売上": "PayPay店舗別×月＋Airペイ/メルペイの判明分",
    "クレジット分析": "オリコCSVの科目別×支払月クロス集計＋シェア円グラフ",
    "通信費_内訳分析": "取引先別の月次推移＋サービス種別シェア",
    "NTT料金_削減提案": "NTT系の実支出と削減施策（handoff 7.2）",
    "保険料_内訳分析": "日薬保険4店舗内訳＋三井住友海上の内訳",
    "旅費交通費_内訳分析": "宿泊/交通/タクシーの区分別・取引先別",
    "接待交際費_内訳分析": "贈答/会食の区分別・取引先別",
    "電気代_店舗別分析": "グリムス明細から検針日で4店舗を推定",
    "電気代_削減シミュレーション": "最大店舗を他店舗平均まで下げた場合の削減試算",
    "消耗品_内訳分析": "取引先別の月次推移＋水道光熱費の月次",
    "Amazon購入分析": "領収書の商品カテゴリ・配送先別の分析",
    "まとめ買い候補": "リピート購入商品の抽出とまとめ買い節約試算",
    "不足薬郵送_在庫指標": "郵送費を在庫絞りすぎ指標として運用するテンプレート",
    "仕訳明細": "全領収書を1行ずつ計上",
    "クレジット明細_オリコ": "オリコCSV全件の利用明細",
    "凡例_運用ガイド": "分類ルール・更新方法（このシート）",
}

# 処理ルール（handoff の運用方針）
PROCESSING_RULES = [
    ("①", "グリムス＝電力会社として「水道光熱費」に計上"),
    ("②", "家族カードのガソリン・ETCは事業経費として計上"),
    ("③", "家族カードの食事は「私的（家族）」として集計から除外"),
    ("④", "勤怠資料・通帳・売上明細は「_資料」として集計から除外"),
    ("⑤", "Amazon領収書の金額は注文番号の誤認分を補正済み"),
    ("⑥", "ChatGPT/フラッシュモバイル/RayL の金額誤抽出を補正済み"),
    ("⑦", "勘定科目が「_」で始まるものは集計対象外"),
]


def extract_rules(func):
    """
    classifiers.py の判定関数のソースを読み、
    「正規表現パターン → (勘定科目, タグ)」の一覧を機械的に取り出す。
    ルールを増やすとこのシートも自動的に追随する。
    """
    try:
        src = inspect.getsource(func)
    except (OSError, TypeError):
        return []

    rules = []
    pending = []
    for line in src.split("\n"):
        s = line.strip()
        if s.startswith("#") or not s:
            continue
        # if re.search(r"...", fn) / if "xxx" in v
        m = re.search(r're\.search\(r?["\'](.+?)["\']\s*,', s)
        if m:
            pending.append(m.group(1))
            continue
        m = re.findall(r'["\']([^"\']+)["\']\s+in\s+\w+', s)
        if m:
            pending.extend(m)
            continue
        # return ("科目", "タグ", ...)
        m = re.search(r'return\s*\(\s*["\'](.+?)["\']\s*,\s*["\'](.*?)["\']', s)
        if m and pending:
            rules.append((" / ".join(pending), m.group(1), m.group(2)))
            pending = []
        elif m:
            # 直前の分岐に入ったうえで、そのネスト条件に当てはまらなかった場合の既定値
            rules.append(("（直前の条件に該当し、上の細分岐に当てはまらない場合）",
                          m.group(1), m.group(2)))
    return rules


def create_sheet(wb, records=None, cc=None):
    ws = new_sheet(wb, SHEET_NAME)
    set_title(ws, "📋 経費分類 運用ガイド（凡例）", "A1:D1")

    # ---------- 基本情報 ----------
    section(ws, 3, "■ 基本情報")
    r = 4
    for label, val in [
        ("会社名", COMPANY["name"]),
        ("代表者", COMPANY["president"]),
        ("登録番号", COMPANY["tax_id"]),
        ("対象期間", f"{TARGET_MONTHS[0]} 〜 {TARGET_MONTHS[-1]}（{len(TARGET_MONTHS)}ヶ月）"),
        ("対象店舗数", f"{len(STORES)} 店舗"),
        ("シート数", f"{len(SHEET_ORDER)} シート"),
    ]:
        r = write_row(ws, r, [label, val], fill=SUBHEADER_FILL if False else None)
        ws.cell(row=r - 1, column=1).fill = SUBHEADER_FILL

    # ---------- 店舗一覧 ----------
    sec1 = r + 2
    section(ws, sec1, "■ 店舗一覧")
    sr = write_header(ws, sec1 + 1, ["店舗名", "所在地", "位置づけ", "管理薬剤師"])
    for s in STORES:
        sr = write_row(ws, sr, [s["name"], s["location"], s["role"], s["pharmacist"]])

    # ---------- シート構成 ----------
    sec2 = sr + 2
    section(ws, sec2, "■ シート構成")
    cr = write_header(ws, sec2 + 1, ["No", "シート名", "内容"])
    for i, name in enumerate(SHEET_ORDER, 1):
        cr = write_row(ws, cr, [i, name, SHEET_PURPOSE.get(name, "")])

    # ---------- 分類ルール（領収書） ----------
    from classifiers import classify_project_file, classify_credit_vendor

    sec3 = cr + 2
    section(ws, sec3, "■ 分類ルール①: 領収書ファイル名 → 勘定科目"
                      "（classifiers.classify_project_file / 上から順に判定）")
    pr = write_header(ws, sec3 + 1, ["判定キーワード（正規表現）", "勘定科目", "補助タグ"])
    for pat, acct, tag in extract_rules(classify_project_file):
        pr = write_row(ws, pr, [pat, acct, tag])

    # ---------- 分類ルール（クレジット） ----------
    sec4 = pr + 2
    section(ws, sec4, "■ 分類ルール②: オリコ取引先名 → 勘定科目"
                      "（classifiers.classify_credit_vendor / 上から順に判定）")
    kr = write_header(ws, sec4 + 1, ["判定キーワード（正規表現）", "勘定科目", "補助タグ"])
    for pat, acct, tag in extract_rules(classify_credit_vendor):
        kr = write_row(ws, kr, [pat, acct, tag])
    ws.cell(row=kr, column=1,
            value="※ オリコの取引先名は全角カタカナのため、パターンも全角で記述しています"
            ).fill = WARNING_FILL

    # ---------- 処理ルール ----------
    sec5 = kr + 3
    section(ws, sec5, "■ 処理ルール")
    rr = write_header(ws, sec5 + 1, ["No", "ルール"])
    for no, rule in PROCESSING_RULES:
        rr = write_row(ws, rr, [no, rule])

    # ---------- 更新方法 ----------
    note_block(ws, rr + 2, [
        "■ 更新方法（毎月の運用手順）",
        "",
        "【STEP 1】 Dropboxの当月フォルダに領収書・請求書・オリコCSVを格納",
        "  → 電子取引データ/ファーマシー電子データ2026年7月期/<月>/",
        "  → ファイル名は「連番_日付_取引先_金額.pdf」の形式を維持してください",
        "    （分類も金額抽出もファイル名から行うため、命名が崩れると未分類になります）",
        "",
        "【STEP 2】 config.py を更新",
        "  → TARGET_MONTHS に新しい月を追加",
        "  → ORICO_CSV_FILES に当月のオリコCSVのパスと支払月を追加",
        "",
        "【STEP 3】 データ抽出を実行",
        "  → python3 main_extract.py   （領収書 → all_records_v5.json）",
        "  → python3 main_paypay.py    （PayPay PDF → paypay_sales.json）",
        "",
        "【STEP 4】 Excel を再生成",
        "  → python3 main_excel.py",
        "  → または run_all.sh で STEP3〜4 を一括実行",
        "",
        "【STEP 5】 未分類レコードの確認",
        "  → 「仕訳明細」シートで勘定科目＝「未分類」を絞り込み",
        "  → 該当する取引先が今後も続くなら classifiers.py にルールを追加",
        "  → 金額の誤抽出は amount_corrections.py に補正を追加",
        "",
        "■ 分類ルールを追加するには",
        "  1. classifiers.py の classify_project_file / classify_credit_vendor に",
        "     if re.search(...) の分岐を追加（判定は上から順なので、より具体的なルールを上に）",
        "  2. main_extract.py を再実行して中間JSONを作り直す",
        "  3. main_excel.py を再実行",
        "  4. この凡例シートの分類ルール表は自動生成なので、手動更新は不要です",
        "",
        "■ 既知の制約",
        "  • 2025/09 支払分のオリコCSVは未提供のため欠落しています",
        "  • Airペイ／メルペイは店舗別MIDの対応表がなく、店舗単位に分解できません",
        "  • Amazon領収書の一部は画像のみのPDFでテキスト抽出ができず、商品名が取れません",
        "  • 不足薬の郵送費は小口現金払いが多く、会計データに現れていない可能性があります",
    ])

    set_widths(ws, {"A": 46, "B": 26, "C": 46, "D": 20})
    return ws
