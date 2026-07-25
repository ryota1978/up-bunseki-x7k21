import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Store, User, ChevronRight, Trash2, Pencil,
  Package, ClipboardList, Users, X, Search, CalendarDays,
  CheckSquare, Square, Presentation, Copy, Check, ArrowLeft, Printer,
  Save, Download, Upload, AlertTriangle, ArrowDownUp, Clock, RotateCcw,
  Stethoscope, RefreshCw, Cloud, UserCircle, Mic, Square as SquareIcon, Sparkles,
} from "lucide-react";

/* ── 配色 ── */
const C = {
  bg: "#F1F2ED",
  surface: "#FFFFFF",
  ink: "#232B2E",
  sub: "#6C7680",
  faint: "#98A0A6",
  line: "#E2E4DE",
  teal: "#2C6E63",
  tealSoft: "#E4EFEB",
  amber: "#C4783A",
  amberSoft: "#F4E7D9",
  stamp: "#B23A2E",
  stampSoft: "#F6E3E0",
  navy: "#3A5570",
  navySoft: "#E5EBF1",
  plum: "#74566E",
  plumSoft: "#EFE6EE",
};

/* 店舗別に済を入れる4店舗 */
const STORES = ["鵜方", "射和", "神久", "岡本"];

/* 2つの転載先 */
const FLAGS = {
  meeting: { key: "meeting", label: "会議", full: "会議への転載リスト", color: C.navy, soft: C.navySoft, icon: Presentation },
  jimu: { key: "jimu", label: "医療事務", full: "医療事務ミーティング", color: C.plum, soft: C.plumSoft, icon: Stethoscope },
};

const NO_PERSON = "（担当者なし）";
const SHARED_KEY = "haifu-shared";
const ME_KEY = "haifu-me";

const fontStack =
  "'Hiragino Kaku Gothic ProN','Hiragino Sans','Yu Gothic','Meiryo',system-ui,sans-serif";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ── 日付 ── */
const toKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function daysUntil(dueKey) {
  if (!dueKey) return null;
  const [y, m, d] = dueKey.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86400000);
}

function formatDue(dueKey) {
  if (!dueKey) return "";
  const [, m, d] = dueKey.split("-").map(Number);
  return `${m}/${d}`;
}

function dueMeta(dueKey) {
  const n = daysUntil(dueKey);
  if (n === null) return null;
  if (n < 0) return { text: `${formatDue(dueKey)}・${-n}日超過`, bg: C.stampSoft, fg: C.stamp, bold: true };
  if (n === 0) return { text: `${formatDue(dueKey)}・今日`, bg: C.stampSoft, fg: C.stamp, bold: true };
  if (n <= 3) return { text: `${formatDue(dueKey)}・あと${n}日`, bg: C.amberSoft, fg: C.amber, bold: true };
  return { text: `${formatDue(dueKey)}・あと${n}日`, bg: C.tealSoft, fg: C.teal, bold: false };
}

