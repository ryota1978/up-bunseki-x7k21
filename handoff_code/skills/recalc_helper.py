"""
Excel数式検証ヘルパー

/mnt/skills/public/xlsx/scripts/recalc.py をラップして使いやすく。
"""

import subprocess
import os


def verify_excel(xlsx_path):
    """
    Excelファイルの数式エラーを検証する。

    Returns:
        検証結果の辞書
    """
    recalc_script = "/mnt/skills/public/xlsx/scripts/recalc.py"
    if not os.path.exists(recalc_script):
        return {"status": "skipped", "reason": "recalc.py が見つかりません"}

    try:
        result = subprocess.run(
            ["python3", recalc_script, xlsx_path],
            capture_output=True,
            text=True,
            timeout=60,
        )
        return {
            "status": "ok" if result.returncode == 0 else "error",
            "stdout": result.stdout[-500:],
            "stderr": result.stderr[-500:] if result.stderr else None,
        }
    except subprocess.TimeoutExpired:
        return {"status": "timeout"}
    except Exception as e:
        return {"status": "error", "error": str(e)}
