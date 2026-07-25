"use client";

import { Cloud, CloudOff, UserCircle } from "lucide-react";
import Link from "next/link";
import { C, fontStack } from "@/lib/constants";
import { miniBtn } from "@/components/ui";

export default function ConnectionBar({
  me,
  connection,
}: {
  me: string;
  connection: "connecting" | "online" | "offline";
}) {
  const online = connection === "online";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
        flexWrap: "wrap",
        background: online ? C.tealSoft : C.amberSoft,
        border: `1px solid ${online ? C.tealSoft : C.amber}`,
        borderRadius: 11,
        padding: "9px 12px",
      }}
    >
      {online ? <Cloud size={15} color={C.teal} style={{ flexShrink: 0 }} /> : <CloudOff size={15} color={C.amber} style={{ flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: online ? C.teal : C.amber, fontFamily: fontStack }}>
          {online ? "共有中（同じ端末どうしで同じデータ）" : connection === "connecting" ? "接続しています…" : "共有できていません"}
        </div>
        {!online && connection !== "connecting" && (
          <div style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>通信環境をご確認ください。自動で再接続します</div>
        )}
      </div>
      <Link href="/login?step=name" style={{ ...miniBtn, textDecoration: "none", background: C.surface }} title="自分の名前を変更">
        <UserCircle size={13} /> {me || "名前を選ぶ"}
      </Link>
    </div>
  );
}
