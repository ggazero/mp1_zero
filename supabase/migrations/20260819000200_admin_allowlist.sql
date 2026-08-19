create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admins can read applications" on public.applications;
create policy "admins can read applications" on public.applications
  for select to authenticated using (public.is_admin());

drop policy if exists "admins can update applications" on public.applications;
create policy "admins can update applications" on public.applications
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins can insert faqs" on public.faq_entries;
create policy "admins can insert faqs" on public.faq_entries
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admins can update faqs" on public.faq_entries;
create policy "admins can update faqs" on public.faq_entries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins can read questions" on public.question_logs;
create policy "admins can read questions" on public.question_logs
  for select to authenticated using (public.is_admin());
