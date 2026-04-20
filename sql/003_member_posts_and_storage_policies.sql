-- 자료실/게시판 조회 복구 + 일반회원 첨부 업로드/글쓰기 허용
-- 실행 순서: Supabase SQL Editor에 그대로 붙여넣고 Run

-- 0) site-assets 버킷이 없으면 생성
insert into storage.buckets (id, name, public, file_size_limit)
select 'site-assets', 'site-assets', true, 31457280
where not exists (
  select 1 from storage.buckets where id = 'site-assets'
);

-- 1) 버킷 공개 + 30MB 제한 보정
update storage.buckets
set public = true,
    file_size_limit = 31457280
where id = 'site-assets';

-- 2) posts 읽기/쓰기 정책
alter table public.posts enable row level security;

drop policy if exists "Anyone can read posts" on public.posts;
create policy "Anyone can read posts"
on public.posts
for select
to anon, authenticated
using (true);

drop policy if exists "Members can insert posts" on public.posts;
create policy "Members can insert posts"
on public.posts
for insert
to authenticated
with check (true);

drop policy if exists "Members can update posts" on public.posts;
create policy "Members can update posts"
on public.posts
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Members can delete posts" on public.posts;
create policy "Members can delete posts"
on public.posts
for delete
to authenticated
using (true);

-- 3) storage.objects 읽기/쓰기 정책
alter table storage.objects enable row level security;

drop policy if exists "Public can read site-assets" on storage.objects;
create policy "Public can read site-assets"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'site-assets');

drop policy if exists "Authenticated can upload site-assets" on storage.objects;
create policy "Authenticated can upload site-assets"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'site-assets');

drop policy if exists "Authenticated can update site-assets" on storage.objects;
create policy "Authenticated can update site-assets"
on storage.objects
for update
to authenticated
using (bucket_id = 'site-assets')
with check (bucket_id = 'site-assets');

drop policy if exists "Authenticated can delete site-assets" on storage.objects;
create policy "Authenticated can delete site-assets"
on storage.objects
for delete
to authenticated
using (bucket_id = 'site-assets');
