"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Package } from "lucide-react";
import { C, ME_KEY, fontStack } from "@/lib/constants";
import NamePicker from "@/components/NamePicker";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/";
  const startAtName = params.get("step") === "name";

  const [step, setStep] = useState<"passphrase" | "name">(startAtName ? "name" : "passphrase");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState("");

  useEffect(() => {
    // ローカルストレージはサーバー側で読めないため、サーバーとクライアントの表示を一致させてから
    // マウント後にだけ復元する（意図的にeffect内でsetStateしている）。
    try {
      const saved = window.localStorage.getItem(ME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setMe(saved);
    } catch {
      /* noop */
    }
  }, []);

  const submitPassphrase = async () => {
    if (!passphrase.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "合言葉が違います。もう一度お試しください。");
        setBusy(false);
        return;
      }
      setStep("name");
    } catch {
      setError("サーバーに接続できませんでした。通信環境をご確認のうえ、時間をおいて再度お試しください。");
    }
    setBusy(false);
  };

  const pickName = (name: string) => {
    setMe(name);
    try {
      window.localStorage.setItem(ME_KEY, name);
    } catch {
      /* noop */
    }
    router.push(nextPath);
    router.refresh();
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: C.bg,
        fontFamily: fontStack,
        color: C.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, justifyContent: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: C.teal, display: "grid", placeItems: "center" }}>
            <Package size={21} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>ユナイテッドファーマシー</div>
            <div style={{ fontSize: 11.5, color: C.sub }}>〜仕事を皆で進めよう2026〜</div>
          </div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 22 }}>
          {step === "passphrase" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                <KeyRound size={17} color={C.teal} />
                <span style={{ fontSize: 15, fontWeight: 700 }}>合言葉を入力してください</span>
              </div>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitPassphrase()}
                placeholder="合言葉"
                autoFocus
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${C.line}`,
                  background: "#FBFCFA",
                  fontSize: 15,
                  fontFamily: fontStack,
                  color: C.ink,
                  outline: "none",
                  marginBottom: 12,
                }}
              />
              {error && (
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    padding: "9px 12px",
                    borderRadius: 9,
                    background: C.amberSoft,
                    color: C.amber,
                    marginBottom: 12,
                  }}
                >
                  {error}
                </div>
              )}
              <button
                onClick={submitPassphrase}
                disabled={!passphrase.trim() || busy}
                style={{
                  width: "100%",
                  background: C.teal,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: fontStack,
                  cursor: "pointer",
                  opacity: !passphrase.trim() || busy ? 0.5 : 1,
                }}
              >
                {busy ? "確認中…" : "次へ"}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>あなたのお名前を選んでください</div>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 14, lineHeight: 1.6 }}>
                この端末に記憶され、次回から自動で復帰します。更新履歴に「誰が触ったか」として記録されます。
              </div>
              <NamePicker current={me} onPick={pickName} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
