import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!url && !!anonKey;

// 環境変数が未設定でもビルド・ログイン画面表示は落ちないよう、ダミー値でクライアントを作る。
// 実際の読み書きは supabaseConfigured を見て呼び出し側で防ぐ。
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key"
);
