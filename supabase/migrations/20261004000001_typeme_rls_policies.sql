-- TypeMe RLS, entitlement function, and Storage policies.
-- Principles: auth.uid() is the ONLY ownership authority; no policy trusts a
-- client-supplied user_id. Anonymous Supabase users hold distinct UIDs under
-- the authenticated role, so the same ownership policies isolate guests
-- automatically — no shared guest ID anywhere.

-- ============================================================ enable RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.glyphs enable row level security;
alter table public.generated_fonts enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.user_settings enable row level security;

-- ================================================================ profiles
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ================================================================ projects
create policy "projects_all_own"
  on public.projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ================================================================== glyphs
-- Dual check: the row's user_id AND its project's owner must be the caller,
-- so a glyph can never be attached to another user's project.
create policy "glyphs_select_own"
  on public.glyphs for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = glyphs.project_id and p.user_id = auth.uid()
    )
  );

create policy "glyphs_insert_own"
  on public.glyphs for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = glyphs.project_id and p.user_id = auth.uid()
    )
  );

create policy "glyphs_update_own"
  on public.glyphs for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = glyphs.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = glyphs.project_id and p.user_id = auth.uid()
    )
  );

create policy "glyphs_delete_own"
  on public.glyphs for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = glyphs.project_id and p.user_id = auth.uid()
    )
  );

-- ========================================================= generated_fonts
create policy "generated_fonts_select_own"
  on public.generated_fonts for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = generated_fonts.project_id and p.user_id = auth.uid()
    )
  );

-- Inserts come from the trusted generation backend (service role), never
-- from the browser. No insert/update/delete policy for anon/authenticated.

-- ========================================================== generation_jobs
create policy "generation_jobs_select_own"
  on public.generation_jobs for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = generation_jobs.project_id and p.user_id = auth.uid()
    )
  );

-- Writes belong to the trusted backend. No insert/update/delete for clients.

-- ============================================================= subscriptions
-- Read-own only. Plan/status/expiry changes are backend-only (service role);
-- a browser request can NEVER promote itself to Pro.
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (user_id = auth.uid());

-- ================================================================== payments
-- Read-own history only. Verification + status writes are backend-only.
create policy "payments_select_own"
  on public.payments for select
  using (user_id = auth.uid());

-- ============================================================ user_settings
create policy "user_settings_all_own"
  on public.user_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================ entitlement (single source)
-- Narrow SECURITY DEFINER reader: no arguments, derives identity from the
-- caller's JWT, returns plan + expiry-derived state. days_remaining is
-- always computed from expires_at vs now() — never stored.
-- Written in plain SQL (no plpgsql control flow) so the logic is a single
-- auditable query.
create or replace function public.get_my_entitlement()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with sub as (
    select plan, status, started_at, expires_at
      from public.subscriptions
     where user_id = auth.uid()
     order by updated_at desc
     limit 1
  )
  select case
    when (select count(*) from sub) = 0 then jsonb_build_object(
      'plan', 'free',
      'status', 'active',
      'startedAt', null,
      'expiresAt', null,
      'daysRemaining', 0,
      'isPro', false,
      'isActive', false
    )
    when (select status from sub) <> 'active'
      or (select expires_at from sub) is not null
      and (select expires_at from sub) <= now() then jsonb_build_object(
      'plan', 'free',
      'status', case when (select status from sub) = 'active' then 'expired' else (select status from sub) end,
      'startedAt', (select started_at from sub),
      'expiresAt', (select expires_at from sub),
      'daysRemaining', 0,
      'isPro', false,
      'isActive', false
    )
    else jsonb_build_object(
      'plan', (select plan from sub),
      'status', (select status from sub),
      'startedAt', (select started_at from sub),
      'expiresAt', (select expires_at from sub),
      'daysRemaining', greatest(0, ceil(extract(epoch from ((select expires_at from sub) - now())) / 86400.0)),
      'isPro', (select plan from sub) = 'pro',
      'isActive', true
    )
  end;
$$;

revoke all on function public.get_my_entitlement() from public;
grant execute on function public.get_my_entitlement() to authenticated, anon;

-- ================================================================= storage
-- Private fonts bucket: objects live under <uid>/<project>/<file>.
insert into storage.buckets (id, name, public)
values ('fonts', 'fonts', false)
on conflict (id) do nothing;

create policy "fonts_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fonts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "fonts_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fonts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "fonts_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fonts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No update policy: font files are immutable artifacts; regenerate instead.
