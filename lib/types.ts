export type Member = {
  id: string;
  store: string;
  person: string;
  created_at: string;
};

export type StoresDone = Record<string, boolean>;

export type Task = {
  id: string;
  title: string;
  member_id: string | null;
  content: string;
  due: string | null; // YYYY-MM-DD
  meeting: boolean;
  jimu: boolean;
  by_store: boolean;
  done: boolean;
  stores_done: StoresDone;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export type NewMemberInput = {
  store: string;
  person: string;
};

export type NewTaskInput = {
  title: string;
  member_id: string;
  content: string;
  due: string;
  meeting: boolean;
  jimu: boolean;
  by_store: boolean;
};

export type VoiceDraft = {
  title: string;
  member_id: string;
  content: string;
  due: string;
  meeting: boolean;
  jimu: boolean;
  by_store: boolean;
  rawText: string;
};

export type SaveState = "idle" | "saving" | "done" | "error";

export type FlagKey = "meeting" | "jimu";

export type TaskSortKey = "due" | "store" | "person" | "new";
export type MemberSortKey = "added" | "store" | "person" | "count";