const todayLabel = () => {
  const d = new Date();
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${w}）`;
};

function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "たった今";
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/* ── 担当者の表示 ── */
const hasPerson = (m) => !!(m && m.person && m.person.trim());
const memberLine = (m) => (!m ? "（削除された店舗）" : hasPerson(m) ? `${m.store}　${m.person}` : m.store);

/* ── 済の判定 ── */
const emptyStores = () => STORES.reduce((o, s) => ({ ...o, [s]: false }), {});
const doneStoreList = (t) => (t.byStore ? STORES.filter((s) => t.stores && t.stores[s]) : []);
const isDone = (t) => (t.byStore ? STORES.every((s) => t.stores && t.stores[s]) : !!t.done);

function doneText(t) {
  if (!t.byStore) return t.done ? "済" : "未";
  const d = doneStoreList(t);
  if (d.length === STORES.length) return "済";
  if (d.length === 0) return "未";
  return `${d.join("・")} 済`;
}

/* ── クリップボード ── */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
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
    } catch (e2) {
      return false;
    }
  }
}

function doPrint() {
  try {
    window.focus();
    window.print();
  } catch (e) {}
}

/* ── 初期メンバー（29組） ── */
const DEFAULT_MEMBERS = [
  { id: "m01", store: "【本部】", person: "助田" },
  { id: "m02", store: "ひかり調剤（鵜方）", person: "谷口（医療事務）" },
  { id: "m03", store: "ひかり調剤（鵜方）", person: "廣岡（医療事務）" },
  { id: "m04", store: "ひかり調剤（鵜方）", person: "谷村（医療事務）" },
  { id: "m05", store: "ひかり調剤（鵜方）", person: "真鍋（薬剤師）" },
  { id: "m06", store: "ひかり調剤（鵜方）", person: "山崎（医療事務）" },
  { id: "m07", store: "ひかり調剤（鵜方）", person: "浜口（パート医療事務）" },
  { id: "m08", store: "【全店舗】", person: "全体会議　通知" },
  { id: "m09", store: "【全体（医療事務ミーティング）】", person: "通知" },
  { id: "m10", store: "ひかりハート薬局（岡本）", person: "田原（薬剤師）" },
  { id: "m11", store: "ひかりハート薬局（岡本）", person: "三橋（医療事務）" },
  { id: "m12", store: "ひかりハート薬局（岡本）", person: "佐野（薬剤師）" },
  { id: "m13", store: "ひかりハート薬局（岡本）", person: "森田（パート医療事務）" },
  { id: "m14", store: "【本部・ひかり調剤（鵜方）】", person: "加藤（代表）" },
  { id: "m15", store: "ひかりファーマシー（神久）", person: "高橋（医療事務）" },
  { id: "m16", store: "ひかりファーマシー（神久）", person: "櫻井（薬剤師）" },
  { id: "m17", store: "ひかりファーマシー（神久）", person: "池田（医療事務）" },
  { id: "m18", store: "ひかりファーマシー（神久）", person: "江藤（パート医療事務）" },
  { id: "m19", store: "ひかりファーマシー（神久）", person: "新川（薬剤師）" },
  { id: "m20", store: "ひかり薬局（射和）", person: "水田（薬剤師）" },
  { id: "m21", store: "ひかり薬局（射和）", person: "浅利（薬剤師）" },
  { id: "m22", store: "ひかり薬局（射和）", person: "北村（医療事務）" },
  { id: "m23", store: "ひかり薬局（射和）", person: "山本（医療事務）" },
  { id: "m24", store: "ひかり薬局（射和）", person: "うらら（パート医療事務）" },
  { id: "m25", store: "ひかり薬局（射和）", person: "若山（パート医療事務）" },
  { id: "m26", store: "【ひかり薬局（射和）】", person: "" },
  { id: "m27", store: "【ひかりハート薬局（岡本）】", person: "" },
  { id: "m28", store: "【ひかり調剤（鵜方）】", person: "" },
  { id: "m29", store: "【ひかりファーマシー（神久）】", person: "" },
];

function mergeDefaults(current) {
  const has = new Set(current.map((m) => `${m.store}|${m.person || ""}`));
  const add = DEFAULT_MEMBERS.filter((m) => !has.has(`${m.store}|${m.person || ""}`));
  return [...current, ...add];
}

function normalizeTask(t) {
  const out = { ...t };
  if (out.byStore === undefined) out.byStore = false;
  if (!out.stores) out.stores = emptyStores();
  if (out.done === undefined) out.done = typeof t.stage === "number" ? t.stage >= 4 : false;
  if (out.meeting === undefined) out.meeting = false;
  if (out.jimu === undefined) out.jimu = false;
  delete out.stage;
  delete out.distributedAt;
  return out;
}

/* ── 並び替え／グループ化 ── */
const byDue = (a, b) => (a.due && b.due ? (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) : a.due ? -1 : b.due ? 1 : 0);

function arrangeTasks(tasks, sortBy, memberById) {
  if (sortBy === "store" || sortBy === "person") {
    const map = new Map();
    tasks.forEach((t) => {
      const m = memberById[t.memberId];
      let label;
      if (!m) label = "（不明）";
      else if (sortBy === "store") label = m.store;
      else label = hasPerson(m) ? m.person : NO_PERSON;
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(t);
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
  if (sortBy === "new") items.sort((a, b) => b.createdAt - a.createdAt);
  else items.sort(byDue);
  return [{ key: "all", label: null, items }];
}

const TASK_SORTS = [
  { id: "due", label: "期日順", icon: <CalendarDays size={13} /> },
  { id: "store", label: "店舗別", icon: <Store size={13} /> },
  { id: "person", label: "人別", icon: <User size={13} /> },
  { id: "new", label: "新しい順", icon: <Clock size={13} /> },
];

const MEMBER_SORTS = [
  { id: "added", label: "登録順" },
  { id: "store", label: "店舗名順" },
  { id: "person", label: "担当者順" },
  { id: "count", label: "案件の多い順" },
];

export default function App() {
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("tasks"); // tasks | members | meeting | jimu
  const [showDone, setShowDone] = useState(false);
  const [q, setQ] = useState("");
  const [taskSort, setTaskSort] = useState("due");
  const [memberSort, setMemberSort] = useState("added");
  const [flagSort, setFlagSort] = useState({ meeting: "store", jimu: "store" });
  const [backupOpen, setBackupOpen] = useState(false);

  /* 共有まわり */
  const [me, setMe] = useState("");
  const [mePickerOpen, setMePickerOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null); // {by, at}
  const [syncing, setSyncing] = useState(false);
  const [shareOk, setShareOk] = useState(true);
  const lastSyncRef = useRef(0);
  const skipSaveRef = useRef(false);

  /* 共有データの取得 */
  const pull = async (force) => {
    setSyncing(true);
    let ok = true;
    try {
      const r = await window.storage.get(SHARED_KEY, true);
      if (r && r.value) {
        const d = JSON.parse(r.value);
        const at = d.updatedAt || 0;
        if (force || at > lastSyncRef.current) {
          skipSaveRef.current = true;
          setMembers(d.members && d.members.length ? d.members : DEFAULT_MEMBERS);
          setTasks((d.tasks || []).map(normalizeTask));
          setLastUpdate({ by: d.updatedBy || "", at });
          lastSyncRef.current = at;
        }
      } else if (force) {
        setMembers(DEFAULT_MEMBERS);
      }
    } catch (e) {
      // 未保存（初回）か、共有が使えない
      if (force) setMembers(DEFAULT_MEMBERS);
      if (!/not found|no such/i.test(String(e))) ok = false;
    }
    setShareOk(ok);
    setSyncing(false);
  };

  /* 初回読み込み */
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(ME_KEY);
        if (r && r.value) setMe(r.value);
      } catch (e) {}
      await pull(true);
      setLoaded(true);
    })();
  }, []);

  /* 変更を共有へ書き込み */
  useEffect(() => {
    if (!loaded) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    const at = Date.now();
    lastSyncRef.current = at;
    setLastUpdate({ by: me, at });
    (async () => {
      try {
        await window.storage.set(
          SHARED_KEY,
          JSON.stringify({ app: "haifubutsu-kanri", version: 3, members, tasks, updatedAt: at, updatedBy: me }),
          true
        );
        setShareOk(true);
      } catch (e) {
        setShareOk(false);
      }
    })();
  }, [members, tasks, loaded]);

  /* 定期的に取り直す（他の人の更新を反映） */
  useEffect(() => {
    if (!loaded) return;
    const iv = setInterval(() => pull(false), 20000);
    const onVis = () => { if (!document.hidden) pull(false); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [loaded]);

  const [saveState, setSaveState] = useState("idle"); // idle | saving | done | error

  const pushNow = async () => {
    setSaveState("saving");
    const at = Date.now();
    try {
      await window.storage.set(
        SHARED_KEY,
        JSON.stringify({ app: "haifubutsu-kanri", version: 3, members, tasks, updatedAt: at, updatedBy: me }),
        true
      );
      lastSyncRef.current = at;
      setLastUpdate({ by: me, at });
      setShareOk(true);
      setSaveState("done");
      setTimeout(() => setSaveState("idle"), 2200);
    } catch (e) {
      setShareOk(false);
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2600);
    }
  };

  const chooseMe = async (name) => {
    setMe(name);
    setMePickerOpen(false);
    try { await window.storage.set(ME_KEY, name); } catch (e) {}
  };

  const memberById = useMemo(() => {
    const m = {};
    members.forEach((x) => (m[x.id] = x));
    return m;
  }, [members]);

  const activeCountByMember = useMemo(() => {
    const c = {};
    tasks.forEach((t) => { if (!isDone(t)) c[t.memberId] = (c[t.memberId] || 0) + 1; });
    return c;
  }, [tasks]);

  const sortedMembers = useMemo(() => {
    const arr = [...members];
    if (memberSort === "store") arr.sort((a, b) => a.store.localeCompare(b.store, "ja"));
    else if (memberSort === "person")
      arr.sort((a, b) => {
        const ap = hasPerson(a), bp = hasPerson(b);
        if (!ap && !bp) return a.store.localeCompare(b.store, "ja");
        if (!ap) return 1;
        if (!bp) return -1;
        return a.person.localeCompare(b.person, "ja");
      });
    else if (memberSort === "count")
      arr.sort((a, b) => (activeCountByMember[b.id] || 0) - (activeCountByMember[a.id] || 0));
    return arr;
  }, [members, memberSort, activeCountByMember]);

  const activeTasks = useMemo(() => tasks.filter((t) => !isDone(t)), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(isDone), [tasks]);
  const meetingTasks = useMemo(() => tasks.filter((t) => t.meeting), [tasks]);
  const jimuTasks = useMemo(() => tasks.filter((t) => t.jimu), [tasks]);

  const filteredActive = useMemo(
    () =>
      activeTasks.filter((t) => {
        if (!q.trim()) return true;
        const m = memberById[t.memberId];
        const hay = `${m ? m.store + (m.person || "") : ""}${t.title || ""}${t.content || ""}`;
        return hay.includes(q.trim());
      }),
    [activeTasks, q, memberById]
  );

  const taskGroups = useMemo(() => arrangeTasks(filteredActive, taskSort, memberById), [filteredActive, taskSort, memberById]);
  const flagTasks = view === "meeting" ? meetingTasks : view === "jimu" ? jimuTasks : [];
  const flagGroups = useMemo(
    () => (view === "meeting" || view === "jimu" ? arrangeTasks(flagTasks, flagSort[view], memberById) : []),
    [view, flagTasks, flagSort, memberById]
  );

  /* メンバー操作 */
  const addMember = (store, person) =>
    setMembers((prev) => [...prev, { id: uid(), store: store.trim(), person: (person || "").trim() }]);
  const updateMember = (id, store, person) =>
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, store: store.trim(), person: (person || "").trim() } : m)));
  const removeMember = (id) => setMembers((prev) => prev.filter((m) => m.id !== id));
  const restoreDefaults = () => setMembers((prev) => mergeDefaults(prev));

  /* 案件操作 */
  const addTask = ({ memberId, title, content, due, meeting, jimu, byStore }) =>
    setTasks((prev) => [
      {
        id: uid(), memberId, title: title.trim(), content: content.trim(), due: due || "",
        meeting: !!meeting, jimu: !!jimu, byStore: !!byStore, done: false, stores: emptyStores(),
        createdAt: Date.now(), createdBy: me,
      },
      ...prev,
    ]);

  const updateTask = (id, patch) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const toggleFlag = (id, key) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [key]: !t[key] } : t)));
  const clearFlag = (key) => setTasks((prev) => prev.map((t) => (t[key] ? { ...t, [key]: false } : t)));

  const setDone = (id, v) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: v } : t)));
  const toggleStore = (id, store) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, stores: { ...t.stores, [store]: !t.stores[store] } } : t)));
  const allStores = (id, v) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, stores: STORES.reduce((o, s) => ({ ...o, [s]: v }), {}) } : t)));
  const removeTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const restoreData = (data) => {
    setMembers(Array.isArray(data.members) ? data.members : []);
    setTasks(Array.isArray(data.tasks) ? data.tasks.map(normalizeTask) : []);
  };

  const taskSortLabel = (TASK_SORTS.find((s) => s.id === taskSort) || {}).label || "";
  const flagDef = view === "meeting" || view === "jimu" ? FLAGS[view] : null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: fontStack, color: C.ink }}>
      <PrintStyles />

      <div className="screen-area" style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 96px" }}>
        {flagDef ? (
          <FlagListView
            def={flagDef}
            tasks={flagTasks}
            groups={flagGroups}
            sortBy={flagSort[view]}
            setSortBy={(v) => setFlagSort((s) => ({ ...s, [view]: v }))}
            memberById={memberById}
            onBack={() => setView("tasks")}
            onToggle={(id) => toggleFlag(id, view)}
            onClearAll={() => clearFlag(view)}
          />
        ) : (
          <>
            <Header />
            <ShareBar
              me={me}
              lastUpdate={lastUpdate}
              syncing={syncing}
              shareOk={shareOk}
              saveState={saveState}
              onPull={() => pull(true)}
              onPush={pushNow}
              onPickMe={() => setMePickerOpen(true)}
            />
            <FlagBar def={FLAGS.meeting} count={meetingTasks.length} onOpen={() => setView("meeting")} />
            <FlagBar def={FLAGS.jimu} count={jimuTasks.length} onOpen={() => setView("jimu")} />

            <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
              <TabBtn active={view === "tasks"} onClick={() => setView("tasks")} icon={<ClipboardList size={16} />}>
                案件 <Count n={activeTasks.length} active={view === "tasks"} />
              </TabBtn>
              <TabBtn active={view === "members"} onClick={() => setView("members")} icon={<Users size={16} />}>
                メンバー <Count n={members.length} active={view === "members"} />
              </TabBtn>
              {((view === "tasks" && filteredActive.length > 0) || (view === "members" && members.length > 0)) && (
                <button onClick={doPrint} style={{ ...printBtn, marginLeft: "auto" }} title="この一覧を印刷">
                  <Printer size={15} /> 印刷
                </button>
              )}
            </div>

            {!loaded ? (
              <div style={{ color: C.faint, padding: "40px 0", textAlign: "center" }}>読み込み中…</div>
            ) : view === "tasks" ? (
              <TasksView
                members={members}
                memberById={memberById}
                groups={taskGroups}
                shownCount={filteredActive.length}
                allActiveCount={activeTasks.length}
                sortBy={taskSort}
                setSortBy={setTaskSort}
                doneTasks={doneTasks}
                showDone={showDone}
                setShowDone={setShowDone}
                q={q}
                setQ={setQ}
                onAdd={addTask}
                onUpdate={updateTask}
                onSetDone={setDone}
                onToggleStore={toggleStore}
                onAllStores={allStores}
                onRemove={removeTask}
                onToggleFlag={toggleFlag}
                goMembers={() => setView("members")}
              />
            ) : (
              <MembersView
                members={sortedMembers}
                totalMembers={members.length}
                countByMember={activeCountByMember}
                sortBy={memberSort}
                setSortBy={setMemberSort}
                onAdd={addMember}
                onUpdate={updateMember}
                onRemove={removeMember}
                onOpenBackup={() => setBackupOpen(true)}
                onRestoreDefaults={restoreDefaults}
              />
            )}
          </>
        )}
      </div>

      {/* 印刷用 */}
      <div className="print-area">
        {flagDef ? (
          <PrintFlagList def={flagDef} groups={flagGroups} sortBy={flagSort[view]} memberById={memberById} total={flagTasks.length} />
        ) : view === "members" ? (
          <PrintMembers members={sortedMembers} countByMember={activeCountByMember} sortBy={memberSort} />
        ) : (
          <PrintTasks groups={taskGroups} memberById={memberById} total={filteredActive.length} sortLabel={taskSortLabel} />
        )}
      </div>

      {backupOpen && (
        <BackupModal members={members} tasks={tasks} onClose={() => setBackupOpen(false)} onRestore={restoreData} />
      )}
      {mePickerOpen && (
        <MePicker members={members} me={me} onPick={chooseMe} onClose={() => setMePickerOpen(false)} />
      )}
    </div>
  );
}

/* ───────── 共有バー ───────── */
function ShareBar({ me, lastUpdate, syncing, shareOk, saveState, onPull, onPush, onPickMe }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap",
        background: shareOk ? C.tealSoft : C.amberSoft,
        border: `1px solid ${shareOk ? C.tealSoft : C.amber}`,
        borderRadius: 11, padding: "9px 12px",
      }}
    >
      <Cloud size={15} color={shareOk ? C.teal : C.amber} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: shareOk ? C.teal : C.amber }}>
          {shareOk ? "共有中（同じリンクの人と同じデータ）" : "共有できていません"}
        </div>
        <div style={{ fontSize: 11, color: C.sub, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {shareOk
            ? lastUpdate && lastUpdate.at
              ? `最終更新 ${lastUpdate.by ? lastUpdate.by + "・" : ""}${timeAgo(lastUpdate.at)}`
              : "まだ更新はありません"
            : "この端末だけで動いています。控えを取っておいてください"}
        </div>
      </div>
      <button
        onClick={onPush}
        disabled={saveState === "saving"}
        style={{
          ...miniBtn,
          background: saveState === "done" ? C.teal : saveState === "error" ? C.stamp : C.surface,
          color: saveState === "done" || saveState === "error" ? "#fff" : C.ink,
          border: `1px solid ${saveState === "done" ? C.teal : saveState === "error" ? C.stamp : C.line}`,
          fontWeight: 700,
        }}
        title="今の内容をすぐ保存"
      >
        <Save size={13} />
        {saveState === "saving" ? "保存中…" : saveState === "done" ? "保存しました" : saveState === "error" ? "失敗・再試行" : "今すぐ保存"}
      </button>
      <button onClick={onPickMe} style={{ ...miniBtn, background: C.surface }} title="自分の名前">
        <UserCircle size={13} /> {me || "名前を選ぶ"}
      </button>
      <button onClick={onPull} style={{ ...miniBtn, background: C.surface }} title="最新を取得">
        <RefreshCw size={13} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
      </button>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* 自分の名前を選ぶ */
function MePicker({ members, me, onPick, onClose }) {
  const PRIORITY = ["加藤", "助田"];
  const priorityRank = (name) => {
    const i = PRIORITY.findIndex((p) => name.includes(p));
    return i === -1 ? PRIORITY.length : i;
  };
  const list = members
    .filter(hasPerson)
    .slice()
    .sort((a, b) => priorityRank(a.person) - priorityRank(b.person));
  return (
    <Modal title="自分の名前を選ぶ" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, margin: "0 0 12px" }}>
        更新したときに「誰が触ったか」が分かるようになります。この端末にだけ記憶されます。
      </p>
      <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map((m, i) => {
          const name = m.person;
          const on = me === name;
          const isTop = priorityRank(name) < PRIORITY.length;
          const showDivider = i === 2 && list.slice(0, 2).some((x) => priorityRank(x.person) < PRIORITY.length);
          return (
            <React.Fragment key={m.id}>
              {showDivider && (
                <div style={{ borderTop: `1px solid ${C.line}`, margin: "4px 0" }} />
              )}
              <button
                onClick={() => onPick(name)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                  background: on ? C.tealSoft : C.surface,
                  border: `1px solid ${on ? C.teal : isTop ? C.amber : C.line}`,
                  borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: fontStack,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: on ? C.teal : C.ink }}>{name}</div>
                  <div style={{ fontSize: 11.5, color: C.sub }}>{m.store}</div>
                </div>
                {on && <Check size={16} color={C.teal} />}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </Modal>
  );
}

/* ───────── 印刷用スタイル ───────── */
function PrintStyles() {
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

/* 印刷：案件一覧 */
function PrintTasks({ groups, memberById, total, sortLabel }) {
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
          確認者　　　　　　　　<br />日付　　　／　　　
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
                const m = memberById[t.memberId];
                return (
                  <tr key={t.id} className="p-row">
                    <td style={{ ...td, textAlign: "left" }}>
                      <div style={{ fontWeight: 700 }}>{t.title || "（無題）"}</div>
                      {t.content && <div style={{ fontSize: 9.5, color: "#555", marginTop: 2, lineHeight: 1.4 }}>{t.content}</div>}
                    </td>
                    <td style={td}>{m ? m.store : "—"}</td>
                    <td style={td}>{hasPerson(m) ? m.person : "—"}</td>
                    <td style={td}>{t.due ? formatDue(t.due) : "—"}</td>
                    <td style={{ ...td, fontSize: 9 }}>
                      {[t.meeting ? "会議" : "", t.jimu ? "事務" : ""].filter(Boolean).join("・") || "—"}
                    </td>
                    <td style={{ ...td, textAlign: "left", whiteSpace: "nowrap" }}>
                      {t.byStore ? (
                        STORES.map((s) => (
                          <span key={s} style={{ marginRight: 5, fontSize: 9.5 }}>
                            <span style={{ ...checkBox, marginRight: 2, background: t.stores && t.stores[s] ? "#444" : "transparent" }} />
                            {s}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 9.5 }}><span style={{ ...checkBox, marginRight: 3 }} />済</span>
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

/* 印刷：転載リスト（会議／医療事務 共通） */
function PrintFlagList({ def, groups, sortBy, memberById, total }) {
  const sortLabel = sortBy === "store" ? "店舗別" : sortBy === "person" ? "人別" : "期日順";
  return (
    <div style={printSheet}>
      <div style={printHead}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{def.full}</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
            {todayLabel()}　{total}件　／　{sortLabel}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#666", textAlign: "right", lineHeight: 1.6 }}>
          記入者　　　　　　　　<br />開催日　　　／　　　
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
            const m = memberById[t.memberId];
            const sub = !m ? "—" : sortBy === "store" ? (hasPerson(m) ? m.person : "担当なし") : m.store;
            return (
              <div key={t.id} className="p-row" style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px dotted #bbb" }}>
                <span style={{ ...checkBox, marginTop: 3, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11.5 }}>
                    <span style={{ fontWeight: 700 }}>{t.title || "（無題）"}</span>
                    <span style={{ color: "#555" }}>
                      　（{sub}）　{doneText(t)}{t.due ? `　期日 ${formatDue(t.due)}` : ""}
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

/* 印刷：メンバー控え */
function PrintMembers({ members, countByMember, sortBy }) {
  const label = (MEMBER_SORTS.find((s) => s.id === sortBy) || {}).label || "";
  return (
    <div style={printSheet}>
      <div style={printHead}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>店舗・担当者　控え</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
            {todayLabel()}　全{members.length}組　／　{label}
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
              <td style={{ ...td, textAlign: "left", color: hasPerson(m) ? "#111" : "#999" }}>
                {hasPerson(m) ? m.person : "未設定"}
              </td>
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

const printSheet = { fontFamily: fontStack, color: "#111", padding: 4 };
const printHead = {
  display: "flex", justifyContent: "space-between", alignItems: "flex-end",
  borderBottom: "2px solid #222", paddingBottom: 7, marginBottom: 12,
};
const printTable = { width: "100%", borderCollapse: "collapse", fontSize: 10.5, marginBottom: 4 };
const th = { border: "1px solid #999", background: "#eee", padding: "5px 4px", fontSize: 10, fontWeight: 700, textAlign: "center" };
const td = { border: "1px solid #999", padding: "5px 4px", textAlign: "center", verticalAlign: "top" };
const checkBox = { display: "inline-block", width: 10, height: 10, border: "1.2px solid #444", borderRadius: 2 };

/* ───────── ヘッダー ───────── */
function Header() {
  return (
    <header style={{ padding: "26px 0 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: C.teal, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Package size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "0.02em" }}>ユナイテッドファーマシー</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.sub }}>〜仕事を皆で進めよう2026〜</p>
        </div>
      </div>
    </header>
  );
}

/* ───────── 転載バー ───────── */
function FlagBar({ def, count, onOpen }) {
  const has = count > 0;
  const Icon = def.icon;
  return (
    <button
      onClick={onOpen}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
        background: has ? def.color : C.surface, color: has ? "#fff" : C.sub,
        border: `1px solid ${has ? def.color : C.line}`, borderRadius: 12,
        padding: "12px 15px", fontFamily: fontStack, cursor: "pointer", textAlign: "left",
      }}
    >
      <Icon size={18} color={has ? "#fff" : def.color} />
      <span style={{ fontSize: 14.5, fontWeight: 700 }}>{def.full}</span>
      <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "2px 9px", background: has ? "rgba(255,255,255,0.22)" : def.soft, color: has ? "#fff" : def.color }}>
        {count}件
      </span>
      <ChevronRight size={17} style={{ marginLeft: "auto", opacity: 0.75 }} />
    </button>
  );
}

/* ───────── 転載リスト画面（会議／医療事務 共通） ───────── */
function FlagListView({ def, tasks, groups, sortBy, setSortBy, memberById, onBack, onToggle, onClearAll }) {
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const Icon = def.icon;

  const buildText = () => {
    const today = new Date();
    let out = `【${def.full}】${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}\n\n`;
    groups.forEach((g) => {
      if (g.label) out += `■ ${g.label}\n`;
      g.items.forEach((t) => {
        const m = memberById[t.memberId];
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
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  };

  return (
    <div>
      <header style={{ padding: "22px 0 14px" }}>
        <button
          onClick={onBack}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: C.sub, fontSize: 13.5, fontFamily: fontStack, cursor: "pointer", padding: "4px 0 10px" }}
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
            まだ転載する案件がありません。<br />
            案件カードの「{def.label}」にチェックを入れると、ここにまとまります。
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <ArrowDownUp size={13} color={C.sub} />
            <SortPill color={def.color} active={sortBy === "store"} onClick={() => setSortBy("store")} icon={<Store size={13} />}>店舗別</SortPill>
            <SortPill color={def.color} active={sortBy === "person"} onClick={() => setSortBy("person")} icon={<User size={13} />}>人別</SortPill>
            <SortPill color={def.color} active={sortBy === "due"} onClick={() => setSortBy("due")} icon={<CalendarDays size={13} />}>期日順</SortPill>
            <button
              onClick={doCopy}
              style={{
                marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5,
                background: copied ? C.tealSoft : C.surface, color: copied ? C.teal : C.sub,
                border: `1px solid ${copied ? C.tealSoft : C.line}`, borderRadius: 20,
                padding: "6px 12px", fontSize: 12.5, fontWeight: 600, fontFamily: fontStack, cursor: "pointer",
              }}
            >
              {copied ? <><Check size={13} /> コピーしました</> : <><Copy size={13} /> 文章でコピー</>}
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
                    <FlagRow key={t.id} def={def} task={t} member={memberById[t.memberId]} sortBy={sortBy} onToggle={() => onToggle(t.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 26, textAlign: "center" }}>
            {confirmClear ? (
              <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                <span style={{ fontSize: 13, color: C.sub }}>全て解除しますか？</span>
                <button onClick={() => setConfirmClear(false)} style={{ ...ghostBtn, padding: "7px 12px" }}>やめる</button>
                <button
                  onClick={() => { onClearAll(); setConfirmClear(false); }}
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

function FlagRow({ def, task, member, sortBy, onToggle }) {
  const due = dueMeta(task.due);
  const done = isDone(task);
  const sub = !member ? "（不明）" : sortBy === "store" ? (hasPerson(member) ? member.person : "担当者なし") : member.store;
  const other = def.key === "meeting" ? (task.jimu ? FLAGS.jimu : null) : (task.meeting ? FLAGS.meeting : null);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 11, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{task.title || "（無題）"}</span>
          {due && (
            <span style={{ fontSize: 11, fontWeight: due.bold ? 700 : 600, padding: "2px 7px", borderRadius: 20, background: due.bg, color: due.fg }}>
              {due.text}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: C.sub }}>{sub}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: done ? C.stampSoft : C.tealSoft, color: done ? C.stamp : C.teal }}>
            {doneText(task)}
          </span>
          {other && (
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: other.soft, color: other.color }}>
              {other.label}にも
            </span>
          )}
        </div>
        {task.content && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: C.sub, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{task.content}</p>}
      </div>
      <button onClick={onToggle} title="リストから外す" style={{ ...iconBtn, color: def.color }}>
        <CheckSquare size={17} />
      </button>
    </div>
  );
}

function SortPill({ active, onClick, icon, children, color }) {
  const c = color || C.teal;
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 20,
        padding: "6px 12px", fontSize: 12.5, fontWeight: 600, fontFamily: fontStack, cursor: "pointer",
        border: `1px solid ${active ? c : C.line}`,
        background: active ? c : C.surface, color: active ? "#fff" : C.sub,
      }}
    >
      {icon} {children}
    </button>
  );
}

/* ───────── 案件ビュー ───────── */
function TasksView({
  members, memberById, groups, shownCount, allActiveCount, sortBy, setSortBy,
  doneTasks, showDone, setShowDone, q, setQ,
  onAdd, onUpdate, onSetDone, onToggleStore, onAllStores, onRemove, onToggleFlag, goMembers,
}) {
  const [modal, setModal] = useState(null);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => setModal({ mode: "add" })}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, background: C.teal, color: "#fff",
            border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600,
            fontFamily: fontStack, cursor: "pointer", flexShrink: 0,
          }}
        >
          <Plus size={16} /> 案件を追加
        </button>
        <button
          onClick={() => setModal({ mode: "voice" })}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, background: C.surface, color: C.teal,
            border: `1.5px solid ${C.teal}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600,
            fontFamily: fontStack, cursor: "pointer", flexShrink: 0,
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
              width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 32px",
              borderRadius: 10, border: `1px solid ${C.line}`, background: C.surface,
              fontSize: 14, fontFamily: fontStack, color: C.ink, outline: "none",
            }}
          />
        </div>
      </div>

      {shownCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <ArrowDownUp size={13} color={C.sub} />
          {TASK_SORTS.map((s) => (
            <SortPill key={s.id} active={sortBy === s.id} onClick={() => setSortBy(s.id)} icon={s.icon}>
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
                    member={memberById[t.memberId]}
                    onSetDone={onSetDone}
                    onToggleStore={onToggleStore}
                    onAllStores={onAllStores}
                    onRemove={onRemove}
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
                  member={memberById[t.memberId]}
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

      {modal && modal.mode === "voice" && (
        <VoiceModal
          members={members}
          onClose={() => setModal(null)}
          onParsed={(draft) => setModal({ mode: "add", draft })}
        />
      )}

      {modal && (modal.mode === "add" || modal.mode === "edit") && (
        <TaskModal
          mode={modal.mode}
          task={modal.task}
          draft={modal.draft}
          members={members}
          memberById={memberById}
          onClose={() => setModal(null)}
          onAdd={onAdd}
          onUpdate={onUpdate}
          goMembers={goMembers}
        />
      )}
    </div>
  );
}

function EmptyState({ allActiveCount, hasMembers, onAdd, goMembers }) {
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

/* ───────── 案件カード ───────── */
function TaskCard({ task, member, onSetDone, onToggleStore, onAllStores, onRemove, onEdit, onToggleFlag }) {
  const due = dueMeta(task.due);
  const doneCount = doneStoreList(task).length;
  const flagged = task.meeting || task.jimu;
  const edgeColor = task.meeting && task.jimu ? C.plum : task.meeting ? C.navy : task.jimu ? C.plum : C.line;

  return (
    <div
      style={{
        background: C.surface, borderRadius: 14, overflow: "hidden",
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
                  <User size={12} /> {member.person}
                </span>
              )}
            </div>

            {task.content && (
              <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.55, color: C.sub, whiteSpace: "pre-wrap" }}>{task.content}</p>
            )}
          </div>

          <button onClick={onEdit} title="修正" style={{ ...iconBtn, flexShrink: 0 }}>
            <Pencil size={15} />
          </button>
        </div>
      </div>

      {/* 済の操作 */}
      {task.byStore && (
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
              const on = !!(task.stores && task.stores[s]);
              return (
                <button
                  key={s}
                  onClick={() => onToggleStore(task.id, s)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    background: on ? C.stampSoft : C.surface,
                    border: `1.5px solid ${on ? C.stamp : C.line}`,
                    borderRadius: 10, padding: "9px 4px", cursor: "pointer", fontFamily: fontStack,
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

      {/* 転載チェック（2種） */}
      <div style={{ display: "flex", gap: 6, padding: "12px 16px 0", flexWrap: "wrap" }}>
        <FlagCheck def={FLAGS.meeting} checked={!!task.meeting} onClick={() => onToggleFlag(task.id, "meeting")} />
        <FlagCheck def={FLAGS.jimu} checked={!!task.jimu} onClick={() => onToggleFlag(task.id, "jimu")} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 14px", alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => (task.byStore ? onAllStores(task.id, true) : onSetDone(task.id, true))}
          style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
            background: C.stamp, color: "#fff", border: "none",
            borderRadius: 9, padding: "9px 18px", fontSize: 13.5, fontWeight: 600,
            fontFamily: fontStack, cursor: "pointer",
          }}
        >
          <Check size={15} /> {task.byStore ? "全店舗 済" : "済にする"}
        </button>
      </div>
    </div>
  );
}

function FlagCheck({ def, checked, onClick, small }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: checked ? def.color : "none", color: checked ? "#fff" : C.sub,
        border: `1px solid ${checked ? def.color : C.line}`, borderRadius: 9,
        padding: small ? "6px 9px" : "8px 12px", fontSize: small ? 11.5 : 12.5,
        fontWeight: 600, fontFamily: fontStack, cursor: "pointer",
      }}
    >
      {checked ? <CheckSquare size={14} /> : <Square size={14} />} {def.label}へ
    </button>
  );
}

