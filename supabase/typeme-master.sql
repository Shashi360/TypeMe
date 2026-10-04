-- =====================================================================
-- TypeMe MASTER SQL — the single source of truth for the database.
-- All SQL lives here. Apply top to bottom, in one go, on an empty
-- Supabase project (Dashboard SQL editor or `psql`), then verify with
-- the checklist at the bottom of supabase/README.md.
--
-- Contents:
--   PART 1 — core tables + constraints + indexes
--   PART 2 — triggers (updated_at maintenance, auto profile creation)
--   PART 3 — Row Level Security (auth.uid() is the ONLY owner authority)
--   PART 4 — entitlement function (single source, days derived, never stored)
--   PART 5 — private Storage bucket + policies
--
-- Data-model decisions (do not "fix" without reading):
-- - Strokes live in glyphs.stroke_data as JSONB [{x, y}], matching the
--   app's Stroke model. variant_number 0 = Main, 1..3 = alternates. There
--   is deliberately NO separate variants table (it would duplicate
--   per-character ownership).
-- - Saved state = glyphs.is_saved + saved_at, set only after a real write.
-- - Blob font files are NEVER in tables; tables hold Storage file_path.
-- - No days_remaining column anywhere: always derived from expires_at.
-- - No guest-claim function: ownership transfer without a backend
--   verifier would be privilege escalation. The backend must own it.
-- - No admin table: none exists in the app.
-- =====================================================================

-- ============================================================ PART 1
-- Core tables.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'generated', 'archived')),
  plan_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz,
  completed_at timestamptz
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_updated_at_idx on public.projects (updated_at desc);
create index if not exists projects_last_opened_at_idx on public.projects (last_opened_at desc nulls last);

-- One row per (project, character, variant). variant_number 0 = Main.
create table if not exists public.glyphs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  character text not null,
  variant_number integer not null default 0
    check (variant_number between 0 and 3),
  stroke_data jsonb not null default '[]'::jsonb,
  canvas_width integer,
  canvas_height integer,
  bitmap_width integer,
  bitmap_height integer,
  status text not null default 'empty'
    check (status in ('empty', 'good', 'warning', 'error')),
  is_saved boolean not null default false,
  saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, character, variant_number)
);

create index if not exists glyphs_project_id_idx on public.glyphs (project_id);
create index if not exists glyphs_user_id_idx on public.glyphs (user_id);

create table if not exists public.generated_fonts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  generation_job_id uuid,
  font_name text not null,
  format text not null default 'otf'
    check (format in ('otf', 'ttf')),
  file_path text,
  status text not null default 'ready'
    check (status in ('ready', 'expired', 'revoked')),
  version integer not null default 1,
  download_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generated_fonts_project_id_idx on public.generated_fonts (project_id);
create index if not exists generated_fonts_user_id_idx on public.generated_fonts (user_id);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'ready'
    check (status in ('idle', 'ready', 'validating', 'processing', 'completed', 'warning', 'failed', 'cancelled')),
  progress integer check (progress is null or (progress between 0 and 100)),
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, status)
);

create index if not exists generation_jobs_project_id_idx on public.generation_jobs (project_id);
create index if not exists generation_jobs_user_id_idx on public.generation_jobs (user_id);
create index if not exists generation_jobs_status_idx on public.generation_jobs (status);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'pro')),
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled', 'pending', 'failed')),
  started_at timestamptz,
  expires_at timestamptz,
  razorpay_payment_id text,
  razorpay_order_id text,
  razorpay_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_expires_at_idx on public.subscriptions (expires_at);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  razorpay_payment_id text,
  razorpay_order_id text,
  razorpay_signature text,
  amount integer,
  currency text not null default 'INR',
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed', 'cancelled', 'refunded')),
  plan text not null default 'pro'
    check (plan in ('free', 'pro')),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_razorpay_payment_id_idx on public.payments (razorpay_payment_id);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text,
  default_canvas_style text,
  default_brush text,
  default_stroke_size text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================ PART 2
-- Triggers.

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

