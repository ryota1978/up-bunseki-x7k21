"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { DEFAULT_MEMBERS, STORES } from "@/lib/constants";
import { emptyStoresDone } from "@/lib/utils";
import { withRetry, type RetryResult } from "@/lib/retry";
import type { Attachment, Member, NewMemberInput, NewTaskInput, StoresDone, Task } from "@/lib/types";

const ATTACHMENTS_BUCKET = "task-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

function upsertById<T extends { id: string }>(list: T[], row: T): T[] {
  const idx = list.findIndex((x) => x.id === row.id);
  if (idx === -1) return [row, ...list];
  const next = [...list];
  next[idx] = row;
  return next;
}

export function useAppData(me: string) {
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "online" | "offline">("connecting");
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  const loadAll = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoaded(true);
      setConnection("offline");
      return;
    }
    const [{ data: m, error: me1 }, { data: t, error: te1 }, { data: a, error: ae1 }] = await Promise.all([
      supabase.from("members").select("*").order("created_at", { ascending: true }),
      supabase.from("tasks").select("*").order("created_at", { ascending: true }),
      supabase.from("attachments").select("*").order("created_at", { ascending: true }),
    ]);
    if (!me1 && m) setMembers(m as Member[]);
    if (!te1 && t) setTasks(t as Task[]);
    if (!ae1 && a) setAttachments(a as Attachment[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // 初回マウント時にサーバーから読み込む（読み込み結果をstateに反映する意図的な副作用）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const channel = supabase
      .channel("public:up-bunseki")
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setMembers((prev) => prev.filter((x) => x.id !== (payload.old as Member).id));
        } else {
          setMembers((prev) => upsertById(prev, payload.new as Member));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setTasks((prev) => prev.filter((x) => x.id !== (payload.old as Task).id));
        } else {
          setTasks((prev) => upsertById(prev, payload.new as Task));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "attachments" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setAttachments((prev) => prev.filter((x) => x.id !== (payload.old as Attachment).id));
        } else {
          setAttachments((prev) => upsertById(prev, payload.new as Attachment));
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnection("online");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection("offline");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ── メンバー操作 ── */
  const addMember = useCallback(async (input: NewMemberInput): Promise<RetryResult> => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from("members")
        .insert({ store: input.store.trim(), person: input.person.trim() })
        .select()
        .single();
      if (error) throw new Error(error.message);
      setMembers((prev) => upsertById(prev, data as Member));
    });
  }, []);

  const updateMember = useCallback(async (id: string, store: string, person: string): Promise<RetryResult> => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from("members")
        .update({ store: store.trim(), person: person.trim() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      setMembers((prev) => upsertById(prev, data as Member));
    });
  }, []);

  const removeMember = useCallback(async (id: string): Promise<RetryResult> => {
    return withRetry(async () => {
      const { error } = await supabase.from("members").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    });
  }, []);

  const restoreDefaults = useCallback(async (): Promise<RetryResult> => {
    return withRetry(async () => {
      const have = new Set(members.map((m) => `${m.store}|${m.person || ""}`));
      const add = DEFAULT_MEMBERS.filter((m) => !have.has(`${m.store}|${m.person || ""}`));
      if (add.length === 0) return;
      const { data, error } = await supabase.from("members").insert(add).select();
      if (error) throw new Error(error.message);
      setMembers((prev) => {
        let next = prev;
        (data as Member[]).forEach((row) => {
          next = upsertById(next, row);
        });
        return next;
      });
    });
  }, [members]);

  /* ── 案件操作 ── */
  const addTask = useCallback(async (input: NewTaskInput): Promise<RetryResult & { id?: string }> => {
    let newId: string | undefined;
    const result = await withRetry(async () => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: input.title.trim(),
          member_id: input.member_id,
          content: input.content.trim(),
          due: input.due || null,
          meeting: !!input.meeting,
          jimu: !!input.jimu,
          by_store: !!input.by_store,
          done: false,
          stores_done: emptyStoresDone(),
          created_by: meRef.current,
          updated_by: meRef.current,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      newId = (data as Task).id;
      setTasks((prev) => upsertById(prev, data as Task));
    });
    return { ...result, id: newId };
  }, []);

  const updateTask = useCallback(async (id: string, patch: Partial<NewTaskInput>): Promise<RetryResult> => {
    return withRetry(async () => {
      const payload: Record<string, unknown> = { updated_by: meRef.current, updated_at: new Date().toISOString() };
      if (patch.title !== undefined) payload.title = patch.title.trim();
      if (patch.member_id !== undefined) payload.member_id = patch.member_id;
      if (patch.content !== undefined) payload.content = patch.content.trim();
      if (patch.due !== undefined) payload.due = patch.due || null;
      if (patch.meeting !== undefined) payload.meeting = patch.meeting;
      if (patch.jimu !== undefined) payload.jimu = patch.jimu;
      if (patch.by_store !== undefined) payload.by_store = patch.by_store;
      const { data, error } = await supabase.from("tasks").update(payload).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      setTasks((prev) => upsertById(prev, data as Task));
    });
  }, []);

  const toggleFlag = useCallback(async (id: string, key: "meeting" | "jimu"): Promise<RetryResult> => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return { ok: false, message: "対象の案件が見つかりませんでした。" };
    return withRetry(async () => {
      const { data, error } = await supabase
        .from("tasks")
        .update({ [key]: !current[key], updated_by: meRef.current, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      setTasks((prev) => upsertById(prev, data as Task));
    });
  }, [tasks]);

  const clearFlag = useCallback(async (key: "meeting" | "jimu"): Promise<RetryResult> => {
    const ids = tasks.filter((t) => t[key]).map((t) => t.id);
    if (ids.length === 0) return { ok: true };
    return withRetry(async () => {
      const { data, error } = await supabase
        .from("tasks")
        .update({ [key]: false, updated_by: meRef.current, updated_at: new Date().toISOString() })
        .in("id", ids)
        .select();
      if (error) throw new Error(error.message);
      setTasks((prev) => {
        let next = prev;
        (data as Task[]).forEach((row) => {
          next = upsertById(next, row);
        });
        return next;
      });
    });
  }, [tasks]);

  const setDone = useCallback(async (id: string, v: boolean): Promise<RetryResult> => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from("tasks")
        .update({ done: v, updated_by: meRef.current, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      setTasks((prev) => upsertById(prev, data as Task));
    });
  }, []);

  const toggleStoreDone = useCallback(async (id: string, store: string): Promise<RetryResult> => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return { ok: false, message: "対象の案件が見つかりませんでした。" };
    return withRetry(async () => {
      const next: StoresDone = { ...current.stores_done, [store]: !current.stores_done?.[store] };
      const { data, error } = await supabase
        .from("tasks")
        .update({ stores_done: next, updated_by: meRef.current, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      setTasks((prev) => upsertById(prev, data as Task));
    });
  }, [tasks]);

  const allStoresDone = useCallback(async (id: string, v: boolean): Promise<RetryResult> => {
    return withRetry(async () => {
      const next: StoresDone = STORES.reduce((o, s) => ({ ...o, [s]: v }), {} as StoresDone);
      const { data, error } = await supabase
        .from("tasks")
        .update({ stores_done: next, updated_by: meRef.current, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      setTasks((prev) => upsertById(prev, data as Task));
    });
  }, []);

  const removeTask = useCallback(
    async (id: string): Promise<RetryResult> => {
      return withRetry(async () => {
        const paths = attachments.filter((a) => a.task_id === id).map((a) => a.storage_path);
        if (paths.length > 0) {
          await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);
        }
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) throw new Error(error.message);
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setAttachments((prev) => prev.filter((a) => a.task_id !== id));
      });
    },
    [attachments]
  );

  /* ── 添付ファイル ── */
  const addAttachment = useCallback(async (taskId: string, file: File): Promise<RetryResult> => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return { ok: false, message: "ファイルが大きすぎます（10MBまで）。別のファイルをお試しください。" };
    }
    return withRetry(async () => {
      const safeName = file.name.replace(/[^\w.\-ぁ-んァ-ヶ一-龠々ー]/g, "_");
      const path = `${taskId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data, error } = await supabase
        .from("attachments")
        .insert({
          task_id: taskId,
          file_name: file.name,
          storage_path: path,
          size_bytes: file.size,
          uploaded_by: meRef.current,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      setAttachments((prev) => upsertById(prev, data as Attachment));
    });
  }, []);

  const removeAttachment = useCallback(async (id: string): Promise<RetryResult> => {
    const current = attachments.find((a) => a.id === id);
    if (!current) return { ok: false, message: "対象の添付ファイルが見つかりませんでした。" };
    return withRetry(async () => {
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove([current.storage_path]);
      const { error } = await supabase.from("attachments").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    });
  }, [attachments]);

  const attachmentUrl = useCallback((path: string) => {
    return supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path).data.publicUrl;
  }, []);

  const restoreFromBackup = useCallback(
    async (data: { members: Member[]; tasks: Task[] }): Promise<RetryResult> => {
      return withRetry(async () => {
        const { error: delTasksErr } = await supabase.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (delTasksErr) throw new Error(delTasksErr.message);
        const { error: delMembersErr } = await supabase.from("members").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (delMembersErr) throw new Error(delMembersErr.message);

        const memberRows = data.members.map((m) => ({ store: m.store, person: m.person || "" }));
        const { data: insertedMembers, error: insMemErr } =
          memberRows.length > 0 ? await supabase.from("members").insert(memberRows).select() : { data: [], error: null };
        if (insMemErr) throw new Error(insMemErr.message);

        const idMap = new Map<string, string>();
        (data.members || []).forEach((old, i) => {
          const row = (insertedMembers as Member[])[i];
          if (row) idMap.set(old.id, row.id);
        });

        const taskRows = data.tasks.map((t) => ({
          title: t.title,
          member_id: t.member_id ? idMap.get(t.member_id) || null : null,
          content: t.content || "",
          due: t.due || null,
          meeting: !!t.meeting,
          jimu: !!t.jimu,
          by_store: !!t.by_store,
          done: !!t.done,
          stores_done: t.stores_done || emptyStoresDone(),
          created_by: t.created_by || "",
          updated_by: meRef.current,
        }));
        if (taskRows.length > 0) {
          const { error: insTaskErr } = await supabase.from("tasks").insert(taskRows);
          if (insTaskErr) throw new Error(insTaskErr.message);
        }
        await loadAll();
      });
    },
    [loadAll]
  );

  return {
    members,
    tasks,
    attachments,
    loaded,
    connection,
    addMember,
    updateMember,
    removeMember,
    restoreDefaults,
    addTask,
    updateTask,
    toggleFlag,
    clearFlag,
    setDone,
    toggleStoreDone,
    allStoresDone,
    removeTask,
    restoreFromBackup,
    addAttachment,
    removeAttachment,
    attachmentUrl,
    refetch: loadAll,
  };
}
