-- 기존 접수 데이터는 그대로 두고, 신규 접수에서 선택할 수 있는 자격증만 8종으로 넓힙니다.
alter table public.applications
  drop constraint if exists applications_certificate_check;

alter table public.applications
  add constraint applications_certificate_check
  check (certificate in (
    '한식조리기능사',
    '지게차운전기능사',
    '굴착기운전기능사',
    '전기기능사',
    '손해평가사',
    '공인중개사',
    '요양보호사',
    '위생사'
  ));
