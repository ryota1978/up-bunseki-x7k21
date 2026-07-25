"""
分類ルール・金額補正の単体テスト

DEVELOPER_GUIDE.md の「テスト方法」章に記載のケースを検証する。
"""

from classifiers import classify_project_file
from amount_corrections import apply_corrections


def test_paypay():
    result = classify_project_file("131_20251001_paypay_34894.pdf")
    assert result[0] == "売上集計", result


def test_amazon():
    result = classify_project_file("225_20251201_Amazon_28902.pdf")
    assert result[0] == "消耗品費", result


def test_chatgpt():
    result = classify_project_file("292_12月chatGPT.pdf")
    assert result[0] == "通信費", result


def test_choho_sales():
    result = classify_project_file("224_20251201_65789_11月ひかり調剤薬局.pdf")
    assert result[0] == "売上_調剤", result


def test_chatgpt_amount_correction():
    result = apply_corrections("1_20258月_chatGPT.pdf", 3000)
    assert result == 312, f"Expected 312, got {result}"


def test_amazon_order_number_correction():
    result = apply_corrections("247_20251215_Amazon_2164_7211443_.pdf", 7211443)
    assert result == 2164, f"Expected 2164, got {result}"


if __name__ == "__main__":
    test_paypay()
    test_amazon()
    test_chatgpt()
    test_choho_sales()
    test_chatgpt_amount_correction()
    test_amazon_order_number_correction()
    print("✅ 全テスト通過")
