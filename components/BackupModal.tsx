"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Download, Save, Upload } from "lucide-react";
import { C } from "@/lib/constants";
import type { Member, Task } from "@/lib/types";
import { copyToClipboard, toKey } from "@/lib/utils";
import { MiniTab, Modal, inputStyle, primaryBtn } from "@/components/ui";

export function BackupModal({
  members,
  tasks,
  onClose,
  onRestore,
}: {
  members: Member[];
  tasks: Task[];
  onClose: () => void;
  onRestore: (data: { members: Member[]; tasks: Task[] }) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [tab, setTab] = useState<"out" | "in">("out");
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "warn"; text: string } | null>(null);
  const [pending, setPending] = useState<{ members: Member[]; tasks: Task[] } | null>(null);
  const [restoring, setRestoring] = useState(false);

  const json = useMemo(
    () => JSON.stringify({ app: "up-bunseki", version: 1, exportedAt: new Date().toISOString(), members, tasks }, null, 2),
    [members, tasks]
  );

  const doCopy = async () => {
    const ok = await copyToClipboard(json);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else setMsg({ type: "warn", text: "コピーできませんでした。下の枠を長押しして手動でコピーしてください。" });
  };

  const doSaveFile = () => {
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `配布物控え_${toKey(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      setMsg({ type: "warn", text: "ファイル保存ができませんでした。「文章でコピー」をお使いください。" });
    }
  };

  const check = () => {
    setMsg(null);
    let data: { members?: unknown; tasks?: unknown };
    try {
      data = JSON.parse(pasted);
    } catch {
      setMsg({ type: "error", text: "控えの中身を読み取れませんでした。全文が貼れているか確認してください。" });
      return;
    }
    if (!data || !Array.isArray(data.members) || !Array.isArray(data.tasks)) {
      setMsg({ type: "error", text: "このアプリの控えではないようです。" });
      return;
    }
    setPending({ members: data.members as Member[], tasks: data.tasks as Task[] });
  };

  const doRestore = async () => {
    if (!pending) return;
    setRestoring(true);
    const result = await onRestore(pending);
    setRestoring(false);
    if (result.ok) {
      onClose();
    } else {
      setMsg({ type: "error", text: result.message || "戻すのに失敗しました。時間をおいて再度お試しください。" });
    }
  };

  return (
    <Modal title="控えを取る・戻す" onClose={onClose}>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <MiniTab
          active={tab === "out"}
          onClick={() => {
            setTab("out");
            setMsg(null);
            setPending(null);
          }}
          icon={<Download size={14} />}
        >
          控えを取る
        </MiniTab>
        <MiniTab
          active={tab === "in"}
          onClick={() => {
            setTab("in");
            setMsg(null);
          }}
          icon={<Upload size={14} />}
        >
          控えから戻す
        </MiniTab>
      </div>

      {tab === "out" ? (
        <>
          <p style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, margin: "0 0 12px" }}>
            登録済みの店舗 {members.length}組と、案件 {tasks.length}件をまとめて書き出します。
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={doSaveFile} style={{ ...primaryBtn, background: saved ? C.teal : C.amber }}>
              {saved ? (
                <>
                  <Check size={15} /> 保存しました
                </>
              ) : (
                <>
                  <Save size={15} /> ファイルに保存
                </>
              )}
            </button>
            <button onClick={doCopy} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", color: C.sub, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 14px", fontSize: 13, cursor: "pointer" }}>
              {copied ? (
                <>
                  <Check size={14} /> コピーしました
                </>
              ) : (
                <>
                  <Copy size={14} /> 文章でコピー
                </>
              )}
            </button>
          </div>
          <textarea
            readOnly
            value={json}
            onFocus={(e) => e.target.select()}
            rows={6}
            style={{ ...inputStyle, fontSize: 10.5, fontFamily: "monospace", lineHeight: 1.4, resize: "vertical", color: C.sub }}
          />
        </>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, margin: "0 0 10px" }}>
            控えの中身を貼り付けて「読み込む」を押してください。共有中の場合、みんなのデータが置き換わります。
          </p>
          <textarea
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value);
              setPending(null);
              setMsg(null);
            }}
            rows={6}
            placeholder="ここに控えを貼り付け"
            style={{ ...inputStyle, fontSize: 11, fontFamily: "monospace", lineHeight: 1.4, resize: "vertical", marginBottom: 10 }}
          />

          {pending ? (
            <div style={{ background: C.stampSoft, border: `1px solid ${C.stamp}`, borderRadius: 10, padding: 13, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <AlertTriangle size={16} color={C.stamp} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                  店舗 {pending.members.length}組、案件 {pending.tasks.length}件を読み込みます。
                  <b>
                    今のデータ（{members.length}組・{tasks.length}件）は上書きされます。
                  </b>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                <button onClick={() => setPending(null)} style={{ background: "none", color: C.sub, border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>
                  やめる
                </button>
                <button
                  onClick={doRestore}
                  disabled={restoring}
                  style={{ marginLeft: "auto", background: C.stamp, color: "#fff", border: "none", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: restoring ? 0.6 : 1 }}
                >
                  {restoring ? "戻しています…" : "上書きして戻す"}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={check} disabled={!pasted.trim()} style={{ ...primaryBtn, width: "100%", opacity: !pasted.trim() ? 0.5 : 1 }}>
              <Upload size={15} /> 読み込む
            </button>
          )}
        </>
      )}

      {msg && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12.5,
            lineHeight: 1.6,
            padding: "9px 12px",
            borderRadius: 9,
            background: msg.type === "error" ? C.stampSoft : C.amberSoft,
            color: msg.type === "error" ? C.stamp : C.amber,
          }}
        >
          {msg.text}
        </div>
      )}
    </Modal>
  );
}