/* ───────── 済カード（削除はここだけ） ───────── */
function DoneCard({ task, member, onSetDone, onAllStores, onRemove, onToggleFlag }) {
  const [confirm, setConfirm] = useState(false);

  const undo = () => {
    if (task.byStore) onAllStores(task.id, false);
    else onSetDone(task.id, false);
  };

  if (confirm) {
    return (
      <div style={{ background: C.stampSoft, border: `1px solid ${C.stamp}`, borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={16} color={C.stamp} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>
            「{task.title || "（無題）"}」を削除しますか？<br />
            <span style={{ fontSize: 12, color: C.sub }}>削除すると元に戻せません。</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
          <button onClick={() => setConfirm(false)} style={{ ...ghostBtn, background: C.surface }}>やめる</button>
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
          <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {task.title || "（無題）"}
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
    <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "50%", border: `2px solid ${C.stamp}`, color: C.stamp, display: "grid", placeItems: "center", fontSize: 18, fontWeight: 800, transform: "rotate(-8deg)", background: C.stampSoft }}>
      済
    </div>
  );
}

/* ───────── 音声で追加 ───────── */
function VoiceModal({ members, onClose, onParsed }) {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const recRef = useRef(null);
  const supported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => () => { try { recRef.current && recRef.current.stop(); } catch (e) {} }, []);

  const start = () => {
    setErr(null);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErr("この端末では音声入力が使えません。下の欄に文字で入力してください。"); return; }
    try {
      const rec = new SR();
      rec.lang = "ja-JP";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let fin = "", itr = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) fin += r[0].transcript;
          else itr += r[0].transcript;
        }
        if (fin) setText((p) => (p ? p + fin : fin));
        setInterim(itr);
      };
      rec.onerror = (e) => {
        const k = e && e.error;
        setErr(
          k === "not-allowed" || k === "service-not-allowed"
            ? "マイクの使用が許可されていません。ブラウザの設定でマイクを許可するか、下の欄に文字で入力してください。"
            : "音声がうまく拾えませんでした。もう一度お試しください。"
        );
        setListening(false);
      };
      rec.onend = () => { setListening(false); setInterim(""); };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch (e) {
      setErr("音声入力を開始できませんでした。下の欄に文字で入力してください。");
    }
  };

  const stop = () => { try { recRef.current && recRef.current.stop(); } catch (e) {} setListening(false); };

  const parse = async () => {
    const src = (text + " " + interim).trim();
    if (!src) return;
    stop();
    setBusy(true);
    setErr(null);
    try {
      const list = members.map((m) => `${m.id} / ${m.store} / ${m.person || "（担当者なし）"}`).join("\n");
      const prompt = `あなたは薬局チェーンの「店舗配布物 管理アプリ」の入力補助です。
話された内容から、登録する案件の情報を読み取ってJSONだけを返してください。

今日の日付: ${toKey(new Date())}
店舗ごとの済に使う4店舗: ${STORES.join(", ")}

メンバー一覧（id / 店舗 / 担当者）:
${list}

話された内容:
"""
${src}
"""

以下の形式のJSONだけを返してください。説明・前置き・コードブロックは不要です。
{
  "title": "案件の短いタイトル",
  "memberId": "最も合うメンバーのid。判断できなければ空文字",
  "content": "補足のメモ。なければ空文字",
  "due": "YYYY-MM-DD形式の期日。言及がなければ空文字",
  "meeting": true または false,
  "jimu": true または false,
  "byStore": true または false
}

判断の目安:
- 「明日まで」「来週」「今月末」などは今日の日付から計算する
- 店舗名や人名が出たら、最も近いメンバーのidを選ぶ
- 「会議で」「全体会議」などの話題なら meeting を true
- 「医療事務」「事務ミーティング」などの話題なら jimu を true
- 「全店舗」「各店」「みんなに配る」など複数店舗にまたがる場合は byStore を true
- タイトルは配布物の名前を短くまとめる`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const raw = (data.content || []).map((i) => (i.type === "text" ? i.text : "")).join("");
      const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
      const obj = JSON.parse(clean);

      const valid = members.some((m) => m.id === obj.memberId);
      onParsed({
        title: obj.title || "",
        memberId: valid ? obj.memberId : "",
        content: obj.content || "",
        due: /^\d{4}-\d{2}-\d{2}$/.test(obj.due || "") ? obj.due : "",
        meeting: !!obj.meeting,
        jimu: !!obj.jimu,
        byStore: !!obj.byStore,
        rawText: src,
      });
    } catch (e) {
      setErr("うまく読み取れませんでした。もう一度話すか、文字を直してからお試しください。");
    }
    setBusy(false);
  };

  const shown = (text + (interim ? interim : "")).trim();

  return (
    <Modal title="音声で案件を追加" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.65, margin: "0 0 6px" }}>
        マイクを押して、いつも通り話してください。
      </p>
      <div
        style={{
          display: "flex", gap: 8, alignItems: "flex-start",
          background: "#FBFCFA", border: `1px dashed ${C.line}`, borderRadius: 10,
          padding: "10px 12px", marginBottom: 14,
        }}
      >
        <Sparkles size={14} color={C.faint} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, color: C.ink, marginBottom: 2 }}>話し方の例（全体向け・期日なし）</div>
          「全店舗に連絡です。薬剤師の皆さんへ、自主勉強会に出席したら申請してください。
          期日は特にありません。」
          <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
            → タイトル「自主勉強会の出席申請」／宛先【全店舗】／期日なし／店舗ごとの済チェックがONになります
          </div>
        </div>
      </div>

      {/* マイク */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <button
          onClick={listening ? stop : start}
          disabled={busy || !supported}
          style={{
            width: 88, height: 88, borderRadius: "50%", border: "none", cursor: busy || !supported ? "default" : "pointer",
            background: listening ? C.stamp : supported ? C.teal : C.line,
            color: "#fff", display: "inline-grid", placeItems: "center",
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

      {/* 文字起こし（手直しもできる） */}
      <Field label="読み取った内容（直せます）">
        <textarea
          value={shown}
          onChange={(e) => { setText(e.target.value); setInterim(""); }}
          rows={4}
          placeholder="ここに話した内容が入ります。直接入力してもOKです"
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
        />
      </Field>

      {err && (
        <div style={{ fontSize: 12.5, lineHeight: 1.6, padding: "9px 12px", borderRadius: 9, background: C.amberSoft, color: C.amber, marginBottom: 10 }}>
          {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} style={ghostBtn}>キャンセル</button>
        <button
          onClick={parse}
          disabled={!shown || busy}
          style={{ ...primaryBtn, marginLeft: "auto", opacity: !shown || busy ? 0.5 : 1 }}
        >
          <Sparkles size={15} /> {busy ? "読み取り中…" : "内容を読み取る"}
        </button>
      </div>
    </Modal>
  );
}

/* ───────── 案件 追加／修正モーダル ───────── */
function TaskModal({ mode, task, draft, members, memberById, onClose, onAdd, onUpdate, goMembers }) {
  const isEdit = mode === "edit";
  const d = draft || null;
  const initialMember = isEdit ? task.memberId : (d && d.memberId) || members[0]?.id || "";
  const [memberId, setMemberId] = useState(initialMember);
  const [title, setTitle] = useState(isEdit ? task.title || "" : (d && d.title) || "");
  const [content, setContent] = useState(isEdit ? task.content || "" : (d && d.content) || "");
  const [due, setDue] = useState(isEdit ? task.due || "" : (d && d.due) || "");
  const [meeting, setMeeting] = useState(isEdit ? !!task.meeting : !!(d && d.meeting));
  const [jimu, setJimu] = useState(isEdit ? !!task.jimu : !!(d && d.jimu));
  const [byStore, setByStore] = useState(
    isEdit ? !!task.byStore : d ? !!d.byStore : !hasPerson(memberById[initialMember])
  );
  const [touchedByStore, setTouchedByStore] = useState(isEdit || !!d);

  const pickMember = (id) => {
    setMemberId(id);
    if (!touchedByStore) setByStore(!hasPerson(memberById[id]));
  };

  const submit = () => {
    if (!memberId || !title.trim()) return;
    const payload = { memberId, title: title.trim(), content: content.trim(), due, meeting, jimu, byStore };
    if (isEdit) onUpdate(task.id, payload);
    else onAdd({ ...payload, title, content });
    onClose();
  };

  const quickDue = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    setDue(toKey(d));
  };

  return (
    <Modal title={isEdit ? "案件を修正" : "案件を追加"} onClose={onClose}>
      {members.length === 0 ? (
        <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
          <p style={{ color: C.sub, fontSize: 13.5, margin: "0 0 12px" }}>先に店舗を登録してください。</p>
          <button onClick={() => { onClose(); goMembers(); }} style={primaryBtn}>メンバー登録へ</button>
        </div>
      ) : (
        <>
          {d && (
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start", background: C.tealSoft, borderRadius: 10, padding: "9px 12px", marginBottom: 12 }}>
              <Sparkles size={15} color={C.teal} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11.5, color: C.teal, lineHeight: 1.55 }}>
                音声から読み取りました。違うところは直してから追加してください。
              </div>
            </div>
          )}

          <Field label="タイトル">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：夏の新商品チラシ" autoFocus style={inputStyle} />
          </Field>

          <Field label="店舗・担当者">
            <select value={memberId} onChange={(e) => pickMember(e.target.value)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{memberLine(m)}</option>
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
              {due && <QuickBtn onClick={() => setDue("")} muted>期日なし</QuickBtn>}
            </div>
          </Field>

          <Field label="内容（助田さんから聞いた内容）">
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="配布物の内容をメモ" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          </Field>

          <ToggleBox
            on={byStore}
            onClick={() => { setByStore((v) => !v); setTouchedByStore(true); }}
            color={C.stamp}
            soft={C.stampSoft}
            title="店舗ごとに済を入れる"
            note={`${STORES.join("・")} を個別にチェック。全部そろうと済になります`}
          />

          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, margin: "4px 2px 7px" }}>
            転載先（両方に入れられます）
          </div>
          <ToggleBox
            on={meeting}
            onClick={() => setMeeting((v) => !v)}
            color={FLAGS.meeting.color}
            soft={FLAGS.meeting.soft}
            title="会議へ転載する"
            note="トップの「会議への転載リスト」にまとまります"
          />
          <ToggleBox
            on={jimu}
            onClick={() => setJimu((v) => !v)}
            color={FLAGS.jimu.color}
            soft={FLAGS.jimu.soft}
            title="医療事務ミーティングへ転載する"
            note="トップの「医療事務ミーティング」にまとまります"
          />

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={onClose} style={ghostBtn}>キャンセル</button>
            <button onClick={submit} disabled={!memberId || !title.trim()} style={{ ...primaryBtn, marginLeft: "auto", opacity: !title.trim() ? 0.5 : 1 }}>
              {isEdit ? "保存する" : "追加する"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function ToggleBox({ on, onClick, color, soft, title, note }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 9, cursor: "pointer",
        background: on ? soft : "#FBFCFA",
        border: `1px solid ${on ? color : C.line}`,
        borderRadius: 10, padding: "11px 13px", marginBottom: 10,
      }}
    >
      {on ? <CheckSquare size={18} color={color} /> : <Square size={18} color={C.faint} />}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: on ? color : C.ink }}>{title}</div>
        <div style={{ fontSize: 11.5, color: C.sub, marginTop: 1, lineHeight: 1.5 }}>{note}</div>
      </div>
    </div>
  );
}

