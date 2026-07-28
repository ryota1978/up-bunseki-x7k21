"""
勘定科目 分類ルール

プロジェクト側（ファイル名パース）とクレジット側（取引先名）の
両方の判定ロジックを持つ。
"""

import re


def classify_project_file(filename):
    """
    プロジェクトファイル（レシート/請求書）のファイル名から勘定科目判定。

    優先度順に判定する。最初にマッチしたルールを採用。

    Args:
        filename: ファイル名（拡張子含む）

    Returns:
        (account, tag, vendor) タプル
    """
    fn = filename

    # ============ 売上系 ============
    if re.search(r"^222|^223|^224|11月ひかり|12月ひかり|1月ひかり", fn):
        # 「222_20251201_181_11月ひかり薬局_射和店_.pdf」など
        return ("売上_調剤", "調剤売上", "各店舗の月次売上")

    if re.search(r"志摩センター(?!.*薬局)", fn):
        # 志摩センター（仕入・売上の両方あるので下位で判定）
        return ("仕入高", "医薬品仕入", "志摩センター薬局")

    # 業務委託売上
    if re.search(r"鈴鹿医療科学大学|度会特別支援学校|タイガー薬局|ユニスマイル|名城大学|リバイバル|射和ロッカー|松阪市役所", fn):
        return ("売上_業務委託", "業務委託", "外部委託先")

    # 決済プラットフォーム売上
    if re.search(r"エアペイ|エアメイト|Airペイ|paypay|ペイペイ|メルペイ|メル[ぺペ]イ|メルカリ", fn, re.IGNORECASE):
        if "利用料" in fn or "加盟店" in fn:
            return ("支払手数料", "決済手数料", "決済プラットフォーム")
        return ("売上集計", "決済プラットフォーム", "PayPay/Airペイ/メルペイ")

    # ============ 仕入 ============
    if re.search(r"シンフォニア商事|メディセオ|メディカルセオ|東邦薬品|アルフレッサ", fn):
        return ("仕入高", "医薬品仕入", "医薬品卸")

    # ============ 外注費 ============
    if re.search(r"松永先生|野村先生|eNECT|eNEXT|渡部|志摩の里|株ヒトイキ|BIアカウンティング|ＢＩ|中原先生|法子先生|旅する薬剤師", fn):
        return ("外注費", "業務委託・外注", "外注先")

    # ============ 通信費 ============
    if re.search(r"NTT|ドコモ|DOCOMO", fn, re.IGNORECASE):
        return ("通信費", "通信回線", "NTT/ドコモ")

    if re.search(r"フラッシュモバイル|RayL|レイル", fn):
        return ("通信費", "モバイル", "モバイルサービス")

    if re.search(r"chatGPT|ChatGPT|チャットGPT|OpenAI", fn):
        return ("通信費", "AI-SaaS", "ChatGPT")

    if re.search(r"Claude|Anthropic", fn):
        return ("通信費", "AI-SaaS", "Claude")

    if re.search(r"apple|Apple|iCloud", fn):
        return ("通信費", "業務SaaS", "Apple")

    if re.search(r"DMM", fn):
        return ("通信費", "会員費", "DMM（挟間研至さん会員費）")

    if re.search(r"ジョブカン|Zoom|Dropbox|Google|YouTube|Pollo|ラインワークス|ライン.*ワークス|コムデックライン|X_corp", fn, re.IGNORECASE):
        return ("通信費", "業務SaaS", "業務用SaaS")

    if re.search(r"ガスパル", fn):
        # 補足: ガスパルは"ガスの請求"だが、事務所では通信費扱いの可能性あり
        return ("通信費", "その他", "ガスパル")

    # ============ 広告宣伝費 ============
    if re.search(r"ラクスル|Indeed|インディード", fn, re.IGNORECASE):
        return ("広告宣伝費", "広告", "ラクスル/Indeed")

    # ============ 保険料 ============
    if re.search(r"日薬保険|日本薬剤師", fn):
        return ("保険料", "薬剤師保険", "日本薬剤師会")

    if re.search(r"三井住友海上|MSA", fn):
        return ("保険料", "業務用保険", "三井住友海上火災")

    # ============ 消耗品費 ============
    if re.search(r"Amazon|amazon|amzon|amaon", fn, re.IGNORECASE):
        return ("消耗品費", "Amazon", "Amazon.co.jp")

    if re.search(r"ヨドバシ|楽天|Rakuten|アスクル|ソロエルアリーナ|高島屋|タカシマヤ|ミライヤ", fn, re.IGNORECASE):
        return ("消耗品費", "小売店", "小売店")

    # ============ 支払手数料 ============
    if re.search(r"ファーマシフト", fn):
        return ("支払手数料", "システム利用料", "ファーマシフト")

    if re.search(r"コムデック", fn):
        return ("支払手数料", "システム保守", "コムデック")

    if re.search(r"セコム", fn):
        return ("支払手数料", "警備", "セコム")

    if re.search(r"百五|JCB", fn):
        return ("支払手数料", "金融手数料", "金融機関")

    # ============ 接待交際費 ============
    if re.search(r"松幸|贈答", fn):
        return ("接待交際費", "贈答", "松幸農産")

    # ============ 研修費 ============
    if re.search(r"薬剤師研修|勉強会|研修", fn):
        return ("研修費", "研修", "研修主催者")

    # ============ その他 ============
    if re.search(r"通帳|銀行|振込", fn):
        return ("_資料", "資料", "通帳・振込資料")

    if re.search(r"オリコ|クレジット", fn):
        return ("クレジット引落", "オリコ", "オリコクレジット")

    if re.search(r"アメリカンエキスプレス|アメックス|AMEX", fn, re.IGNORECASE):
        return ("クレジット引落", "AMEX", "アメリカン・エキスプレス")

    # デフォルト
    return ("未分類", "", "")


