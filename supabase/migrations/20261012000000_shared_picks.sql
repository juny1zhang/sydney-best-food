-- One row per chosen meal in the shared December plan.
-- The site has no login, so the publishable key may read and edit this plan, and only this plan:
-- the checks cap the table at 62 small rows (31 days x lunch/dinner).
create table public.picks (
  plan_id text not null check (plan_id = 'dec-2026'),
  day smallint not null check (day between 1 and 31),
  meal text not null check (meal in ('lunch', 'dinner')),
  pick jsonb not null check (jsonb_typeof(pick) = 'object' and pg_column_size(pick) <= 1024),
  primary key (plan_id, day, meal)
);

alter table public.picks enable row level security;

create policy "read the december plan" on public.picks
  for select to anon, authenticated using (plan_id = 'dec-2026');
create policy "add to the december plan" on public.picks
  for insert to anon, authenticated with check (plan_id = 'dec-2026');
create policy "change the december plan" on public.picks
  for update to anon, authenticated using (plan_id = 'dec-2026') with check (plan_id = 'dec-2026');
create policy "clear from the december plan" on public.picks
  for delete to anon, authenticated using (plan_id = 'dec-2026');

grant select, insert, update, delete on public.picks to anon, authenticated;

-- Stream changes to everyone who has the site open.
alter publication supabase_realtime add table public.picks;
