-- 접수번호와 연락처가 모두 맞을 때만 필요한 접수 정보만 반환합니다.
-- 연락처는 반환하지 않고, 이름은 데이터베이스에서 마스킹합니다.
create or replace function public.lookup_application(p_receipt_number text, p_phone text)
returns table (
  id text,
  created_at timestamptz,
  masked_name text,
  certificate text,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    application.id,
    application.created_at,
    case
      when char_length(application.name) <= 1 then '*'
      when char_length(application.name) = 2 then left(application.name, 1) || '*'
      else left(application.name, 1) || '*' || right(application.name, 1)
    end,
    application.certificate,
    application.status
  from public.applications as application
  where application.id = btrim(p_receipt_number)
    and regexp_replace(application.phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
    and btrim(p_receipt_number) <> ''
    and regexp_replace(p_phone, '[^0-9]', '', 'g') <> ''
  limit 1;
$$;

revoke all on function public.lookup_application(text, text) from public;
grant execute on function public.lookup_application(text, text) to anon, authenticated;
