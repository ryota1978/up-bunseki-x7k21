"use client";

import type { CSSProperties } from "react";
import { STORES, fontStack } from "@/lib/constants";
import type { Member, MemberSortKey, TaskSortKey } from "@/lib/types";
import { doneText, formatDue, hasPerson, todayLabel, type TaskGroup } from "@/lib/utils";

export function PrintStyles() {
  return (
    <style>{`
      .print-area { display: none; }
      @media print {
        .screen-area { display: none !important; }
        .print-area { display: block !important; }
        body { background: #fff !important; }
        @page { margin: 14mm; size: A4; }
        .p-group { break-inside: avoid; page-break-inside: avoid; }
        .p-row { break-inside: avoid; page-break-inside: avoid; }
      }
    `}</style>
  );
}

const printSheet: CSSProperties = { fontFamily: fontStack, color: "#111", padding: 4 };
const printHead: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #222", paddingBottom: 7, marginBottom: 12 };
const printTable: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 10.5, marginBottom: 4 };
const th: CSSProperties = { border: "1px solid #999", background: "#eee", padding: "5px 4px", fontSize: 10, fontWeight: 700, textAlign: "center" };
const td: CSSProperties = { border: "1px solid #999", padding: "5px 4px", textAlign: "center", verticalAlign: "top" };
const checkBox: CSSProperties = { display: "inline-block", width: 10, height: 10, border: "1.2px solid #444", borderRadius: 2 };

