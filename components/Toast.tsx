"use client";

import { AlertTriangle, Check } from "lucide-react";
import { C, fontStack } from "@/lib/constants";

export type ToastItem = { id: number; kind: "ok" | "error"; text: string };

export function ToastStack({ items }: { items: ToastItem[] }) {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        zIndex: 80,
        pointerEvents: "none",
        padding: "0 12px",
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            maxWidth: 420,
            width: "100%",
            background: t.kind === "ok" ? C.teal : C.stamp,
            color: "#fff",
            borderRadius: 12,
            padding: "11px 14px",
            fontFamily: fontStack,
            fontSize: 13,
            lineHeight: 1.5,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          {t.kind === "ok" ? <Check size={16} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
