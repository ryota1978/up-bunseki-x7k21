"use client";

import { useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronRight,
  Copy,
  Presentation,
  Printer,
  Square,
  Stethoscope,
  Store,
  User,
} from "lucide-react";
import { C, FLAGS, fontStack } from "@/lib/constants";
import type { Member, Task, TaskSortKey } from "@/lib/types";
import { copyToClipboard, doneText, doPrint, dueMeta, formatDue, hasPerson, type TaskGroup } from "@/lib/utils";
import { ghostBtn, printBtn, SortPill } from "@/components/ui";

type FlagDef = typeof FLAGS.meeting | typeof FLAGS.jimu;
const ICONS = { meeting: Presentation, jimu: Stethoscope } as const;

export function FlagBar({ def, count, onOpen }: { def: FlagDef; count: number; onOpen: () => void }) {
  const has = count > 0;
  const Icon = ICONS[def.key];
  return (
    <button
      onClick={onOpen}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 8,
        background: has ? def.color : C.surface,
        color: has ? "#fff" : C.sub,
        border: `1px solid ${has ? def.color : C.line}`,
        borderRadius: 12,
        padding: "12px 15px",
        fontFamily: fontStack,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <Icon size={18} color={has ? "#fff" : def.color} />
      <span style={{ fontSize: 14.5, fontWeight: 700 }}>{def.full}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          borderRadius: 20,
          padding: "2px 9px",
          background: has ? "rgba(255,255,255,0.22)" : def.soft,
          color: has ? "#fff" : def.color,
        }}
      >
        {count}件
      </span>
      <ChevronRight size={17} style={{ marginLeft: "auto", opacity: 0.75 }} />
    </button>
  );
}

export function FlagCheck({
  def,
  checked,
  onClick,
  small,
}: {
  def: FlagDef;
  checked: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: checked ? def.color : "none",
        color: checked ? "#fff" : C.sub,
        border: `1px solid ${checked ? def.color : C.line}`,
        borderRadius: 9,
        padding: small ? "6px 9px" : "8px 12px",
        fontSize: small ? 11.5 : 12.5,
        fontWeight: 600,
        fontFamily: fontStack,
        cursor: "pointer",
      }}
    >
      {checked ? <CheckSquare size={14} /> : <Square size={14} />} {def.label}へ
    </button>
  );
}