export function PrintTasks({ groups, memberById, total, sortLabel }: { groups: TaskGroup[]; memberById: Record<string, Member | undefined>; total: number; sortLabel: string }) {
  return (
    <div style={printSheet}>
      <div style={printHead}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>店舗配布物　未処理一覧</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
            {todayLabel()}　全{total}件　／　{sortLabel}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#666", textAlign: "right", lineHeight: 1.6 }}>
          確認者
          <br />
          日付　　　／
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.key} className="p-group" style={{ marginBottom: g.label ? 14 : 0 }}>
          {g.label && (
            <div style={{ fontSize: 12.5, fontWeight: 700, borderBottom: "1.5px solid #333", paddingBottom: 3, marginBottom: 5 }}>
              {g.label}　<span style={{ fontSize: 10, fontWeight: 400, color: "#666" }}>{g.items.length}件</span>
            </div>
          )}
          <table style={printTable}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>タイトル</th>
                <th style={{ ...th, width: 74 }}>店舗</th>
                <th style={{ ...th, width: 60 }}>担当</th>
                <th style={{ ...th, width: 42 }}>期日</th>
                <th style={{ ...th, width: 40 }}>転載</th>
                <th style={{ ...th, width: 126 }}>済（該当に✓）</th>
                <th style={{ ...th, width: 86 }}>メモ</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((t) => {
                const m = t.member_id ? memberById[t.member_id] : undefined;
                return (
                  <tr key={t.id} className="p-row">
                    <td style={{ ...td, textAlign: "left" }}>
                      <div style={{ fontWeight: 700 }}>{t.title || "（無題）"}</div>
                      {t.content && <div style={{ fontSize: 9.5, color: "#555", marginTop: 2, lineHeight: 1.4 }}>{t.content}</div>}
                    </td>
                    <td style={td}>{m ? m.store : "—"}</td>
                    <td style={td}>{hasPerson(m) ? m!.person : "—"}</td>
                    <td style={td}>{t.due ? formatDue(t.due) : "—"}</td>
                    <td style={{ ...td, fontSize: 9 }}>{[t.meeting ? "会議" : "", t.jimu ? "事務" : ""].filter(Boolean).join("・") || "—"}</td>
                    <td style={{ ...td, textAlign: "left", whiteSpace: "nowrap" }}>
                      {t.by_store ? (
                        STORES.map((s) => (
                          <span key={s} style={{ marginRight: 5, fontSize: 9.5 }}>
                            <span style={{ ...checkBox, marginRight: 2, background: t.stores_done && t.stores_done[s] ? "#444" : "transparent" }} />
                            {s}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 9.5 }}>
                          <span style={{ ...checkBox, marginRight: 3 }} />済
                        </span>
                      )}
                    </td>
                    <td style={td} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {total === 0 && <p style={{ fontSize: 11, color: "#666", marginTop: 16 }}>未処理の案件はありません。</p>}
    </div>
  );
}

export function PrintFlagList({
  full,
  groups,
  sortBy,
  memberById,
  total,
}: {
  full: string;
  groups: TaskGroup[];
  sortBy: TaskSortKey;
  memberById: Record<string, Member | undefined>;
  total: number;
}) {
  const sortLabel = sortBy === "store" ? "店舗別" : sortBy === "person" ? "人別" : "期日順";
  return (
    <div style={printSheet}>
      <div style={printHead}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{full}</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
            {todayLabel()}　{total}件　／　{sortLabel}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#666", textAlign: "right", lineHeight: 1.6 }}>
          記入者
          <br />
          開催日　　　／
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.key} className="p-group" style={{ marginBottom: 14 }}>
          {g.label && (
            <div style={{ fontSize: 12.5, fontWeight: 700, borderBottom: "1.5px solid #333", paddingBottom: 3, marginBottom: 6 }}>
              {g.label}　<span style={{ fontSize: 10, fontWeight: 400, color: "#666" }}>{g.items.length}件</span>
            </div>
          )}
          {g.items.map((t) => {
            const m = t.member_id ? memberById[t.member_id] : undefined;
            const sub = !m ? "—" : sortBy === "store" ? (hasPerson(m) ? m.person : "担当なし") : m.store;
            return (
              <div key={t.id} className="p-row" style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px dotted #bbb" }}>
                <span style={{ ...checkBox, marginTop: 3, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11.5 }}>
                    <span style={{ fontWeight: 700 }}>{t.title || "（無題）"}</span>
                    <span style={{ color: "#555" }}>
                      　（{sub}）　{doneText(t)}
                      {t.due ? `　期日 ${formatDue(t.due)}` : ""}
                    </span>
                  </div>
                  {t.content && <div style={{ fontSize: 9.5, color: "#555", marginTop: 2, lineHeight: 1.45 }}>{t.content}</div>}
                  <div style={{ borderBottom: "1px solid #e0e0e0", height: 13, marginTop: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {total === 0 && <p style={{ fontSize: 11, color: "#666", marginTop: 16 }}>転載する案件はありません。</p>}
    </div>
  );
}

export function PrintMembers({ members, countByMember, sortBy }: { members: Member[]; countByMember: Record<string, number>; sortBy: MemberSortKey }) {
  const labels: Record<MemberSortKey, string> = { added: "登録順", store: "店舗名順", person: "担当者順", count: "案件の多い順" };
  return (
    <div style={printSheet}>
      <div style={printHead}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>店舗・担当者　控え</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
            {todayLabel()}　全{members.length}組　／　{labels[sortBy]}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#666", textAlign: "right", lineHeight: 1.6 }}>作成者　　　　　　　　</div>
      </div>

      <table style={printTable}>
        <thead>
          <tr>
            <th style={{ ...th, width: 30 }}>No.</th>
            <th style={{ ...th, textAlign: "left" }}>店舗</th>
            <th style={{ ...th, textAlign: "left" }}>担当者</th>
            <th style={{ ...th, width: 60 }}>未処理</th>
            <th style={{ ...th, width: 150 }}>備考</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={m.id} className="p-row">
              <td style={td}>{i + 1}</td>
              <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{m.store}</td>
              <td style={{ ...td, textAlign: "left", color: hasPerson(m) ? "#111" : "#999" }}>{hasPerson(m) ? m.person : "未設定"}</td>
              <td style={td}>{countByMember[m.id] ? `${countByMember[m.id]}件` : "—"}</td>
              <td style={td} />
            </tr>
          ))}
        </tbody>
      </table>

      {members.length === 0 && <p style={{ fontSize: 11, color: "#666", marginTop: 16 }}>登録がありません。</p>}
    </div>
  );
}
