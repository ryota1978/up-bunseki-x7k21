import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, gateToken } from "./lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const passphrase = process.env.APP_PASSPHRASE || "";
  if (!passphrase) {
    // 合言葉が未設定の場合は素通りさせる（/login側で設定不足の案内を表示する）
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = await gateToken(passphrase);
  if (cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
};
