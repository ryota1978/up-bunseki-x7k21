"use client";

import { useState } from "react";
import { AlertTriangle, ArrowDownUp, Check, ChevronRight, Pencil, Plus, Save, Store, Trash2, User, Users } from "lucide-react";
import { C, MEMBER_SORTS, fontStack } from "@/lib/constants";
import type { Member, MemberSortKey, NewMemberInput } from "@/lib/types";
import { hasPerson } from "@/lib/utils";
import { SortPill, backupBar, ghostBtn, iconBtn, inputStyle, primaryBtn } from "@/components/ui";

export function MembersView({
  members,
  totalMembers,
  countByMember,
  sortBy,
  setSortBy,
  onAdd,
  onUpdate,
  onRemove,
  onOpenBackup,
  onRestoreDefaults,
}: {
  members: Member[];
  totalMembers: number;
  countByMember: Record<string, number>;
  sortBy: MemberSortKey;
  setSortBy: (v: MemberSortKey) => void;
  onAdd: (input: NewMemberInput) => void;
  onUpdate: (id: string, store: string, person: string) => void;
  onRemove: (id: string) => void;
  onOpenBackup: () => void;
  onRestoreDefaults: () => void;
}) {
  const [restored, setRestored] = useState(false);
  const [store, setStore] = useState("");
  const [person, setPerson] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editStore, setEditStore] = useState("");
  const [editPerson, setEditPerson] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const add = () => {
    if (!store.trim()) return;
    onAdd({ store, person });
    setStore("");
    setPerson("");
  };

  const startEdit = (m: Member) => {
    setConfirmId(null);
    setEditId(m.id);
    setEditStore(m.store);
    setEditPerson(m.person || "");
  };

  const saveEdit = () => {
    if (!editStore.trim() || !editId) return;
    onUpdate(editId, editStore, editPerson);
    setEditId(null);
  };

  return (
    <div>
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>店舗と担当者を登録</div>
        <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 11 }}>担当者は空のままでも登録できます（あとから追加可）</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Store size={15} color={C.teal} style={{ position: "absolute", left: 11, top: 12 }} />
            <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="店舗名（例：鵜方）" style={{ ...inputStyle, paddingLeft: 34 }} />
          </div>
          <div style={{ position: "relative" }}>
            <User size={15} color={C.faint} style={{ position: "absolute", left: 11, top: 12 }} />
            <input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="担当者（任意・例：廣岡さん）"
              style={{ ...inputStyle, paddingLeft: 34 }}
            />
          </div>
          <button onClick={add} disabled={!store.trim()} style={{ ...primaryBtn, opacity: !store.trim() ? 0.5 : 1 }}>
            <Plus size={16} /> セットを追加
          </button>
        </div>
      </div>

      <button onClick={onOpenBackup} style={{ ...backupBar, marginBottom: 8 }}>
        <Save size={16} color={C.amber} />
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>控えを取る・戻す</div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 1 }}>登録内容と案件をまとめて書き出し／復元できます</div>
        </div>
        <ChevronRight size={16} color={C.faint} />
      </button>

      <button
        onClick={() => {
          onRestoreDefaults();
          setRestored(true);
          setTimeout(() => setRestored(false), 2200);
        }}
        style={{ ...backupBar, marginBottom: 18, border: `1px solid ${restored ? C.teal : C.line}` }}
      >
        {restored ? <Check size={16} color={C.teal} /> : <Users size={16} color={C.teal} />}
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: restored ? C.teal : C.ink }}>
            {restored ? "登録済みのメンバーを呼び戻しました" : "登録済みメンバー29組を呼び戻す"}
          </div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 1 }}>足りない分だけ追加します（今あるものは消えません）</div>
        </div>
      </button>

      {totalMembers === 0 ? (
        <div style={{ textAlign: "center", color: C.faint, fontSize: 14, padding: "24px 0" }}>登録されたメンバーはまだありません。</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            <ArrowDownUp size={13} color={C.sub} />
            {MEMBER_SORTS.map((s) => (
              <SortPill key={s.id} active={sortBy === s.id} onClick={() => setSortBy(s.id)}>
                {s.label}
              </SortPill>
            ))}
          </div>

          <div style={{ fontSize: 12.5, color: C.sub, margin: "0 2px 10px" }}>登録済み {totalMembers}組</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {members.map((m) => {
              const n = countByMember[m.id] || 0;

              if (editId === m.id) {
                return (
                  <div key={m.id} style={{ background: C.surface, border: `1.5px solid ${C.teal}`, borderRadius: 11, padding: 14 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: C.teal, marginBottom: 9 }}>修正中</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ position: "relative" }}>
                        <Store size={15} color={C.teal} style={{ position: "absolute", left: 11, top: 12 }} />
                        <input value={editStore} onChange={(e) => setEditStore(e.target.value)} placeholder="店舗名" autoFocus style={{ ...inputStyle, paddingLeft: 34 }} />
                      </div>
                      <div style={{ position: "relative" }}>
                        <User size={15} color={C.faint} style={{ position: "absolute", left: 11, top: 12 }} />
                        <input
                          value={editPerson}
                          onChange={(e) => setEditPerson(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                          placeholder="担当者（空でも可）"
                          style={{ ...inputStyle, paddingLeft: 34 }}
                        />
                      </div>
                      {n > 0 && <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.5 }}>この組に紐づく未処理の案件 {n}件にも、修正後の名前が反映されます。</div>}
                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        <button onClick={() => setEditId(null)} style={ghostBtn}>
                          キャンセル
                        </button>
                        <button onClick={saveEdit} disabled={!editStore.trim()} style={{ ...primaryBtn, marginLeft: "auto", padding: "9px 16px", opacity: !editStore.trim() ? 0.5 : 1 }}>
                          保存する
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              if (confirmId === m.id) {
                return (
                  <div key={m.id} style={{ background: C.stampSoft, border: `1px solid ${C.stamp}`, borderRadius: 11, padding: 14 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <AlertTriangle size={17} color={C.stamp} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.stamp }}>「{m.person ? `${m.store}　${m.person}` : m.store}」を削除しますか？</div>
                        {n > 0 && (
                          <div style={{ fontSize: 12, color: C.ink, marginTop: 4, lineHeight: 1.5 }}>
                            未処理の案件が {n}件あります。削除すると、その案件の店舗名が「削除された店舗」になります。
                            名前を変えたいだけなら、削除ではなく修正をお使いください。
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <button onClick={() => setConfirmId(null)} style={{ ...ghostBtn, background: C.surface }}>
                        やめる
                      </button>
                      <button onClick={() => startEdit(m)} style={{ ...ghostBtn, background: C.surface }}>
                        <Pencil size={14} /> 修正する
                      </button>
                      <button
                        onClick={() => {
                          onRemove(m.id);
                          setConfirmId(null);
                        }}
                        style={{ marginLeft: "auto", background: C.stamp, color: "#fff", border: "none", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, fontFamily: fontStack, cursor: "pointer" }}
                      >
                        削除する
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={m.id} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 11, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: C.tealSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Store size={16} color={C.teal} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{m.store}</div>
                    <div style={{ fontSize: 12.5, color: hasPerson(m) ? C.sub : C.faint, fontStyle: hasPerson(m) ? "normal" : "italic" }}>{hasPerson(m) ? m.person : "担当者 未設定"}</div>
                  </div>
                  {n > 0 && (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: C.teal, background: C.tealSoft, borderRadius: 20, padding: "3px 9px" }}>未処理 {n}</span>
                  )}
                  <button onClick={() => startEdit(m)} style={{ ...ghostBtn, padding: "7px 11px", fontSize: 12.5 }} title="修正">
                    <Pencil size={14} /> 修正
                  </button>
                  <button onClick={() => setConfirmId(m.id)} style={iconBtn} title="削除">
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
