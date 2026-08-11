"use client";

import { useState } from "react";
import { ArrowDownUp, CalendarDays, ChevronRight, Clock, Mic, Package, Plus, Search, Store, User } from "lucide-react";
import { C, TASK_SORTS, fontStack } from "@/lib/constants";
import type { Attachment, FlagKey, Member, NewTaskInput, Task, TaskSortKey, VoiceDraft } from "@/lib/types";
import type { RetryResult } from "@/lib/retry";
import type { TaskGroup } from "@/lib/utils";
import { SortPill } from "@/components/ui";
import { DoneCard, TaskCard } from "@/components/TaskCard";
import { TaskModal } from "@/components/TaskModal";
import { VoiceModal } from "@/components/VoiceModal";

const SORT_ICONS: Record<TaskSortKey, React.ReactNode> = {
  due: <CalendarDays size={13} />,
  store: <Store size={13} />,
  person: <User size={13} />,
  new: <Clock size={13} />,
};

type ModalState = { mode: "add" | "edit" | "voice"; task?: Task; draft?: VoiceDraft } | null;

export function TasksView({
  members,
  memberById,
  groups,
  shownCount,
  allActiveCount,
  sortBy,
  setSortBy,
  doneTasks,
  showDone,
  setShowDone,
  q,
  setQ,
  onAdd,
  onUpdate,
  onSetDone,
  onToggleStore,
  onAllStores,
  onRemove,
  onToggleFlag,
  goMembers,
  attachments,
  getAttachmentUrl,
  onUploadAttachment,
  onRemoveAttachment,
}: {
  members: Member[];
  memberById: Record<string, Member | undefined>;
  groups: TaskGroup[];
  shownCount: number;
  allActiveCount: number;
  sortBy: TaskSortKey;
  setSortBy: (v: TaskSortKey) => void;
  doneTasks: Task[];
  showDone: boolean;
  setShowDone: (v: boolean | ((s: boolean) => boolean)) => void;
  q: string;
  setQ: (v: string) => void;
  onAdd: (input: NewTaskInput) => Promise<string | null>;
  onUpdate: (id: string, input: NewTaskInput) => void;
  onSetDone: (id: string, v: boolean) => void;
  onToggleStore: (id: string, store: string) => void;
  onAllStores: (id: string, v: boolean) => void;
  onRemove: (id: string) => void;
  onToggleFlag: (id: string, key: FlagKey) => void;
  goMembers: () => void;
  attachments: Attachment[];
  getAttachmentUrl: (path: string) => string;
  onUploadAttachment: (taskId: string, file: File) => Promise<RetryResult>;
  onRemoveAttachment: (id: string) => void;
}) {
  const [modal, setModal] = useState<ModalState>(null);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => setModal({ mode: "add" })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: C.teal,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: fontStack,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Plus size={16} /> 案件を追加
        </button>
        <button
          onClick={() => setModal({ mode: "voice" })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: C.surface,
            color: C.teal,
            border: `1.5px solid ${C.teal}`,
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: fontStack,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Mic size={16} /> 音声で追加
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={15} color={C.faint} style={{ position: "absolute", left: 11, top: 12 }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="タイトル・店舗・担当で検索"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px 10px 32px",
              borderRadius: 10,
              border: `1px solid ${C.line}`,
              background: C.surface,
              fontSize: 14,
              fontFamily: fontStack,
              color: C.ink,
              outline: "none",
            }}
          />
        </div>
      </div>

      {shownCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <ArrowDownUp size={13} color={C.sub} />
          {TASK_SORTS.map((s) => (
            <SortPill key={s.id} active={sortBy === s.id} onClick={() => setSortBy(s.id)} icon={SORT_ICONS[s.id]}>
              {s.label}
            </SortPill>
          ))}
        </div>
      )}

      {shownCount === 0 ? (
        <EmptyState allActiveCount={allActiveCount} hasMembers={members.length > 0} onAdd={() => setModal({ mode: "add" })} goMembers={goMembers} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map((g) => (
            <div key={g.key}>
              {g.label && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9, paddingBottom: 7, borderBottom: `2px solid ${C.tealSoft}` }}>
                  {sortBy === "store" ? <Store size={15} color={C.teal} /> : <User size={15} color={C.teal} />}
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: C.teal }}>{g.label}</span>
                  <span style={{ fontSize: 11.5, color: C.faint }}>{g.items.length}件</span>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {g.items.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    member={t.member_id ? memberById[t.member_id] : undefined}
                    attachmentCount={attachments.filter((a) => a.task_id === t.id).length}
                    onSetDone={onSetDone}
                    onToggleStore={onToggleStore}
                    onAllStores={onAllStores}
                    onToggleFlag={onToggleFlag}
                    onEdit={() => setModal({ mode: "edit", task: t })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {doneTasks.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <button
            onClick={() => setShowDone((s) => !s)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "8px 2px", fontFamily: fontStack, color: C.sub }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: C.stamp, border: `1.5px solid ${C.stamp}`, borderRadius: 6, padding: "1px 7px" }}>済</span>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>完了した案件 {doneTasks.length}件</span>
            <ChevronRight size={16} style={{ marginLeft: "auto", transform: showDone ? "rotate(90deg)" : "none", transition: "transform .18s" }} />
          </button>
          {showDone && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {doneTasks.map((t) => (
                <DoneCard
                  key={t.id}
                  task={t}
                  member={t.member_id ? memberById[t.member_id] : undefined}
                  attachmentCount={attachments.filter((a) => a.task_id === t.id).length}
                  onSetDone={onSetDone}
                  onAllStores={onAllStores}
                  onRemove={onRemove}
                  onToggleFlag={onToggleFlag}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {modal && modal.mode === "voice" && <VoiceModal members={members} onClose={() => setModal(null)} onParsed={(draft) => setModal({ mode: "add", draft })} />}

      {modal && (modal.mode === "add" || modal.mode === "edit") && (
        <TaskModal
          mode={modal.mode}
          task={modal.task}
          draft={modal.draft}
          members={members}
          memberById={memberById}
          attachments={attachments}
          getAttachmentUrl={getAttachmentUrl}
          onUploadAttachment={onUploadAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onClose={() => setModal(null)}
          onAdd={onAdd}
          onUpdate={onUpdate}
          goMembers={goMembers}
        />
      )}
    </div>
  );
}

function EmptyState({ allActiveCount, hasMembers, onAdd, goMembers }: { allActiveCount: number; hasMembers: boolean; onAdd: () => void; goMembers: () => void }) {
  const noSearchHit = allActiveCount > 0;
  return (
    <div style={{ background: C.surface, border: `1px dashed ${C.line}`, borderRadius: 14, padding: "40px 20px", textAlign: "center" }}>
      <Package size={30} color={C.faint} />
      {noSearchHit ? (
        <p style={{ color: C.sub, fontSize: 14, margin: "12px 0 0" }}>該当する案件がありません。</p>
      ) : !hasMembers ? (
        <>
          <p style={{ color: C.sub, fontSize: 14, margin: "12px 0 4px" }}>まずは店舗を登録しましょう。</p>
          <button onClick={goMembers} style={{ marginTop: 8, background: C.tealSoft, color: C.teal, border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, fontFamily: fontStack, cursor: "pointer" }}>
            メンバーを登録する
          </button>
        </>
      ) : (
        <>
          <p style={{ color: C.sub, fontSize: 14, margin: "12px 0 4px" }}>未処理の案件はありません。</p>
          <button onClick={onAdd} style={{ marginTop: 8, background: C.teal, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, fontFamily: fontStack, cursor: "pointer" }}>
            案件を追加
          </button>
        </>
      )}
    </div>
  );
}
