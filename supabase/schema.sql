-- ユナイテッドファーマシー 配布物管理アプリ - データベース定義
-- Supabaseの「SQL Editor」に、この内容を全部貼り付けて「Run」を押してください。
-- 何度実行しても安全なように作ってあります（すでにある場合はスキップされます）。

create extension if not exists pgcrypto;

-- メンバー（店舗・担当者）
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  store text not null,
  person text not null default '',
  created_at timestamptz not null default now()
);

-- 同じ「店舗＋担当者」の組を二重登録しないための制約（初期データ投入をやり直しても安全にする）
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'members_store_person_key'
  ) then
    alter table members add constraint members_store_person_key unique (store, person);
  end if;
end $$;

-- 案件
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  member_id uuid references members(id) on delete set null,
  content text not null default '',
  due date,
  meeting boolean not null default false,
  jimu boolean not null default false,
  by_store boolean not null default false,
  done boolean not null default false,
  stores_done jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

create index if not exists tasks_member_id_idx on tasks(member_id);

-- 案件への添付ファイル（実体はSupabase Storageに置き、ここには情報だけを持つ）
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  size_bytes bigint not null default 0,
  uploaded_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists attachments_task_id_idx on attachments(task_id);

-- Row Level Security
-- このアプリはURLを知っている人であれば誰でも読み書きできる構成です。
-- Supabase側はシンプルな構成にするため、読み書きは許可する設定にしています。
alter table members enable row level security;
alter table tasks enable row level security;
alter table attachments enable row level security;

drop policy if exists "members_all" on members;
create policy "members_all" on members for all using (true) with check (true);

drop policy if exists "tasks_all" on tasks;
create policy "tasks_all" on tasks for all using (true) with check (true);

drop policy if exists "attachments_all" on attachments;
create policy "attachments_all" on attachments for all using (true) with check (true);

-- 複数端末での即時反映（Realtime）を有効化
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'members'
  ) then
    alter publication supabase_realtime add table members;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table tasks;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attachments'
  ) then
    alter publication supabase_realtime add table attachments;
  end if;
end $$;

-- 添付ファイルの保存先（Storageバケット）を用意する
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', true)
on conflict (id) do nothing;

drop policy if exists "task_attachments_read" on storage.objects;
create policy "task_attachments_read" on storage.objects for select
  using (bucket_id = 'task-attachments');

drop policy if exists "task_attachments_insert" on storage.objects;
create policy "task_attachments_insert" on storage.objects for insert
  with check (bucket_id = 'task-attachments');

drop policy if exists "task_attachments_delete" on storage.objects;
create policy "task_attachments_delete" on storage.objects for delete
  using (bucket_id = 'task-attachments');

-- 初期データ（29組）。すでに同じ店舗＋担当者があれば追加しません。
insert into members (store, person) values
  ('【本部】', '助田'),
  ('ひかり調剤（鵜方）', '谷口（医療事務）'),
  ('ひかり調剤（鵜方）', '廣岡（医療事務）'),
  ('ひかり調剤（鵜方）', '谷村（医療事務）'),
  ('ひかり調剤（鵜方）', '真鍋（薬剤師）'),
  ('ひかり調剤（鵜方）', '山崎（医療事務）'),
  ('ひかり調剤（鵜方）', '浜口（パート医療事務）'),
  ('【全店舗】', '全体会議　通知'),
  ('【全体（医療事務ミーティング）】', '通知'),
  ('ひかりハート薬局（岡本）', '田原（薬剤師）'),
  ('ひかりハート薬局（岡本）', '三橋（医療事務）'),
  ('ひかりハート薬局（岡本）', '佐野（薬剤師）'),
  ('ひかりハート薬局（岡本）', '森田（パート医療事務）'),
  ('【本部・ひかり調剤（鵜方）】', '加藤（代表）'),
  ('ひかりファーマシー（神久）', '高橋（医療事務）'),
  ('ひかりファーマシー（神久）', '櫻井（薬剤師）'),
  ('ひかりファーマシー（神久）', '池田（医療事務）'),
  ('ひかりファーマシー（神久）', '江藤（パート医療事務）'),
  ('ひかりファーマシー（神久）', '新川（薬剤師）'),
  ('ひかり薬局（射和）', '水田（薬剤師）'),
  ('ひかり薬局（射和）', '浅利（薬剤師）'),
  ('ひかり薬局（射和）', '北村（医療事務）'),
  ('ひかり薬局（射和）', '山本（医療事務）'),
  ('ひかり薬局（射和）', 'うらら（パート医療事務）'),
  ('ひかり薬局（射和）', '若山（パート医療事務）'),
  ('【ひかり薬局（射和）】', ''),
  ('【ひかりハート薬局（岡本）】', ''),
  ('【ひかり調剤（鵜方）】', ''),
  ('【ひかりファーマシー（神久）】', '')
on conflict (store, person) do nothing;
