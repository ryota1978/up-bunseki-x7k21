import { NextResponse } from "next/server";
import { AUTH_COOKIE, gateToken } from "@/lib/auth";

export async function POST(req: Request) {
  let passphrase = "";
  try {
    const body = await req.json();
    passphrase = typeof body?.passphrase === "string" ? body.passphrase : "";
  } catch {
    return NextResponse.json({ ok: false, message: "リクエストを読み取れませんでした。" }, { status: 400 });
  }

  const correct = process.env.APP_PASSPHRASE || "";
  if (!correct) {
    return NextResponse.json(
      { ok: false, message: "サーバー側で合言葉が設定されていません。管理者（Vercelの環境変数 APP_PASSPHRASE）に連絡してください。" },
      { status: 500 }
    );
  }

  if (!passphrase || passphrase !== correct) {
    return NextResponse.json({ ok: false, message: "合言葉が違います。もう一度お試しください。" }, { status: 401 });
  }

  const token = await gateToken(correct);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