function QuickBtn({ children, onClick, muted }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: muted ? "none" : C.tealSoft, color: muted ? C.faint : C.teal,
        border: muted ? `1px solid ${C.line}` : "none", borderRadius: 20,
        padding: "5px 11px", fontSize: 12, fontWeight: 600, fontFamily: fontStack, cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/* ───────── メンバービュー ───────── */
function MembersView({ members, totalMembers, countByMember, sortBy, setSortBy, onAdd, onUpdate, onRemove, onOpenBackup, onRestoreDefaults }) {
  const [restored, setRestored] = useState(false);
  const [store, setStore] = useState("");
  const [person, setPerson] = useState("");
  const [editId, setEditId] = useState(null);
  const [editStore, setEditStore] = useState("");
  const [editPerson, setEditPerson] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const add = () => {
    if (!store.trim()) return;
    onAdd(store, person);
    setStore("");
    setPerson("");
  };

  const startEdit = (m) => {
    setConfirmId(null);
    setEditId(m.id);
    setEditStore(m.store);
    setEditPerson(m.person || "");
  };

  const saveEdit = () => {
    if (!editStore.trim()) return;
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
        onClick={() => { onRestoreDefaults(); setRestored(true); setTimeout(() => setRestored(false), 2200); }}
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
        <div style={{ textAlign: "center", color: C.faint, fontSize: 14, padding: "24px 0" }}>
          登録されたメンバーはまだありません。
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            <ArrowDownUp size={13} color={C.sub} />
            {MEMBER_SORTS.map((s) => (
              <SortPill key={s.id} active={sortBy === s.id} onClick={() => setSortBy(s.id)}>{s.label}</SortPill>
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
                      {n > 0 && (
                        <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.5 }}>
                          この組に紐づく未処理の案件 {n}件にも、修正後の名前が反映されます。
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        <button onClick={() => setEditId(null)} style={ghostBtn}>キャンセル</button>
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
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.stamp }}>「{memberLine(m)}」を削除しますか？</div>
                        {n > 0 && (
                          <div style={{ fontSize: 12, color: C.ink, marginTop: 4, lineHeight: 1.5 }}>
                            未処理の案件が {n}件あります。削除すると、その案件の店舗名が「削除された店舗」になります。
                            名前を変えたいだけなら、削除ではなく修正をお使いください。
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <button onClick={() => setConfirmId(null)} style={{ ...ghostBtn, background: C.surface }}>やめる</button>
                      <button onClick={() => startEdit(m)} style={{ ...ghostBtn, background: C.surface }}><Pencil size={14} /> 修正する</button>
                      <button
                        onClick={() => { onRemove(m.id); setConfirmId(null); }}
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
                    <div style={{ fontSize: 12.5, color: hasPerson(m) ? C.sub : C.faint, fontStyle: hasPerson(m) ? "normal" : "italic" }}>
                      {hasPerson(m) ? m.person : "担当者 未設定"}
                    </div>
                  </div>
                  {n > 0 && (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: C.teal, background: C.tealSoft, borderRadius: 20, padding: "3px 9px" }}>
                      未処理 {n}
                    </span>
                  )}
                  <button onClick={() => startEdit(m)} style={{ ...ghostBtn, padding: "7px 11px", fontSize: 12.5 }} title="修正">
                    <Pencil size={14} /> 修正
                  </button>
                  <button onClick={() => setConfirmId(m.id)} style={iconBtn} title="削除"><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ───────── 控えモーダル ───────── */
function BackupModal({ members, tasks, onClose, onRestore }) {
  const [tab, setTab] = useState("out");
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(null);

  const json = useMemo(
    () => JSON.stringify({ app: "haifubutsu-kanri", version: 3, exportedAt: new Date().toISOString(), members, tasks }, null, 2),
    [members, tasks]
  );

  const doCopy = async () => {
    const ok = await copyToClipboard(json);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
    else setMsg({ type: "warn", text: "コピーできませんでした。下の枠を長押しして手動でコピーしてください。" });
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
    } catch (e) {
      setMsg({ type: "warn", text: "ファイル保存ができませんでした。「文章でコピー」をお使いください。" });
    }
  };

  const check = () => {
    setMsg(null);
    let data;
    try { data = JSON.parse(pasted); }
    catch (e) { setMsg({ type: "error", text: "控えの中身を読み取れませんでした。全文が貼れているか確認してください。" }); return; }
    if (!data || !Array.isArray(data.members) || !Array.isArray(data.tasks)) {
      setMsg({ type: "error", text: "このアプリの控えではないようです。" });
      return;
    }
    setPending(data);
  };

  return (
    <Modal title="控えを取る・戻す" onClose={onClose}>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <MiniTab active={tab === "out"} onClick={() => { setTab("out"); setMsg(null); setPending(null); }} icon={<Download size={14} />}>控えを取る</MiniTab>
        <MiniTab active={tab === "in"} onClick={() => { setTab("in"); setMsg(null); }} icon={<Upload size={14} />}>控えから戻す</MiniTab>
      </div>

      {tab === "out" ? (
        <>
          <p style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, margin: "0 0 12px" }}>
            登録済みの店舗 {members.length}組と、案件 {tasks.length}件をまとめて書き出します。
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={doSaveFile} style={{ ...primaryBtn, background: saved ? C.teal : C.amber }}>
              {saved ? <><Check size={15} /> 保存しました</> : <><Save size={15} /> ファイルに保存</>}
            </button>
            <button onClick={doCopy} style={{ ...ghostBtn, padding: "10px 14px" }}>
              {copied ? <><Check size={14} /> コピーしました</> : <><Copy size={14} /> 文章でコピー</>}
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
            onChange={(e) => { setPasted(e.target.value); setPending(null); setMsg(null); }}
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
                  <b>今のデータ（{members.length}組・{tasks.length}件）は上書きされます。</b>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                <button onClick={() => setPending(null)} style={{ ...ghostBtn, background: C.surface }}>やめる</button>
                <button
                  onClick={() => { onRestore(pending); onClose(); }}
                  style={{ marginLeft: "auto", background: C.stamp, color: "#fff", border: "none", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, fontFamily: fontStack, cursor: "pointer" }}
                >
                  上書きして戻す
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
            marginTop: 10, fontSize: 12.5, lineHeight: 1.6, padding: "9px 12px", borderRadius: 9,
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

function MiniTab({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
        borderRadius: 9, padding: "9px 10px", fontSize: 13, fontWeight: 600, fontFamily: fontStack, cursor: "pointer",
        border: `1px solid ${active ? C.amber : C.line}`,
        background: active ? C.amberSoft : C.surface, color: active ? C.amber : C.sub,
      }}
    >
      {icon} {children}
    </button>
  );
}

/* ───────── 共通パーツ ───────── */
function Modal({ title, children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(30,36,40,0.42)", display: "flex",
        alignItems: "flex-end", justifyContent: "center", zIndex: 50, padding: 12, overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: 16, width: "100%", maxWidth: 460, padding: 18, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: C.sub }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.sub, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 10, padding: "9px 14px",
        fontSize: 14, fontWeight: 600, fontFamily: fontStack, cursor: "pointer",
        border: `1px solid ${active ? C.teal : C.line}`,
        background: active ? C.teal : C.surface, color: active ? "#fff" : C.sub,
      }}
    >
      {icon} {children}
    </button>
  );
}

