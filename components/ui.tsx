"use client";

import { CheckSquare, Square, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { C, fontStack } from "@/lib/constants";

export const iconBtn: CSSProperties = { background: "none", border: "none", cursor: "pointer", color: C.faint, padding: 4 };

export const miniBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "5px 9px",
  fontSize: 11.5,
  fontWeight: 600,
  fontFamily: fontStack,
  color: C.sub,
  cursor: "pointer",
  flexShrink: 0,
};

export const ghostBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "none",
  color: C.sub,
  border: `1px solid ${C.line}`,
  borderRadius: 9,
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: fontStack,
  cursor: "pointer",
};

export const printBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: C.surface,
  color: C.sub,
  border: `1px solid ${C.line}`,
  borderRadius: 10,
  padding: "9px 13px",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: fontStack,
  cursor: "pointer",
  flexShrink: 0,
};

export const backupBar: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: C.surface,
  border: `1px solid ${C.amberSoft}`,
  borderRadius: 12,
  padding: "12px 14px",
  fontFamily: fontStack,
  cursor: "pointer",
  color: C.ink,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${C.line}`,
  background: "#FBFCFA",
  fontSize: 14,
  fontFamily: fontStack,
  color: C.ink,
  outline: "none",
};

export const primaryBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  background: C.teal,
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 600,
  fontFamily: fontStack,
  cursor: "pointer",
};

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30,36,40,0.42)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
        padding: 12,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: 16, width: "100%", maxWidth: 460, padding: 18, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: C.sub }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.sub, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

export function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 10,
        padding: "9px 14px",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: fontStack,
        cursor: "pointer",
        border: `1px solid ${active ? C.teal : C.line}`,
        background: active ? C.teal : C.surface,
        color: active ? "#fff" : C.sub,
      }}
    >
      {icon} {children}
    </button>
  );
}

export function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        borderRadius: 20,
        padding: "1px 7px",
        marginLeft: 2,
        background: active ? "rgba(255,255,255,0.22)" : C.line,
        color: active ? "#fff" : C.sub,
      }}
    >
      {n}
    </span>
  );
}

export function SortPill({
  active,
  onClick,
  icon,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  color?: string;
}) {
  const c = color || C.teal;
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 20,
        padding: "6px 12px",
        fontSize: 12.5,
        fontWeight: 600,
        fontFamily: fontStack,
        cursor: "pointer",
        border: `1px solid ${active ? c : C.line}`,
        background: active ? c : C.surface,
        color: active ? "#fff" : C.sub,
      }}
    >
      {icon} {children}
    </button>
  );
}

export function QuickBtn({ children, onClick, muted }: { children: ReactNode; onClick: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: muted ? "none" : C.tealSoft,
        color: muted ? C.faint : C.teal,
        border: muted ? `1px solid ${C.line}` : "none",
        borderRadius: 20,
        padding: "5px 11px",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: fontStack,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function ToggleBox({
  on,
  onClick,
  color,
  soft,
  title,
  note,
}: {
  on: boolean;
  onClick: () => void;
  color: string;
  soft: string;
  title: string;
  note: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        cursor: "pointer",
        background: on ? soft : "#FBFCFA",
        border: `1px solid ${on ? color : C.line}`,
        borderRadius: 10,
        padding: "11px 13px",
        marginBottom: 10,
      }}
    >
      <ToggleIcon on={on} color={color} />
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: on ? color : C.ink }}>{title}</div>
        <div style={{ fontSize: 11.5, color: C.sub, marginTop: 1, lineHeight: 1.5 }}>{note}</div>
      </div>
    </div>
  );
}

function ToggleIcon({ on, color }: { on: boolean; color: string }) {
  return on ? <CheckSquare size={18} color={color} /> : <Square size={18} color={C.faint} />;
}

export function MiniTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        borderRadius: 9,
        padding: "9px 10px",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: fontStack,
        cursor: "pointer",
        border: `1px solid ${active ? C.amber : C.line}`,
        background: active ? C.amberSoft : C.surface,
        color: active ? C.amber : C.sub,
      }}
    >
      {icon} {children}
    </button>
  );
}
