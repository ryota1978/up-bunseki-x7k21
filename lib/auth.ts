export const AUTH_COOKIE = "up_auth";

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 合言葉から、cookieに保存する検証用トークンを作る（合言葉そのものは保存しない） */
export async function gateToken(passphrase: string): Promise<string> {
  const enc = new TextEncoder().encode(`up-bunseki-gate:${passphrase}`);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return toHex(digest);
}
