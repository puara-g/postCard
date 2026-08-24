# 사주엽서

태어난 날짜와 시각으로 사주를 계산해 우편엽서 스타일로 보여주는 정적 웹페이지입니다.

## 구성
- `index.html` — 마크업.
- `styles.css` — 전체 스타일.
- `script.js` — 사주 계산 로직(만세력 절기 기반), 결과 카드 렌더링, 오늘의 운세, 궁합 보기, 궁합 방명록 기능.
- `supabase-config.js` — 궁합 방명록 저장소(Supabase) 접속 정보.
- 별도 빌드 도구 없이 정적 파일 그대로 아무 웹 서버(또는 `index.html`을 직접 열어서)로 확인할 수 있습니다.

## 궁합 방명록 저장소(Supabase) 설정
"궁합 보기"에서 공유 링크로 들어온 사람이 결과를 남기면, 링크 주인을 포함해 그 링크를 아는 누구나 볼 수 있는 공개 기록(궁합 방명록)이 됩니다. 이 기능은 [Supabase](https://supabase.com) 무료 프로젝트에 저장되는 방식입니다.

1. Supabase에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 아래 스키마를 실행해 테이블과 접근 정책을 만듭니다.

   ```sql
   create table compat_entries (
     id bigint generated always as identity primary key,
     for_name text,
     name_a text not null,
     name_b text not null,
     pillar_a text not null,
     pillar_b text not null,
     stamp_a text not null,
     stamp_b text not null,
     score integer,
     rel_text text not null,
     elem_text text not null,
     closing text not null,
     submitted_at text not null,
     created_at timestamptz not null default now()
   );

   alter table compat_entries enable row level security;

   create policy "누구나 읽기" on compat_entries
     for select using (true);

   create policy "누구나 남기기" on compat_entries
     for insert with check (true);
   ```

   이미 이 테이블을 만든 적이 있다면(예: `score` 컬럼 추가 전에 만든 프로젝트), 아래 한 줄만 추가로 실행하면 됩니다.

   ```sql
   alter table compat_entries add column if not exists score integer;
   ```

3. Project Settings → API에서 **Project URL**과 **anon public key**를 복사해 `supabase-config.js`에 넣습니다.

   ```js
   const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```

   `anon public` 키는 브라우저에 노출돼도 되도록 설계된 키라 그대로 커밋해도 안전합니다. 실제 접근 범위는 위 RLS 정책이 결정합니다(현재는 누구나 읽고 쓸 수 있는 공개 방명록 정책).

`supabase-config.js`를 설정하지 않으면 사주 계산·궁합 보기 등 나머지 기능은 그대로 동작하고, 방명록에 남기는 기능만 비활성 안내가 뜹니다.

## 배포
정적 파일 3~4개(`index.html`, `styles.css`, `script.js`, `supabase-config.js`)를 그대로 올릴 수 있는 아무 정적 호스팅(GitHub Pages, Netlify, Vercel, Cloudflare Pages 등)에 배포하면 됩니다. 서버 코드가 필요 없습니다.