export function FlagListView({
  def,
  tasks,
  groups,
  sortBy,
  setSortBy,
  memberById,
  onBack,
  onToggle,
  onClearAll,
}: {
  def: FlagDef;
  tasks: Task[];
  groups: TaskGroup[];
  sortBy: TaskSortKey;
  setSortBy: (v: TaskSortKey) => void;
  memberById: Record<string, Member | undefined>;
  onBack: () => void;
  onToggle: (id: string) => void;
  onClearAll: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const Icon = ICONS[def.key];

  const buildText = () => {
    const today = new Date();
    let out = `【${def.full}】${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}\n\n`;
    groups.forEach((g) => {
      if (g.label) out += `■ ${g.label}\n`;
      g.items.forEach((t) => {
        const m = t.member_id ? memberById[t.member_id] : undefined;
        const who = !m ? "不明" : sortBy === "store" ? (hasPerson(m) ? m.person : "担当なし") : m.store;
        const dueTxt = t.due ? `／期日 ${formatDue(t.due)}` : "";
        out += `・${t.title || "（無題）"}（${who}）／${doneText(t)}${dueTxt}\n`;
        if (t.content) out += `　　${t.content.replace(/\n/g, " ")}\n`;
      });
      out += "\n";
    });
    return out.trim();
  };

  const doCopy = async () => {
    const ok = await copyToClipboard(buildText());
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div>
      <header style={{ padding: "22px 0 14px" }}>
        <button
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "none",
            border: "none",
            color: C.sub,
            fontSize: 13.5,
            fontFamily: fontStack,
            cursor: "pointer",
            padding: "4px 0 10px",
          }}
        >
          <ArrowLeft size={15} /> 案件一覧へ戻る
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: def.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon size={20} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{def.full}</h1>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.sub }}>チェックした案件 {tasks.length}件</p>
          </div>
          {tasks.length > 0 && (
            <button onClick={doPrint} style={printBtn} title="このリストを印刷">
              <Printer size={15} /> 印刷
            </button>
          )}
        </div>
      </header>

      {tasks.length === 0 ? (
        <div style={{ background: C.surface, border: `1px dashed ${C.line}`, borderRadius: 14, padding: "40px 20px", textAlign: "center" }}>
          <Icon size={30} color={C.faint} />
          <p style={{ color: C.sub, fontSize: 14, margin: "12px 0 0", lineHeight: 1.6 }}>
            まだ転載する案件がありません。
            <br />
            案件カードの「{def.label}」にチェックを入れると、ここにまとまります。
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <ArrowDownUp size={13} color={C.sub} />
            <SortPill color={def.color} active={sortBy === "store"} onClick={() => setSortBy("store")} icon={<Store size={13} />}>
              店舗別
            </SortPill>
            <SortPill color={def.color} active={sortBy === "person"} onClick={() => setSortBy("person")} icon={<User size={13} />}>
              人別
            </SortPill>
            <SortPill color={def.color} active={sortBy === "due"} onClick={() => setSortBy("due")} icon={<CalendarDays size={13} />}>
              期日順
            </SortPill>
            <button
              onClick={doCopy}
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: copied ? C.tealSoft : C.surface,
                color: copied ? C.teal : C.sub,
                border: `1px solid ${copied ? C.tealSoft : C.line}`,
                borderRadius: 20,
                padding: "6px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                fontFamily: fontStack,
                cursor: "pointer",
              }}
            >
              {copied ? (
                <>
                  <Check size={13} /> コピーしました
                </>
              ) : (
                <>
                  <Copy size={13} /> 文章でコピー
                </>
              )}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {groups.map((g) => (
              <div key={g.key}>
                {g.label && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, paddingBottom: 7, borderBottom: `2px solid ${def.soft}` }}>
                    {sortBy === "store" ? <Store size={15} color={def.color} /> : <User size={15} color={def.color} />}
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: def.color }}>{g.label}</span>
                    <span style={{ fontSize: 11.5, color: C.faint }}>{g.items.length}件</span>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {g.items.map((t) => (
                    <FlagRow key={t.id} def={def} task={t} member={t.member_id ? memberById[t.member_id] : undefined} sortBy={sortBy} onToggle={() => onToggle(t.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 26, textAlign: "center" }}>
            {confirmClear ? (
              <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                <span style={{ fontSize: 13, color: C.sub }}>全て解除しますか？</span>
                <button onClick={() => setConfirmClear(false)} style={{ ...ghostBtn, padding: "7px 12px" }}>
                  やめる
                </button>
                <button
                  onClick={() => {
                    onClearAll();
                    setConfirmClear(false);
                  }}
                  style={{ background: C.stamp, color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, fontFamily: fontStack, cursor: "pointer" }}
                >
                  解除する
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} style={{ ...ghostBtn, padding: "8px 14px" }}>
                済んだらチェックを一括解除
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FlagRow({
  def,
  task,
  member,
  sortBy,
  onToggle,
}: {
  def: FlagDef;
  task: Task;
  member: Member | undefined;
  sortBy: TaskSortKey;
  onToggle: () => void;
}) {
  const due = dueMeta(task.due);
  const done = task.by_store ? undefined : task.done; // 表示用テキストは doneText で統一
  const sub = !member ? "（不明）" : sortBy === "store" ? (hasPerson(member) ? member.person : "担当者なし") : member.store;
  const other = def.key === "meeting" ? (task.jimu ? FLAGS.jimu : null) : task.meeting ? FLAGS.meeting : null;
  void done;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 11, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{task.title || "（無題）"}</span>
          {due && (
            <span style={{ fontSize: 11, fontWeight: due.bold ? 700 : 600, padding: "2px 7px", borderRadius: 20, background: due.bg, color: due.fg }}>{due.text}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: C.sub }}>{sub}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 20,
              background: task.done || task.by_store ? C.stampSoft : C.tealSoft,
              color: task.done || task.by_store ? C.stamp : C.teal,
            }}
          >
            {doneText(task)}
          </span>
          {other && (
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: other.soft, color: other.color }}>{other.label}にも</span>
          )}
        </div>
        {task.content && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: C.sub, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{task.content}</p>}
      </div>
      <button onClick={onToggle} title="リストから外す" style={{ background: "none", border: "none", cursor: "pointer", color: def.color }}>
        <CheckSquare size={17} />
      </button>
    </div>
  );
}
