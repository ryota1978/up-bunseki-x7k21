"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Sparkles, Square as SquareIcon } from "lucide-react";
import { C } from "@/lib/constants";
import type { Member, VoiceDraft } from "@/lib/types";
import { Field, Modal, ghostBtn, inputStyle, primaryBtn } from "@/components/ui";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechResultEvent = {
  resultIndex: number;
  results: { [i: number]: { 0: { transcript: string }; isFinal: boolean }; length: number };
};

export function VoiceModal({ members, onClose, onParsed }: { members: Member[]; onClose: () => void; onParsed: (draft: VoiceDraft) => void }) {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = typeof window !== "undefined" && !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

  useEffect(
    () => () => {
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
    },
    []
  );

  const start = () => {
    setErr(null);
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setErr("この端末では音声入力が使えません。下の欄に文字で入力してください。");
      return;
    }
    try {
      const rec = new SR();
      rec.lang = "ja-JP";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        const ev = e as SpeechResultEvent;
        let fin = "";
        let itr = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) fin += r[0].transcript;
          else itr += r[0].transcript;
        }
        if (fin) setText((p) => (p ? p + fin : fin));
        setInterim(itr);
      };
      rec.onerror = (e) => {
        const k = e?.error;
        setErr(
          k === "not-allowed" || k === "service-not-allowed"
            ? "マイクの使用が許可されていません。ブラウザの設定でマイクを許可するか、下の欄に文字で入力してください。"
            : "音声がうまく拾えませんでした。もう一度お試しください。"
        );
        setListening(false);
      };
      rec.onend = () => {
        setListening(false);
        setInterim("");
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setErr("音声入力を開始できませんでした。下の欄に文字で入力してください。");
    }
  };

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  };

  const parse = async () => {
    const src = (text + " " + interim).trim();
    if (!src) return;
    stop();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: src,
          members: members.map((m) => ({ id: m.id, store: m.store, person: m.person })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.message || "うまく読み取れませんでした。もう一度話すか、文字を直してからお試しください。");
        setBusy(false);
        return;
      }
      const obj = data.result;
      const valid = members.some((m) => m.id === obj.memberId);
      onParsed({
        title: obj.title || "",
        member_id: valid ? obj.memberId : "",
        content: obj.content || "",
        due: /^\d{4}-\d{2}-\d{2}$/.test(obj.due || "") ? obj.due : "",
        meeting: !!obj.meeting,
        jimu: !!obj.jimu,
        by_store: !!obj.byStore,
        rawText: src,
      });
    } catch {
      setErr("サーバーに接続できませんでした。通信環境をご確認のうえ、もう一度お試しください。");
    }
    setBusy(false);
  };

  const shown = (text + (interim ? interim : "")).trim();

  return (
    <Modal title="音声で案件を追加" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.65, margin: "0 0 6px" }}>マイクを押して、いつも通り話してください。</p>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FBFCFA", border: `1px dashed ${C.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
        <Sparkles size={14} color={C.faint} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, color: C.ink, marginBottom: 2 }}>話し方の例（全体向け・期日なし）</div>
          「全店舗に連絡です。薬剤師の皆さんへ、自主勉強会に出席したら申請してください。期日は特にありません。」
          <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
            → タイトル「自主勉強会の出席申請」／宛先【全店舗】／期日なし／店舗ごとの済チェックがONになります
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <button
          onClick={listening ? stop : start}
          disabled={busy || !supported}
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            border: "none",
            cursor: busy || !supported ? "default" : "pointer",
            background: listening ? C.stamp : supported ? C.teal : C.line,
            color: "#fff",
            display: "inline-grid",
            placeItems: "center",
            boxShadow: listening ? `0 0 0 8px ${C.stampSoft}` : "none",
            transition: "box-shadow .2s",
          }}
        >
          {listening ? <SquareIcon size={30} fill="#fff" /> : <Mic size={34} />}
        </button>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: listening ? C.stamp : C.sub, marginTop: 9 }}>
          {!supported ? "この端末では音声が使えません" : listening ? "聞いています…　押すと停止" : "押して話す"}
        </div>
      </div>

      <Field label="読み取った内容（直せます）">
        <textarea
          value={shown}
          onChange={(e) => {
            setText(e.target.value);
            setInterim("");
          }}
          rows={4}
          placeholder="ここに話した内容が入ります。直接入力してもOKです"
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
        />
      </Field>

      {err && (
        <div style={{ fontSize: 12.5, lineHeight: 1.6, padding: "9px 12px", borderRadius: 9, background: C.amberSoft, color: C.amber, marginBottom: 10 }}>{err}</div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} style={ghostBtn}>
          キャンセル
        </button>
        <button onClick={parse} disabled={!shown || busy} style={{ ...primaryBtn, marginLeft: "auto", opacity: !shown || busy ? 0.5 : 1 }}>
          <Sparkles size={15} /> {busy ? "読み取り中…" : "内容を読み取る"}
        </button>
      </div>
    </Modal>
  );
}
