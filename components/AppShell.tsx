"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Printer, Users } from "lucide-react";
import { C, FLAGS, ME_KEY, fontStack } from "@/lib/constants";
import type { FlagKey, Member, MemberSortKey, NewMemberInput, NewTaskInput, TaskSortKey } from "@/lib/types";
import { arrangeTasks, doPrint, hasPerson, isDone } from "@/lib/utils";
import { useAppData } from "@/hooks/useAppData";
import { supabaseConfigured } from "@/lib/supabase";
import Header from "@/components/Header";
import ConnectionBar from "@/components/ConnectionBar";
import NamePicker from "@/components/NamePicker";
import { FlagBar, FlagListView } from "@/components/FlagViews";
import { Count, TabBtn, printBtn } from "@/components/ui";
import { TasksView } from "@/components/TasksView";
import { MembersView } from "@/components/MembersView";
import { BackupModal } from "@/components/BackupModal";
import { PrintFlagList, PrintMembers, PrintStyles, PrintTasks } from "@/components/PrintViews";
import { ToastStack, type ToastItem } from "@/components/Toast";
import type { RetryResult } from "@/lib/retry";

type View = "tasks" | "members" | "meeting" | "jimu";

export default function AppShell() {
  const [me, setMe] = useState<string | null>(null);
  const [meReady, setMeReady] = useState(false);

  useEffect(() => {
    // ローカルストレージはサーバー側で読めないため、サーバーとクライアントの表示を一致させてから
    // マウント後にだけ復元する（意図的にeffect内でsetStateしている）。
    try {
      const saved = window.localStorage.getItem(ME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMe(saved);
    } catch {
      setMe(null);
    }
    setMeReady(true);
  }, []);

  const pickMe = (name: string) => {
    setMe(name);
    try {
      window.localStorage.setItem(ME_KEY, name);
    } catch {
      /* noop */
    }
  };

  if (!meReady) return null;
  if (!me) {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: fontStack, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 380, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>あなたのお名前を選んでください</div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 14, lineHeight: 1.6 }}>この端末に記憶され、次回から自動で復帰します。</div>
          <NamePicker current="" onPick={pickMe} />
        </div>
      </div>
    );
  }

  return <MainApp me={me} />;
}

