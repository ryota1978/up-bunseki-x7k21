"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { C, FLAGS } from "@/lib/constants";
import type { Member, NewTaskInput, Task, VoiceDraft } from "@/lib/types";
import { hasPerson, memberLine, toKey } from "@/lib/utils";
import { Field, Modal, QuickBtn, ToggleBox, ghostBtn, inputStyle, primaryBtn } from "@/components/ui";

export function TaskModal({
  mode,
  task,
  draft,
  members,
  memberById,
  onClose,
  onAdd,
  onUpdate,
  goMembers,
}: {
  mode: "add" | "edit";
  task?: Task;
  draft?: VoiceDraft;
  members: Member[];
  memberById: Record<string, Member | undefined>;
  onClose: () => void;
  onAdd: (input: NewTaskInput) => void;
  onUpdate: (id: string, input: NewTaskInput) => void;
  goMembers: () => void;
}) {
  const isEdit = mode === "edit";
  const d = draft || null;
  const initialMember = isEdit ? task!.member_id || "" : (d && d.member_id) || members[0]?.id || "";
  const [memberId, setMemberId] = useState(initialMember);
  const [title, setTitle] = useState(isEdit ? task!.title || "" : (d && d.title) || "");
  const [content, setContent] = useState(isEdit ? task!.content || "" : (d && d.content) || "");
  const [due, setDue] = useState(isEdit ? task!.due || "" : (d && d.due) || "");
  const [meeting, setMeeting] = useState(isEdit ? !!task!.meeting : !!(d && d.meeting));
  const [jimu, setJimu] = useState(isEdit ? !!task!.jimu : !!(d && d.jimu));
  const [byStore, setByStore] = useState(isEdit ? !!task!.by_store : d ? !!d.by_store : !hasPerson(memberById[initialMember]));
  const [touchedByStore, setTouchedByStore] = useState(isEdit || !!d);

  const pickMember = (id: string) => {
    setMemberId(id);
    if (!touchedByStore) setByStore(!hasPerson(memberById[id]));
  };

  const submit = () => {
    if (!memberId || !title.trim()) return;
    const payload: NewTaskInput = { member_id: memberId, title: title.trim(), content: content.trim(), due, meeting, jimu, by_store: byStore };
    if (isEdit) onUpdate(task!.id, payload);
    else onAdd(payload);
    onClose();
  };

  const quickDue = (offset: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offset);
    setDue(toKey(dt));
  };

  return (
    <Modal title={isEdit ? "案件を修正" : "案件を追加"} onClose={onClose}>
      {members.length === 0 ? (
        <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
          <p style={{ color: C.sub, fontSize: 13.5, margin: "0 0 12px" }}>先に店舗を登録してください。</p>
          <button
            onClick={() => {
              onClose();
              goMembers();
            }}
            style={primaryBtn}
          >
            メンバー登録へ
          </button>
        </div>
      ) : (
        <>
          {d && (
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start", background: C.tealSoft, borderRadius: 10, padding: "9px 12px", marginBottom: 12 }}>
              <Sparkles size={15} color={C.teal} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11.5, color: C.teal, lineHeight: 1.55 }}>音声から読み取りました。違うところは直してから追加してください。</div>
            </div>
          )}

          <Field label="タイトル">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：夏の新商品チラシ" autoFocus style={inputStyle} />
          </Field>

          <Field label="店舗・担当者">
            <select value={memberId} onChange={(e) => pickMember(e.target.value)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {memberLine(m)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="期日（任意）">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
              <QuickBtn onClick={() => quickDue(0)}>今日</QuickBtn>
              <QuickBtn onClick={() => quickDue(3)}>3日後</QuickBtn>
              <QuickBtn onClick={() => quickDue(7)}>1週間後</QuickBtn>
              <QuickBtn onClick={() => quickDue(30)}>1ヶ月後</QuickBtn>
              {due && (
                <QuickBtn muted onClick={() => setDue("")}>
                  期日なし
                </QuickBtn>
              )}
            </div>
          </Field>

          <Field label="内容（助田さんから聞いた内容）">
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="配布物の内容をメモ" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          </Field>

          <ToggleBox
            on={byStore}
            onClick={() => {
              setByStore((v) => !v);
              setTouchedByStore(true);
            }}
            color={C.stamp}
            soft={C.stampSoft}
            title="店舗ごとに済を入れる"
            note="鵜方・射和・神久・岡本 を個別にチェック。全部そろうと済になります"
          />

          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, margin: "4px 2px 7px" }}>転載先（両方に入れられます）</div>
          <ToggleBox on={meeting} onClick={() => setMeeting((v) => !v)} color={FLAGS.meeting.color} soft={FLAGS.meeting.soft} title="会議へ転載する" note="トップの「会議への転載リスト」にまとまります" />
          <ToggleBox on={jimu} onClick={() => setJimu((v) => !v)} color={FLAGS.jimu.color} soft={FLAGS.jimu.soft} title="医療事務ミーティングへ転載する" note="トップの「医療事務ミーティング」にまとまります" />

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={onClose} style={ghostBtn}>
              キャンセル
            </button>
            <button onClick={submit} disabled={!memberId || !title.trim()} style={{ ...primaryBtn, marginLeft: "auto", opacity: !title.trim() ? 0.5 : 1 }}>
              {isEdit ? "保存する" : "追加する"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
