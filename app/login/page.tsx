"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package } from "lucide-react";
import { C, ME_KEY, fontStack } from "@/lib/constants";
import NamePicker from "@/components/NamePicker";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/";

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
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>あなたのお名前を選んでください</div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 14, lineHeight: 1.6 }}>
            この端末に記憶され、次回から自動で復帰します。更新履歴に「誰が触ったか」として記録されます。
          </div>
          <NamePicker current={me} onPick={pickName} />
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
