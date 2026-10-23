-- Tietovisa: perusskeema
-- Suorita tämä tiedosto Supabase-projektin SQL-editorissa tai `supabase db push` -komennolla.
--
-- Suunnitteluperiaatteet:
--  * Kaikki taulut ovat RLS-suojattuja eikä anon-roolille anneta mitään suoria oikeuksia.
--    Sovellus käyttää ainoastaan palvelinpuolen service-avainta (sb_secret_...), joka ohittaa RLS:n.
--  * Salaisia tokeneita ei koskaan tallenneta selväkielisenä, vain SHA-256-tiiviste.
--  * Tietokanta on pelin pysyvän tilan ainoa totuuden lähde.

-- gen_random_uuid() on osa PostgreSQL 13+ -ydintä, joten lisäosia ei tarvita.

-- ---------------------------------------------------------------------------
-- Taulu: rooms
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  pin text not null,
  status text not null default 'lobby',
  current_question_index integer not null default 0,
  question_started_at timestamptz,
  question_ends_at timestamptz,
  host_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_pin_format check (pin ~ '^[0-9]{6}$'),
  constraint rooms_status_valid check (
    status in ('lobby', 'question', 'question_result', 'leaderboard', 'finished')
  ),
  constraint rooms_question_index_valid check (current_question_index >= 0)
);

-- PIN-koodi on uniikki, jotta liittyminen on yksiselitteistä.
-- Törmäys ei jää pysyväksi esteeksi: palvelin arpoo uuden koodin ja yrittää uudelleen.
create unique index if not exists rooms_pin_key on public.rooms (pin);

-- ---------------------------------------------------------------------------
-- Taulu: players
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  nickname varchar(24) not null,
  token_hash text not null,
  score integer not null default 0,
  correct_count integer not null default 0,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint players_nickname_length check (char_length(btrim(nickname)) between 1 and 24),
  constraint players_score_valid check (score >= 0),
  constraint players_correct_count_valid check (correct_count >= 0)
);

-- Tulostaulukyselyt: huoneen pelaajat pistemäärän mukaan laskevasti.
create index if not exists players_room_score_idx
  on public.players (room_id, score desc, correct_count desc, joined_at asc);

-- Sama nimimerkki ei voi esiintyä kahdesti samassa huoneessa (kirjainkoosta riippumatta).
create unique index if not exists players_room_nickname_key
  on public.players (room_id, lower(btrim(nickname)));

create index if not exists players_room_idx on public.players (room_id);

-- ---------------------------------------------------------------------------
-- Taulu: answers
-- ---------------------------------------------------------------------------
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  question_index integer not null,
  answer_index integer not null,
  is_correct boolean not null default false,
  response_time_ms integer not null default 0,
  points_awarded integer not null default 0,
  submitted_at timestamptz not null default now(),
  constraint answers_question_index_valid check (question_index >= 0),
  constraint answers_answer_index_valid check (answer_index between 0 and 3),
  constraint answers_response_time_valid check (response_time_ms >= 0),
  constraint answers_points_valid check (points_awarded >= 0),
  -- Yksi vastaus kysymystä kohti: estää kaksinkertaisen pisteytyksen myös kilpailevissa pyynnöissä.
  constraint answers_player_question_key unique (player_id, question_index)
);

create index if not exists answers_room_question_idx
  on public.answers (room_id, question_index);
create index if not exists answers_player_idx on public.answers (player_id);

-- ---------------------------------------------------------------------------
-- updated_at-päivitys
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
  before update on public.rooms
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: päälle kaikkiin tauluihin, ei yhtään politiikkaa anon-roolille.
-- Palvelin käyttää service-avainta, joka ohittaa RLS:n.
-- ---------------------------------------------------------------------------
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.answers enable row level security;

revoke all on table public.rooms from anon, authenticated;
revoke all on table public.players from anon, authenticated;
revoke all on table public.answers from anon, authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
