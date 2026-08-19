-- 실습용 관리자 화면은 브라우저 비밀번호(0000)를 사용합니다.
-- 실제 서비스에서는 이 정책 대신 Supabase Auth와 관리자 allowlist를 사용해야 합니다.

drop policy if exists "admins can read applications" on public.applications;
drop policy if exists "admins can update applications" on public.applications;
drop policy if exists "demo can read applications" on public.applications;
drop policy if exists "demo can update applications" on public.applications;
create policy "demo can read applications" on public.applications
  for select to anon, authenticated using (true);
create policy "demo can update applications" on public.applications
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "admins can insert faqs" on public.faq_entries;
drop policy if exists "admins can update faqs" on public.faq_entries;
drop policy if exists "demo can insert faqs" on public.faq_entries;
drop policy if exists "demo can update faqs" on public.faq_entries;
create policy "demo can insert faqs" on public.faq_entries
  for insert to anon, authenticated with check (true);
create policy "demo can update faqs" on public.faq_entries
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "admins can read questions" on public.question_logs;
drop policy if exists "admins can update questions" on public.question_logs;
drop policy if exists "demo can read questions" on public.question_logs;
drop policy if exists "demo can update questions" on public.question_logs;
create policy "demo can read questions" on public.question_logs
  for select to anon, authenticated using (true);
create policy "demo can update questions" on public.question_logs
  for update to anon, authenticated using (true) with check (true);
