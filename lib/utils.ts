import { C, NO_PERSON, STORES } from "./constants";
import type { Member, StoresDone, Task, TaskSortKey } from "./types";

export const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function daysUntil(dueKey: string | null): number | null {
  if (!dueKey) return null;
  const [y, m, d] = dueKey.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export function formatDue(dueKey: string | null) {
  if (!dueKey) return "";
  const [, m, d] = dueKey.split("-").map(Number);
  return `${m}/${d}`;
}

export type DueMeta = { text: string; bg: string; fg: string; bold: boolean };

export function dueMeta(dueKey: string | null): DueMeta | null {
  const n = daysUntil(dueKey);
  if (n === null) return null;
  if (n < 0) return { text: `${formatDue(dueKey)}・${-n}日超過`, bg: C.stampSoft, fg: C.stamp, bold: true };
  if (n === 0) return { text: `${formatDue(dueKey)}・今日`, bg: C.stampSoft, fg: C.stamp, bold: true };
  if (n <= 3) return { text: `${formatDue(dueKey)}・あと${n}日`, bg: C.amberSoft, fg: C.amber, bold: true };
  return { text: `${formatDue(dueKey)}・あと${n}日`, bg: C.tealSoft, fg: C.teal, bold: false };
}

export const todayLabel = () => {
  const d = new Date();
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${w}）`;
};

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "たった今";
  if (s < 60) return `${s}秒前`;
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

export const hasPerson = (m: Member | null | undefined) => !!(m && m.person && m.person.trim());
export const memberLine = (m: Member | null | undefined) =>
  !m ? "（削除された店舗）" : hasPerson(m) ? `${m.store}　${m.person}` : m.store;

export const emptyStoresDone = (): StoresDone =>
  STORES.reduce((o, s) => ({ ...o, [s]: false }), {} as StoresDone);

export const doneStoreList = (t: Task) =>
  t.by_store ? STORES.filter((s) => t.stores_done && t.stores_done[s]) : [];

export const isDone = (t: Task) => (t.by_store ? STORES.every((s) => t.stores_done && t.stores_done[s]) : !!t.done);

export function doneText(t: Task) {
  if (!t.by_store) return t.done ? "済" : "未";
  const d = doneStoreList(t);
  if (d.length === STORES.length) return "済";
  if (d.length === 0) return "未";
  return `${d.join("・")} 済`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function doPrint() {
  try {
    window.focus();
    window.print();
  } catch {
    /* noop */
  }
}

const byDue = (a: Task, b: Task) =>
  a.due && b.due ? (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) : a.due ? -1 : b.due ? 1 : 0;

export type TaskGroup = { key: string; label: string | null; items: Task[] };

export function arrangeTasks(
  tasks: Task[],
  sortBy: TaskSortKey,
  memberById: Record<string, Member | undefined>
): TaskGroup[] {
  if (sortBy === "store" || sortBy === "person") {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      const m = t.member_id ? memberById[t.member_id] : undefined;
      let label: string;
      if (!m) label = "（不明）";
      else if (sortBy === "store") label = m.store;
      else label = hasPerson(m) ? m.person : NO_PERSON;
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(t);
    });
    return [...map.entries()]
      .sort((a, b) => {
        if (a[0] === NO_PERSON) return 1;
        if (b[0] === NO_PERSON) return -1;
        return a[0].localeCompare(b[0], "ja");
      })
      .map(([label, items]) => ({ key: label, label, items: [...items].sort(byDue) }));
  }
  const items = [...tasks];
  if (sortBy === "new") items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  else items.sort(byDue);
  return [{ key: "all", label: null, items }];
}
