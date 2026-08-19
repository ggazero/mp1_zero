# ADMIN 공통 필드 매핑

`draft_100` CSV 원본은 수정하지 않는다. ADMIN에서 파일을 읽을 때만 아래 공통 필드로 변환한다.

| ADMIN 공통 필드 | 국가기술자격 | 전문자격 | 두두보건 |
|---|---|---|---|
| `source` | 국가기술자격(고정) | 전문자격(고정) | 두두보건(고정) |
| `receipt_number` | 접수번호 | receipt_no | examNumber |
| `applicant_name` | 성명 | applicant_name | fullName |
| `birth_date` | 생년월일 | date_of_birth | birthday |
| `gender` | 성별 | sex | genderCode |
| `phone` | 연락처 | contact_number | mobile |
| `qualification` | 자격종목 | qualification | certType |
| `exam_region` | 시험지역 | exam_region | 값 없음 |
| `exam_center` | 시험장 | exam_center | centerName |
| `exam_date` | 시험일자 | test_date | examDate |
| `final_fee` | 최종결제금액 | final_amount | finalFee |
| `payment_method` | 결제수단 | pay_type | payment |
| `payment_status` | 결제상태 | pay_status | payResult |
| `application_status` | 접수상태 | app_status | regStatus |
| `applied_at` | 접수일시 | registered_at | appliedAt |
| `usage_context` | 사용맥락 | usage_context | usageContext |

## 표시값 변환 규칙

- 날짜: `YYYY-MM-DD`, `YYYY/MM/DD`, `DD-MM-YYYY`를 ADMIN에서 `YYYY-MM-DD`로 표시한다.
- 연락처: 숫자 11자리 `010xxxxxxxx`만 `010-xxxx-xxxx`로 표시한다.
- 결제수단: `CARD`/`card` → 신용카드, `BANK_TRANSFER`/`transfer` → 계좌이체, `VIRTUAL_ACCOUNT`/`virtual` → 가상계좌.
- 결제상태: `PAID`/`success` → 완료, `REFUNDED` → 환불, `PENDING`/`pending` → 대기.
- 접수상태: `CONFIRMED`/`active` → 접수완료, `CANCELLED` → 취소.
- 전문자격 성별 `M`/`F`는 필드 명세의 근거에 따라 남/여로 표시한다.

## 근거 부족으로 변환하지 않는 값

- 두두보건 `genderCode`의 `1`/`2`: 의미가 명시되지 않아 원본 값을 유지한다.
- 전문자격 `app_status=PENDING`, 두두보건 `regStatus=pending`: 어느 대기 단계인지 명확하지 않아 `확인 필요 (원본값)`으로 표시한다.
- 두두보건에는 별도 시험지역 필드가 없으므로 센터명에서 지역을 추측하지 않고 비워 둔다.
