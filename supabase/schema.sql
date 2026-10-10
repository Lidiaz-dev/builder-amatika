-- Builder Amatika : à exécuter une fois dans Supabase > SQL Editor.
create table if not exists public.crews (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  faction_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crews_user_id_idx on public.crews (user_id);

-- Chaque joueur ne voit et ne modifie que ses propres bandes.
alter table public.crews enable row level security;

create policy "Lire ses bandes" on public.crews
  for select using (auth.uid() = user_id);
create policy "Créer ses bandes" on public.crews
  for insert with check (auth.uid() = user_id);
create policy "Modifier ses bandes" on public.crews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Supprimer ses bandes" on public.crews
  for delete using (auth.uid() = user_id);
