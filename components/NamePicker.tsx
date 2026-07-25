"use client";

import { Check, UserCircle } from "lucide-react";
import { C, fontStack, LOGIN_NAMES } from "@/lib/constants";

export default function NamePicker({
  current,
  onPick,
}: {
  current: string;
  onPick: (name: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {LOGIN_NAMES.map((name) => {
        const on = current === name;
        return (
          <button
            key={name}
            onClick={() => onPick(name)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textAlign: "left",
              background: on ? C.tealSoft : C.surface,
              border: `1.5px solid ${on ? C.teal : C.line}`,
              borderRadius: 12,
              padding: "16px 16px",
              cursor: "pointer",
              fontFamily: fontStack,
            }}
          >
            <UserCircle size={22} color={on ? C.teal : C.faint} />
            <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: on ? C.teal : C.ink }}>{name}さん</span>
            {on && <Check size={18} color={C.teal} />}
          </button>
        );
      })}
    </div>
  );
}