def classify_credit_vendor(vendor):
    """
    クレジット明細（オリコCSV）の取引先名から勘定科目判定。

    注意: オリコの取引先名はカタカナ全角。

    Args:
        vendor: 取引先名（例: "ＮＴＴニシニホン ゴリヨウリヨウキン"）

    Returns:
        (account, tag) タプル
    """
    v = vendor or ""

    # ============ 水道光熱費 ============
    if "グリムス" in v:
        return ("水道光熱費", "電気代")

    # ============ 通信費 ============
    if re.search(r"ＮＴＴニシニホン|NTT.*ニシ|ＮＴＴドコモ", v):
        return ("通信費", "NTT")
    if "ハイホー" in v:
        return ("通信費", "プロバイダ")
    if re.search(r"ＣＨＡＴＧＰＴ|CHATGPT|ＯＰＥＮＡＩ|OPENAI", v):
        return ("通信費", "ChatGPT")
    if re.search(r"ＣＬＡＵＤＥ|CLAUDE|ＡＮＴＨＲＯＰＩＣ|ANTHROPIC", v):
        return ("通信費", "Claude")
    if re.search(r"ＡＰＰＬＥ|APPLE", v):
        return ("通信費", "Apple")
    if re.search(r"ＧＯＯＧＬＥ|GOOGLE|ＹＯＵＴＵＢＥ|YOUTUBE", v):
        return ("通信費", "Google/YouTube")
    if "ジヨブカン" in v or "ジョブカン" in v:
        return ("通信費", "ジョブカン")
    if "ユージェイ" in v or "ＵＪ" in v:
        return ("通信費", "ユージェイ（HP維持費）")
    if "ユウセン" in v or "ＵＳＥＮ" in v:
        return ("通信費", "USEN（BGM）")
    if re.search(r"ＤＲＯＰＢＯＸ|DROPBOX", v):
        return ("通信費", "Dropbox")
    if re.search(r"ＺＯＯＭ|ZOOM", v):
        return ("通信費", "Zoom")
    if re.search(r"Ｘ\s*ＣＯＲＰ|X CORP", v):
        return ("通信費", "X（旧Twitter）")
    if re.search(r"ＰＯＬＬＯ|POLLO", v):
        return ("通信費", "Pollo AI")
    if re.search(r"ＲＭＩＬＫ|REMEMBER", v):
        return ("通信費", "Remember the Milk")
    if "レイル" in v:
        return ("通信費", "RayL")

    # ============ 保険料 ============
    if "三井住友海上" in v:
        return ("保険料", "業務用火災保険")

    # ============ 旅費交通費 ============
    if re.search(r"ＥＴＣ|近鉄|ＪＲ|タクシー|ホテル|ＡＮＡ|ＪＡＬ|新幹線", v):
        return ("旅費交通費", "交通")

    # ============ 車両費（ガソリン系） ============
    # ※ 家族利用でも「事業」扱い（config.FAMILY_CARD_RULES）
    if re.search(r"アポロ|コスモ|エネオス|ＥＮＥＯＳ|ＪＡＳＳ|ＢＭＷ|ＩＤＥＭＩＴＳＵ|出光", v):
        return ("車両費", "ガソリン")

    # ============ 接待交際費 ============
    if re.search(r"高島屋|タカシマヤ|焼肉|寿司|バル|ステーキ|ＳＱ\*ヤキニク", v):
        return ("接待交際費", "会食・贈答")

    # ============ 福利厚生費 ============
    if re.search(r"ハマ寿司|モス|マック|コメダ|セブンイレブン|ローソン|ファミマ", v):
        return ("福利厚生費", "食事等")

    # ============ 研修費 ============
    if re.search(r"薬剤師研修認定|Peatix|ピーティックス", v):
        return ("研修費", "研修")

    # ============ 消耗品費 ============
    if re.search(r"ＡＭＡＺＯＮ|AMAZON", v):
        return ("消耗品費", "Amazon")
    if re.search(r"オフィスコム|メルカリ|ウエルシア|ミライヤ|ビックカメラ|ヤマダ|ケーズ|カメラのキタムラ|ダイソー|セカンドストリート", v):
        return ("消耗品費", "小売店")

    # ============ 通信運搬費 ============
    if "ニツポンユウビン" in v or "日本郵便" in v:
        # 家族カード扱いなので用途要確認
        return ("消耗品費", "郵便（要確認）")

    # デフォルト
    return ("未分類", "")