drop trigger if exists set_glyphs_updated_at on public.glyphs;
create trigger set_glyphs_updated_at
  before update on public.glyphs
  for each row execute function public.handle_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', null),
    coalesce(new.phone, null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================ PART 3
-- Row Level Security. auth.uid() is the ONLY ownership authority; no policy
-- trusts a client-supplied user_id. Anonymous Supabase users hold distinct
-- UIDs under the authenticated role, so the same policies isolate guests
-- automatically — no shared guest ID anywhere.

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.glyphs enable row level security;
alter table public.generated_fonts enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "projects_all_own" on public.projects;
create policy "projects_all_own"
  on public.projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "glyphs_select_own" on public.glyphs;
create policy "glyphs_select_own"
  on public.glyphs for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = glyphs.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "glyphs_insert_own" on public.glyphs;
create policy "glyphs_insert_own"
  on public.glyphs for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = glyphs.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "glyphs_update_own" on public.glyphs;
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

drop policy if exists "glyphs_delete_own" on public.glyphs;
create policy "glyphs_delete_own"
  on public.glyphs for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = glyphs.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "generated_fonts_select_own" on public.generated_fonts;
create policy "generated_fonts_select_own"
  on public.generated_fonts for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = generated_fonts.project_id and p.user_id = auth.uid()
    )
  );

-- generated_fonts: users record their OWN artifacts (project must also be
-- owned — double condition). Rows grant no entitlement (nothing reads this
-- table for access control); downloads derive from project ownership.
-- generation_jobs writes stay backend-only (service role).
drop policy if exists "generated_fonts_insert_own" on public.generated_fonts;
create policy "generated_fonts_insert_own"
  on public.generated_fonts for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = generated_fonts.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "generation_jobs_select_own" on public.generation_jobs;
create policy "generation_jobs_select_own"
  on public.generation_jobs for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = generation_jobs.project_id and p.user_id = auth.uid()
    )
  );

-- Subscriptions: read-own only. Plan/status/expiry changes are backend-only
-- (service role); a browser request can NEVER promote itself to Pro.
-- Exception: users may record their OWN checkout intent while status stays
-- 'pending' — activation remains backend-only and the entitlement RPC
-- honors active rows exclusively.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (user_id = auth.uid());

drop policy if exists "subscriptions_insert_own_pending" on public.subscriptions;
create policy "subscriptions_insert_own_pending"
  on public.subscriptions for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "subscriptions_update_own_pending" on public.subscriptions;
create policy "subscriptions_update_own_pending"
  on public.subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'pending');

-- Payments: read-own history only. Verification + status writes are
-- backend-only; users may only record non-verified intents.
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
  on public.payments for select
  using (user_id = auth.uid());

drop policy if exists "payments_insert_own_initiated" on public.payments;
create policy "payments_insert_own_initiated"
  on public.payments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status in ('pending', 'failed', 'cancelled')
  );

-- BACKEND WEBHOOK CONTRACT (when Razorpay keys land; server-side only)
-- 1. Create order (server): amount 9900 paise, currency INR, receipt uid.
-- 2. Verify signature (server, HMAC-SHA256, key_secret — never browser).
-- 3. service_role: payments -> verified + verified_at; subscriptions ->
--    status 'active', started_at/expires_at (+30d), razorpay ids stored.
-- 4. App reconciles on next load via get_my_entitlement() (already wired).

drop policy if exists "user_settings_all_own" on public.user_settings;
create policy "user_settings_all_own"
  on public.user_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================ PART 4
-- Entitlement: the single source. Narrow SECURITY DEFINER reader, no
-- arguments, identity from the caller's JWT. days_remaining is always
-- computed from expires_at vs now() — never stored. Plain SQL (single
-- auditable query, no plpgsql control flow).

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

-- ============================================================ PART 5
-- Private Storage for generated font files: objects live under
-- <uid>/<project>/<file>. No update policy — font files are immutable
-- artifacts; regenerate instead.

insert into storage.buckets (id, name, public)
values ('fonts', 'fonts', false)
on conflict (id) do nothing;

drop policy if exists "fonts_insert_own" on storage.objects;
create policy "fonts_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fonts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fonts_select_own" on storage.objects;
create policy "fonts_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fonts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fonts_delete_own" on storage.objects;
create policy "fonts_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fonts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ================================ END OF MASTER ==============================
