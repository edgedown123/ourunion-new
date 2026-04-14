-- 일반 조합원도 자료실/자유게시판 게시 및 첨부 업로드가 가능하도록 하는 정책 예시
-- Supabase SQL Editor에서 실행하세요.

-- 1) posts 테이블: 조회는 모두 허용, 작성/수정/삭제는 로그인 사용자 허용
alter table public.posts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts: public read'
  ) then
    create policy "posts: public read"
    on public.posts
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts: authenticated insert'
  ) then
    create policy "posts: authenticated insert"
    on public.posts
    for insert
    to authenticated
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts: authenticated update'
  ) then
    create policy "posts: authenticated update"
    on public.posts
    for update
    to authenticated
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts: authenticated delete'
  ) then
    create policy "posts: authenticated delete"
    on public.posts
    for delete
    to authenticated
    using (true);
  end if;
end $$;

-- 2) site-assets 버킷이 없다면 생성
insert into storage.buckets (id, name, public, file_size_limit)
values ('site-assets', 'site-assets', true, 31457280)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

-- 3) storage.objects: site-assets 버킷의 파일은 로그인 사용자가 업로드/수정/삭제 가능
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'site-assets: public read'
  ) then
    create policy "site-assets: public read"
    on storage.objects
    for select
    to anon, authenticated
    using (bucket_id = 'site-assets');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'site-assets: authenticated insert'
  ) then
    create policy "site-assets: authenticated insert"
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'site-assets');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'site-assets: authenticated update'
  ) then
    create policy "site-assets: authenticated update"
    on storage.objects
    for update
    to authenticated
    using (bucket_id = 'site-assets')
    with check (bucket_id = 'site-assets');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'site-assets: authenticated delete'
  ) then
    create policy "site-assets: authenticated delete"
    on storage.objects
    for delete
    to authenticated
    using (bucket_id = 'site-assets');
  end if;
end $$;
