"use client";

import { useState } from "react";
import { AlertTriangle, CalendarDays, Check, Paperclip, Pencil, RotateCcw, Store, Trash2, User } from "lucide-react";
import { C, FLAGS, STORES, fontStack } from "@/lib/constants";
import type { FlagKey, Member, Task } from "@/lib/types";
import { doneStoreList, dueMeta, hasPerson, memberLine } from "@/lib/utils";
import { ghostBtn, iconBtn } from "@/components/ui";
import { FlagCheck } from "@/components/FlagViews";

export function TaskCard({
  task,
  member,
  attachmentCount = 0,
  onSetDone,
  onToggleStore,
  onAllStores,
  onToggleFlag,
  onEdit,
}: {
  task: Task;
  member: Member | undefined;
  attachmentCount?: number;
  onSetDone: (id: string, v: boolean) => void;
  onToggleStore: (id: string, store: string) => void;
  onAllStores: (id: string, v: boolean) => void;
  onToggleFlag: (id: string, key: FlagKey) => void;
  onEdit: () => void;
}) {
  const due = dueMeta(task.due);
  const doneCount = doneStoreList(task).length;
  const flagged = task.meeting || task.jimu;
  const edgeColor = task.meeting && task.jimu ? C.plum : task.meeting ? C.navy : task.jimu ? C.plum : C.line;

  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 14,
        overflow: "hidden",
        border: `1px solid ${edgeColor}`,
        boxShadow: flagged ? `0 0 0 2px ${task.meeting ? C.navySoft : C.plumSoft}` : "none",
      }}
    >
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, lineHeight: 1.4 }}>{task.title || "（無題）"}</h3>
              {due ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, fontWeight: due.bold ? 700 : 600, padding: "2px 8px", borderRadius: 20, background: due.bg, color: due.fg }}>
                  <CalendarDays size={11} /> {due.text}
                </span>
              ) : (
                <span style={{ fontSize: 11.5, color: C.faint, padding: "2px 4px" }}>期日なし</span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: C.teal, fontWeight: 600 }}>
                <Store size={13} /> {member ? member.store : "（削除された店舗）"}
              </span>
              {hasPerson(member) && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12.5, color: C.sub }}>
                  <User size={12} /> {member!.person}
                </span>
              )}
              {attachmentCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, color: C.sub }}>
                  <Paperclip size={12} /> {attachmentCount}
                </span>
              )}
            </div>

            {task.content && <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.55, color: C.sub, whiteSpace: "pre-wrap" }}>{task.content}</p>}
          </div>

          <button onClick={onEdit} title="修正" style={{ ...iconBtn, flexShrink: 0 }}>
            <Pencil size={15} />
          </button>
        </div>
      </div>

      {task.by_store && (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>店舗ごとに済を入れる</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: doneCount ? C.teal : C.faint }}>
              {doneCount} / {STORES.length}
            </span>
            {doneCount > 0 && (
              <button
                onClick={() => onAllStores(task.id, false)}
                style={{ marginLeft: "auto", background: "none", border: "none", color: C.faint, fontSize: 11.5, fontFamily: fontStack, cursor: "pointer", padding: 2 }}
              >
                すべて外す
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {STORES.map((s) => {
              const on = !!(task.stores_done && task.stores_done[s]);
              return (
                <button
                  key={s}
                  onClick={() => onToggleStore(task.id, s)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    background: on ? C.stampSoft : C.surface,
                    border: `1.5px solid ${on ? C.stamp : C.line}`,
                    borderRadius: 10,
                    padding: "9px 4px",
                    cursor: "pointer",
                    fontFamily: fontStack,
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: on ? C.stamp : C.ink }}>{s}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: on ? C.stamp : C.faint }}>{on ? "済" : "未"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, padding: "12px 16px 0", flexWrap: "wrap" }}>
        <FlagCheck def={FLAGS.meeting} checked={!!task.meeting} onClick={() => onToggleFlag(task.id, "meeting")} />
        <FlagCheck def={FLAGS.jimu} checked={!!task.jimu} onClick={() => onToggleFlag(task.id, "jimu")} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 14px", alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => (task.by_store ? onAllStores(task.id, true) : onSetDone(task.id, true))}
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: C.stamp,
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "9px 18px",
            fontSize: 13.5,
            fontWeight: 600,
            fontFamily: fontStack,
            cursor: "pointer",
          }}
        >
          <Check size={15} /> {task.by_store ? "全店舗 済" : "済にする"}
        </button>
      </div>
    </div>
  );
}

export function DoneCard({
  task,
  member,
  attachmentCount = 0,
  onSetDone,
  onAllStores,
  onRemove,
  onToggleFlag,
}: {
  task: Task;
  member: Member | undefined;
  attachmentCount?: number;
  onSetDone: (id: string, v: boolean) => void;
  onAllStores: (id: string, v: boolean) => void;
  onRemove: (id: string) => void;
  onToggleFlag: (id: string, key: FlagKey) => void;
}) {
  const [confirm, setConfirm] = useState(false);

  const undo = () => {
    if (task.by_store) onAllStores(task.id, false);
    else onSetDone(task.id, false);
  };

  if (confirm) {
    return (
      <div style={{ background: C.stampSoft, border: `1px solid ${C.stamp}`, borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={16} color={C.stamp} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>
            「{task.title || "（無題）"}」を削除しますか？
            <br />
            <span style={{ fontSize: 12, color: C.sub }}>削除すると元に戻せません。</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
          <button onClick={() => setConfirm(false)} style={{ ...ghostBtn, background: C.surface }}>
            やめる
          </button>
          <button
            onClick={() => onRemove(task.id)}
            style={{ marginLeft: "auto", background: C.stamp, color: "#fff", border: "none", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, fontFamily: fontStack, cursor: "pointer" }}
          >
            削除する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.surface, borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Stamp />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title || "（無題）"}</div>
            {attachmentCount > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 11.5, color: C.sub, flexShrink: 0 }}>
                <Paperclip size={11} /> {attachmentCount}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{memberLine(member)}</div>
        </div>
        <button onClick={undo} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12 }} title="未処理に戻す">
          <RotateCcw size={13} /> 戻す
        </button>
        <button onClick={() => setConfirm(true)} style={{ ...iconBtn, color: C.stamp }} title="削除">
          <Trash2 size={15} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
        <FlagCheck small def={FLAGS.meeting} checked={!!task.meeting} onClick={() => onToggleFlag(task.id, "meeting")} />
        <FlagCheck small def={FLAGS.jimu} checked={!!task.jimu} onClick={() => onToggleFlag(task.id, "jimu")} />
      </div>
    </div>
  );
}

function Stamp() {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: "50%",
        border: `2px solid ${C.stamp}`,
        color: C.stamp,
        display: "grid",
        placeItems: "center",
        fontSize: 18,
        fontWeight: 800,
        transform: "rotate(-8deg)",
        background: C.stampSoft,
      }}
    >
      済
    </div>
  );
}
