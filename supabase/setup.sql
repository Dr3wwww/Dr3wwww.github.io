-- Portfolio database setup for Supabase.
-- Run this whole file once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It is safe to run again: it creates what is missing and replaces the policies.
--
-- Security model: anyone (the public site, using the anon key) can READ.
-- Only users listed in public.admins can INSERT / UPDATE / DELETE, in tables and in storage.
-- After you create your login (see README step 4), add yourself with the INSERT at the bottom.

-- ------------------------------------------------------------------ admins
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- nobody reads or edits this table through the API; is_admin() reads it with definer rights
drop policy if exists "admins: self read" on public.admins;
create policy "admins: self read" on public.admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ------------------------------------------------------------------ content tables
create table if not exists public.profile (
  id int primary key default 1 check (id = 1),          -- exactly one row
  name text not null default 'Andrew Benedict I. Alcantara',
  tagline text not null default '',
  bio text not null default '',
  photo_url text not null default '',
  photo_path text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.profile (id, name) values (1, 'Andrew Benedict I. Alcantara') on conflict (id) do nothing;

create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'link',                 -- github, linkedin, facebook, instagram, email, x, youtube, tiktok, dribbble, behance, link
  label text not null default '',                        -- shown for custom links
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.skill_categories (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',                      -- short text on the card
  details text not null default '',                      -- longer text in the detail view
  tags text[] not null default '{}',
  live_url text not null default '',
  repo_url text not null default '',
  images jsonb not null default '[]',                    -- [{ "url": "...", "path": "..." }], first one is the cover
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.education (
  id uuid primary key default gen_random_uuid(),
  school text not null,
  program text not null default '',
  start_year text not null default '',
  end_year text not null default '',                     -- free text: "2026", "Present"
  notes text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  issuer text not null default '',
  issued_on text not null default '',                    -- free text: "March 2026"
  credential_url text not null default '',
  image_url text not null default '',
  image_path text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ row-level security: read for all, write for admins
do $$
declare t text;
begin
  foreach t in array array['profile','social_links','skill_categories','skills','projects','education','certifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('drop policy if exists "admin insert" on public.%I', t);
    execute format('drop policy if exists "admin update" on public.%I', t);
    execute format('drop policy if exists "admin delete" on public.%I', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin insert" on public.%I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "admin update" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- the single profile row can never be deleted
drop policy if exists "admin delete" on public.profile;

-- ------------------------------------------------------------------ storage: one public bucket for images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif'];

drop policy if exists "portfolio public read" on storage.objects;
drop policy if exists "portfolio admin insert" on storage.objects;
drop policy if exists "portfolio admin update" on storage.objects;
drop policy if exists "portfolio admin delete" on storage.objects;
create policy "portfolio public read" on storage.objects for select to anon, authenticated using (bucket_id = 'portfolio');
create policy "portfolio admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio' and public.is_admin());
create policy "portfolio admin update" on storage.objects for update to authenticated using (bucket_id = 'portfolio' and public.is_admin());
create policy "portfolio admin delete" on storage.objects for delete to authenticated using (bucket_id = 'portfolio' and public.is_admin());

-- ------------------------------------------------------------------ make yourself the admin (README step 4)
-- After creating your user in Authentication > Users, run this line on its own,
-- with your login email in place of the example:
--
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
