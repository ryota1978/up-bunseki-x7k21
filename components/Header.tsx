"use client";

import { Package } from "lucide-react";
import { C } from "@/lib/constants";

export default function Header() {
  return (
    <header style={{ padding: "26px 0 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: C.teal, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Package size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "0.02em" }}>ユナイテッドファーマシー</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.sub }}>〜仕事を皆で進めよう2026〜</p>
        </div>
      </div>
    </header>
  );
}
