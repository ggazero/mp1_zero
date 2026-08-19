-- 질문 후속 답변용 연락처와 관리자 답변 상태를 추가합니다.

alter table public.question_logs add column if not exists contact_method text;
alter table public.question_logs add column if not exists contact_value text;
alter table public.question_logs add column if not exists admin_answer text not null default '';
alter table public.question_logs add column if not exists answer_status text not null default 'unanswered';
alter table public.question_logs add column if not exists answered_at timestamptz;

alter table public.question_logs drop constraint if exists question_logs_contact_method_check;
alter table public.question_logs add constraint question_logs_contact_method_check
  check (contact_method is null or contact_method in ('phone', 'email'));
alter table public.question_logs drop constraint if exists question_logs_answer_status_check;
alter table public.question_logs add constraint question_logs_answer_status_check
  check (answer_status in ('auto_answered', 'unanswered', 'answered'));

update public.question_logs
set answer_status = case when kind = 'answer' then 'auto_answered' else 'unanswered' end
where admin_answer = '';

drop policy if exists "admins can update questions" on public.question_logs;
drop policy if exists "demo can update questions" on public.question_logs;
create policy "demo can update questions" on public.question_logs
  for update to anon, authenticated using (true) with check (true);