function Count({ n, active }) {
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 20, padding: "1px 7px", marginLeft: 2, background: active ? "rgba(255,255,255,0.22)" : C.line, color: active ? "#fff" : C.sub }}>
      {n}
    </span>
  );
}

const iconBtn = { background: "none", border: "none", cursor: "pointer", color: C.faint, padding: 4 };

const miniBtn = {
  display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${C.line}`,
  borderRadius: 8, padding: "5px 9px", fontSize: 11.5, fontWeight: 600,
  fontFamily: fontStack, color: C.sub, cursor: "pointer", flexShrink: 0,
};

const ghostBtn = {
  display: "inline-flex", alignItems: "center", gap: 4, background: "none",
  color: C.sub, border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px",
  fontSize: 13, fontWeight: 500, fontFamily: fontStack, cursor: "pointer",
};

const printBtn = {
  display: "inline-flex", alignItems: "center", gap: 5, background: C.surface,
  color: C.sub, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 13px",
  fontSize: 13, fontWeight: 600, fontFamily: fontStack, cursor: "pointer", flexShrink: 0,
};

const backupBar = {
  width: "100%", display: "flex", alignItems: "center", gap: 10,
  background: C.surface, border: `1px solid ${C.amberSoft}`, borderRadius: 12,
  padding: "12px 14px", fontFamily: fontStack, cursor: "pointer", color: C.ink,
};

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
  border: `1px solid ${C.line}`, background: "#FBFCFA", fontSize: 14, fontFamily: fontStack,
  color: C.ink, outline: "none",
};

const primaryBtn = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  background: C.teal, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px",
  fontSize: 14, fontWeight: 600, fontFamily: fontStack, cursor: "pointer",
};