function MainApp({ me }: { me: string }) {
  const data = useAppData(me);
  const [view, setView] = useState<View>("tasks");
  const [showDone, setShowDone] = useState(false);
  const [q, setQ] = useState("");
  const [taskSort, setTaskSort] = useState<TaskSortKey>("due");
  const [memberSort, setMemberSort] = useState<MemberSortKey>("added");
  const [flagSort, setFlagSort] = useState<Record<FlagKey, TaskSortKey>>({ meeting: "store", jimu: "store" });
  const [backupOpen, setBackupOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const notify = (result: RetryResult, okText?: string) => {
    const id = ++toastId.current;
    if (result.ok) {
      if (okText) {
        setToasts((t) => [...t, { id, kind: "ok", text: okText }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
      }
    } else {
      setToasts((t) => [...t, { id, kind: "error", text: result.message }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    }
  };

  const memberById = useMemo(() => {
    const m: Record<string, Member | undefined> = {};
    data.members.forEach((x) => (m[x.id] = x));
    return m;
  }, [data.members]);

  const activeCountByMember = useMemo(() => {
    const c: Record<string, number> = {};
    data.tasks.forEach((t) => {
      if (!isDone(t) && t.member_id) c[t.member_id] = (c[t.member_id] || 0) + 1;
    });
    return c;
  }, [data.tasks]);

  const sortedMembers = useMemo(() => {
    const arr = [...data.members];
    if (memberSort === "store") arr.sort((a, b) => a.store.localeCompare(b.store, "ja"));
    else if (memberSort === "person")
      arr.sort((a, b) => {
        const ap = hasPerson(a);
        const bp = hasPerson(b);
        if (!ap && !bp) return a.store.localeCompare(b.store, "ja");
        if (!ap) return 1;
        if (!bp) return -1;
        return a.person.localeCompare(b.person, "ja");
      });
    else if (memberSort === "count") arr.sort((a, b) => (activeCountByMember[b.id] || 0) - (activeCountByMember[a.id] || 0));
    return arr;
  }, [data.members, memberSort, activeCountByMember]);

  const activeTasks = useMemo(() => data.tasks.filter((t) => !isDone(t)), [data.tasks]);
  const doneTasks = useMemo(() => data.tasks.filter(isDone), [data.tasks]);
  const meetingTasks = useMemo(() => data.tasks.filter((t) => t.meeting), [data.tasks]);
  const jimuTasks = useMemo(() => data.tasks.filter((t) => t.jimu), [data.tasks]);

  const filteredActive = useMemo(
    () =>
      activeTasks.filter((t) => {
        if (!q.trim()) return true;
        const m = t.member_id ? memberById[t.member_id] : undefined;
        const hay = `${m ? m.store + (m.person || "") : ""}${t.title || ""}${t.content || ""}`;
        return hay.includes(q.trim());
      }),
    [activeTasks, q, memberById]
  );

  const taskGroups = useMemo(() => arrangeTasks(filteredActive, taskSort, memberById), [filteredActive, taskSort, memberById]);
  const flagTasks = useMemo(() => (view === "meeting" ? meetingTasks : view === "jimu" ? jimuTasks : []), [view, meetingTasks, jimuTasks]);
  const flagGroups = useMemo(() => (view === "meeting" || view === "jimu" ? arrangeTasks(flagTasks, flagSort[view], memberById) : []), [view, flagTasks, flagSort, memberById]);

  const addMember = async (input: NewMemberInput) => notify(await data.addMember(input), "メンバーを追加しました");
  const updateMember = async (id: string, store: string, person: string) => notify(await data.updateMember(id, store, person), "修正を保存しました");
  const removeMember = async (id: string) => notify(await data.removeMember(id), "削除しました");
  const restoreDefaults = async () => notify(await data.restoreDefaults(), "呼び戻しました");

  const addTask = async (input: NewTaskInput) => {
    const r = await data.addTask(input);
    notify(r, "案件を追加しました");
    return r.ok ? r.id ?? null : null;
  };
  const uploadAttachment = async (taskId: string, file: File) => {
    const r = await data.addAttachment(taskId, file);
    notify(r, "添付ファイルを追加しました");
    return r;
  };
  const removeAttachment = async (id: string) => notify(await data.removeAttachment(id), "添付ファイルを削除しました");
  const updateTask = async (id: string, input: NewTaskInput) => notify(await data.updateTask(id, input), "修正を保存しました");
  const setDone = async (id: string, v: boolean) => notify(await data.setDone(id, v), v ? "済にしました" : "未処理に戻しました");
  const toggleStore = async (id: string, store: string) => notify(await data.toggleStoreDone(id, store));
  const allStores = async (id: string, v: boolean) => notify(await data.allStoresDone(id, v), v ? "全店舗 済にしました" : "すべて外しました");
  const removeTask = async (id: string) => notify(await data.removeTask(id), "削除しました");
  const toggleFlag = async (id: string, key: FlagKey) => notify(await data.toggleFlag(id, key));
  const clearFlag = async (key: FlagKey) => notify(await data.clearFlag(key), "一括解除しました");

  const flagDef = view === "meeting" || view === "jimu" ? FLAGS[view] : null;
  const taskSortLabel = { due: "期日順", store: "店舗別", person: "人別", new: "新しい順" }[taskSort];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: fontStack, color: C.ink }}>
      <PrintStyles />

      <div className="screen-area" style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 96px" }}>
        {flagDef ? (
          <FlagListView
            def={flagDef}
            tasks={flagTasks}
            groups={flagGroups}
            sortBy={flagSort[view as FlagKey]}
            setSortBy={(v) => setFlagSort((s) => ({ ...s, [view]: v }))}
            memberById={memberById}
            onBack={() => setView("tasks")}
            onToggle={(id) => toggleFlag(id, view as FlagKey)}
            onClearAll={() => clearFlag(view as FlagKey)}
          />
        ) : (
          <>
            <Header />
            {!supabaseConfigured && (
              <div style={{ background: C.stampSoft, color: C.stamp, border: `1px solid ${C.stamp}`, borderRadius: 11, padding: "10px 13px", fontSize: 12.5, lineHeight: 1.6, marginBottom: 12 }}>
                データベースが未設定です（管理者向け: 環境変数 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください）。この状態では保存できません。
              </div>
            )}
            <ConnectionBar me={me} connection={data.connection} />
            <FlagBar def={FLAGS.meeting} count={meetingTasks.length} onOpen={() => setView("meeting")} />
            <FlagBar def={FLAGS.jimu} count={jimuTasks.length} onOpen={() => setView("jimu")} />

            <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
              <TabBtn active={view === "tasks"} onClick={() => setView("tasks")} icon={<ClipboardList size={16} />}>
                案件 <Count n={activeTasks.length} active={view === "tasks"} />
              </TabBtn>
              <TabBtn active={view === "members"} onClick={() => setView("members")} icon={<Users size={16} />}>
                メンバー <Count n={data.members.length} active={view === "members"} />
              </TabBtn>
              {((view === "tasks" && filteredActive.length > 0) || (view === "members" && data.members.length > 0)) && (
                <button onClick={doPrint} style={{ ...printBtn, marginLeft: "auto" }} title="この一覧を印刷">
                  <Printer size={15} /> 印刷
                </button>
              )}
            </div>

            {!data.loaded ? (
              <div style={{ color: C.faint, padding: "40px 0", textAlign: "center" }}>読み込み中…</div>
            ) : view === "tasks" ? (
              <TasksView
                members={data.members}
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
                attachments={data.attachments}
                getAttachmentUrl={data.attachmentUrl}
                onUploadAttachment={uploadAttachment}
                onRemoveAttachment={removeAttachment}
              />
            ) : (
              <MembersView
                members={sortedMembers}
                totalMembers={data.members.length}
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

      <div className="print-area">
        {flagDef ? (
          <PrintFlagList full={flagDef.full} groups={flagGroups} sortBy={flagSort[view as FlagKey]} memberById={memberById} total={flagTasks.length} />
        ) : view === "members" ? (
          <PrintMembers members={sortedMembers} countByMember={activeCountByMember} sortBy={memberSort} />
        ) : (
          <PrintTasks groups={taskGroups} memberById={memberById} total={filteredActive.length} sortLabel={taskSortLabel} />
        )}
      </div>

      {backupOpen && (
        <BackupModal
          members={data.members}
          tasks={data.tasks}
          onClose={() => setBackupOpen(false)}
          onRestore={async (d) => {
            const result = await data.restoreFromBackup(d);
            notify(result, "控えから戻しました");
            return result;
          }}
        />
      )}

      <ToastStack items={toasts} />
    </div>
  );
}
