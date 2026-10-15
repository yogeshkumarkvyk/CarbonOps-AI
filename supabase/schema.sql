-- CarbonOps single-user cloud workspaces. Every user can access only their own row.
create table if not exists public.carbonops_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  constraint carbonops_state_is_object check (jsonb_typeof(state) = 'object')
);

alter table public.carbonops_workspaces enable row level security;
revoke all on public.carbonops_workspaces from anon;
grant select, insert, update, delete on public.carbonops_workspaces to authenticated;

drop policy if exists "Users manage their own CarbonOps workspace" on public.carbonops_workspaces;
create policy "Users manage their own CarbonOps workspace"
  on public.carbonops_workspaces for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Private floor-plan images live in Storage; JSON workspace rows store only their paths.
insert into storage.buckets (id, name, public)
values ('carbonops-assets', 'carbonops-assets', false)
on conflict (id) do nothing;

drop policy if exists "Users read their CarbonOps assets" on storage.objects;
create policy "Users read their CarbonOps assets" on storage.objects
  for select to authenticated using (
    bucket_id = 'carbonops-assets' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Users add their CarbonOps assets" on storage.objects;
create policy "Users add their CarbonOps assets" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'carbonops-assets' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Users update their CarbonOps assets" on storage.objects;
create policy "Users update their CarbonOps assets" on storage.objects
  for update to authenticated using (
    bucket_id = 'carbonops-assets' and (storage.foldername(name))[1] = (select auth.uid())::text
  ) with check (
    bucket_id = 'carbonops-assets' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Users delete their CarbonOps assets" on storage.objects;
create policy "Users delete their CarbonOps assets" on storage.objects
  for delete to authenticated using (
    bucket_id = 'carbonops-assets' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Atomic per-user hourly limit for public AI calls (enforced by the Pages Function).
create table if not exists public.carbonops_ai_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0)
);
alter table public.carbonops_ai_usage enable row level security;
revoke all on public.carbonops_ai_usage from anon, authenticated;

create or replace function public.take_carbonops_ai_slot(p_user_id uuid, p_limit integer default 30)
returns boolean language plpgsql security definer set search_path = public
as $$
declare allowed boolean;
begin
  insert into public.carbonops_ai_usage (user_id, window_start, request_count)
  values (p_user_id, date_trunc('hour', now()), 1)
  on conflict (user_id) do update
    set window_start = excluded.window_start,
        request_count = case when carbonops_ai_usage.window_start = excluded.window_start
          then carbonops_ai_usage.request_count + 1 else 1 end
    where carbonops_ai_usage.window_start <> excluded.window_start
      or carbonops_ai_usage.request_count < p_limit
  returning true into allowed;
  return coalesce(allowed, false);
end;
$$;
revoke all on function public.take_carbonops_ai_slot(uuid, integer) from public, anon, authenticated;
grant execute on function public.take_carbonops_ai_slot(uuid, integer) to service_role;
