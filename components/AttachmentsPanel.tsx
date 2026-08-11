"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, Paperclip, Trash2, Upload, X } from "lucide-react";
import { C, fontStack } from "@/lib/constants";
import type { Attachment } from "@/lib/types";
import { ghostBtn } from "@/components/ui";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** 案件の添付ファイル一覧・アップロード・削除。 */
export function AttachmentsPanel({
  attachments,
  getUrl,
  onUpload,
  onDelete,
  pendingFiles,
  onAddPending,
  onRemovePending,
}: {
  attachments: Attachment[];
  getUrl: (path: string) => string;
  onUpload?: (file: File) => Promise<void>;
  onDelete?: (id: string) => void;
  pendingFiles?: File[];
  onAddPending?: (file: File) => void;
  onRemovePending?: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErr(null);
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      setErr("ファイルが大きすぎます（10MBまで）。");
      return;
    }
    if (onUpload) {
      setBusy(true);
      try {
        await onUpload(file);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "アップロードに失敗しました。");
      } finally {
        setBusy(false);
      }
    } else if (onAddPending) {
      onAddPending(file);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.sub, marginBottom: 6 }}>
        <Paperclip size={13} style={{ verticalAlign: -2, marginRight: 3 }} />
        添付ファイル
      </label>

      {attachments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {attachments.map((a) =>
            confirmId === a.id ? (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.stampSoft, border: `1px solid ${C.stamp}`, borderRadius: 9, padding: "8px 10px" }}>
                <AlertTriangle size={14} color={C.stamp} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, flex: 1 }}>「{a.file_name}」を削除しますか？</span>
                <button onClick={() => setConfirmId(null)} style={{ ...ghostBtn, padding: "4px 8px", fontSize: 11.5 }}>
                  やめる
                </button>
                <button
                  onClick={() => {
                    onDelete?.(a.id);
                    setConfirmId(null);
                  }}
                  style={{ background: C.stamp, color: "#fff", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, fontFamily: fontStack, cursor: "pointer" }}
                >
                  削除
                </button>
              </div>
            ) : (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBFCFA", border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 10px" }}>
                <Paperclip size={14} color={C.faint} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.file_name}</div>
                  <div style={{ fontSize: 10.5, color: C.faint }}>{formatSize(a.size_bytes)}</div>
                </div>
                <a href={getUrl(a.storage_path)} target="_blank" rel="noopener noreferrer" style={{ color: C.teal, display: "flex" }} title="開く・ダウンロード">
                  <Download size={15} />
                </a>
                {onDelete && (
                  <button onClick={() => setConfirmId(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.faint, display: "flex" }} title="削除">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}

      {pendingFiles && pendingFiles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {pendingFiles.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.tealSoft, border: `1px solid ${C.tealSoft}`, borderRadius: 9, padding: "8px 10px" }}>
              <Paperclip size={14} color={C.teal} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: C.teal, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
              <span style={{ fontSize: 10.5, color: C.teal }}>追加後に保存されます</span>
              {onRemovePending && (
                <button onClick={() => onRemovePending(i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.teal, display: "flex" }} title="取り消す">
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <input ref={inputRef} type="file" onChange={(e) => handleFiles(e.target.files)} style={{ display: "none" }} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{ ...ghostBtn, opacity: busy ? 0.6 : 1 }}
      >
        <Upload size={14} /> {busy ? "アップロード中…" : "ファイルを選ぶ（10MBまで）"}
      </button>

      {err && <div style={{ fontSize: 11.5, color: C.stamp, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
