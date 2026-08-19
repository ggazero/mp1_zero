-- 공개 사용자는 신청/질문 등록과 FAQ 조회만, 로그인한 관리자는 운영 데이터 조회/수정이 가능합니다.

create table if not exists public.applications (
  id text primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 20),
  phone text not null,
  certificate text not null check (certificate in ('한식조리기능사', '요양보호사', '공인중개사')),
  channel text not null default '웹',
  note text not null default '',
  status text not null default '신규' check (status in ('신규', '확인', '완료'))
);

create table if not exists public.faq_entries (
  id text primary key,
  category text not null,
  title text not null,
  keywords jsonb not null default '[]'::jsonb,
  answer text not null,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.question_logs (
  id text primary key,
  created_at timestamptz not null default now(),
  question text not null,
  answer text not null,
  kind text not null check (kind in ('answer', 'unknown', 'restricted', 'empty')),
  contact_method text check (contact_method in ('phone', 'email')),
  contact_value text,
  admin_answer text not null default '',
  answer_status text not null default 'unanswered' check (answer_status in ('auto_answered', 'unanswered', 'answered')),
  answered_at timestamptz
);

alter table public.applications enable row level security;
alter table public.faq_entries enable row level security;
alter table public.question_logs enable row level security;

drop policy if exists "public can submit applications" on public.applications;
create policy "public can submit applications" on public.applications for insert to anon, authenticated with check (true);
drop policy if exists "admins can read applications" on public.applications;
create policy "admins can read applications" on public.applications for select to authenticated using (true);
drop policy if exists "admins can update applications" on public.applications;
create policy "admins can update applications" on public.applications for update to authenticated using (true) with check (true);

drop policy if exists "public can read faqs" on public.faq_entries;
create policy "public can read faqs" on public.faq_entries for select to anon, authenticated using (true);
drop policy if exists "admins can insert faqs" on public.faq_entries;
create policy "admins can insert faqs" on public.faq_entries for insert to authenticated with check (true);
drop policy if exists "admins can update faqs" on public.faq_entries;
create policy "admins can update faqs" on public.faq_entries for update to authenticated using (true) with check (true);

drop policy if exists "public can submit questions" on public.question_logs;
create policy "public can submit questions" on public.question_logs for insert to anon, authenticated with check (true);
drop policy if exists "admins can read questions" on public.question_logs;
create policy "admins can read questions" on public.question_logs for select to authenticated using (true);

create index if not exists applications_created_at_idx on public.applications (created_at desc);
create index if not exists question_logs_created_at_idx on public.question_logs (created_at desc);
