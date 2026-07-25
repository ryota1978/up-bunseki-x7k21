import { NextResponse } from "next/server";
import { AUTH_COOKIE, gateToken } from "@/lib/auth";
import { STORES } from "@/lib/constants";

type MemberLite = { id: string; store: string; person: string };

async function isAuthed(req: Request): Promise<boolean> {
  const passphrase = process.env.APP_PASSPHRASE || "";
  if (!passphrase) return true; // 未設定時はミドルウェアと同じ扱い
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${AUTH_COOKIE}=([^;]+)`));
  if (!match) return false;
  const expected = await gateToken(passphrase);
  return decodeURIComponent(match[1]) === expected;
}

export async function POST(req: Request) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ ok: false, message: "ログインが必要です。" }, { status: 401 });
  }

  let text = "";
  let members: MemberLite[] = [];
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text : "";
    members = Array.isArray(body?.members) ? body.members : [];
  } catch {
    return NextResponse.json({ ok: false, message: "リクエストを読み取れませんでした。" }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ ok: false, message: "文字起こしの内容が空です。" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "音声入力の読み取り機能が設定されていません（管理者向け: ANTHROPIC_API_KEYが未設定です）。下の欄に直接入力してください。" },
      { status: 500 }
    );
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
  const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const list = members.map((m) => `${m.id} / ${m.store} / ${m.person || "（担当者なし）"}`).join("\n");

  const prompt = `あなたは薬局チェーンの「店舗配布物 管理アプリ」の入力補助です。
話された内容から、登録する案件の情報を読み取ってJSONだけを返してください。

今日の日付: ${toKey(new Date())}
店舗ごとの済に使う4店舗: ${STORES.join(", ")}

メンバー一覧（id / 店舗 / 担当者）:
${list}

話された内容:
"""
${text}
"""

以下の形式のJSONだけを返してください。説明・前置き・コードブロックは不要です。
{
  "title": "案件の短いタイトル",
  "memberId": "最も合うメンバーのid。判断できなければ空文字",
  "content": "補足のメモ。なければ空文字",
  "due": "YYYY-MM-DD形式の期日。言及がなければ空文字",
  "meeting": true または false,
  "jimu": true または false,
  "byStore": true または false
}

判断の目安:
- 「明日まで」「来週」「今月末」などは今日の日付から計算する
- 店舗名や人名が出たら、最も近いメンバーのidを選ぶ
- 「会議で」「全体会議」などの話題なら meeting を true
- 「医療事務」「事務ミーティング」などの話題なら jimu を true
- 「全店舗」「各店」「みんなに配る」など複数店舗にまたがる場合は byStore を true
- タイトルは配布物の名前を短くまとめる`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, message: "読み取りサービスへの接続に失敗しました。時間をおいて再度お試しください。" }, { status: 502 });
    }

    const data = await res.json();
    const raw = ((data.content || []) as { type: string; text?: string }[]).map((i) => (i.type === "text" ? i.text || "" : "")).join("");
    const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json({ ok: true, result: parsed });
  } catch {
    return NextResponse.json({ ok: false, message: "うまく読み取れませんでした。もう一度話すか、文字を直してからお試しください。" }, { status: 500 });
  }
}
