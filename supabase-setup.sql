-- VentureCheck — Setup inicial das tabelas
-- Rodar no Supabase SQL Editor: https://supabase.com/dashboard/project/ieomvpojcgokdemvyitn/sql/new

-- Tabela de sessões (relatórios finais)
create table if not exists vc_sessions (
  id           text primary key,
  name         text,
  idea         text,
  plan         text,
  status           text default 'draft',
  plan             text,
  imi_score        integer,
  veredito         text,
  report_json      jsonb,
  payment_id       text,
  payment_provider text,
  paid_at          timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Tabela de rascunhos (auto-save durante o fluxo)
create table if not exists vc_drafts (
  id           text primary key,
  session_data jsonb,
  updated_at   timestamptz default now()
);

-- Habilitar RLS
alter table vc_sessions enable row level security;
alter table vc_drafts   enable row level security;

-- Política: qualquer usuário anônimo pode inserir e ler suas próprias sessões
-- (por enquanto aberto para anon — restringir por user_id quando adicionar auth)
create policy "anon insert sessions"
  on vc_sessions for insert to anon with check (true);

create policy "anon select sessions"
  on vc_sessions for select to anon using (true);

create policy "anon update sessions"
  on vc_sessions for update to anon using (true);

create policy "anon insert drafts"
  on vc_drafts for insert to anon with check (true);

create policy "anon select drafts"
  on vc_drafts for select to anon using (true);

create policy "anon update drafts"
  on vc_drafts for update to anon using (true);

-- Tabela de feedback dos usuários
create table if not exists vc_feedback (
  id          bigserial primary key,
  session_id  text,
  plan        text,
  question    text,        -- 'analise' | 'produto'
  rating      integer,     -- 1-5
  comment     text,
  created_at  timestamptz default now()
);

alter table vc_feedback enable row level security;

create policy "anon insert feedback"
  on vc_feedback for insert to anon with check (true);

create policy "anon select feedback"
  on vc_feedback for select to anon using (true);

-- Índice para buscas por status e data
create index if not exists idx_vc_sessions_status     on vc_sessions(status);
create index if not exists idx_vc_sessions_created_at on vc_sessions(created_at desc);
create index if not exists idx_vc_feedback_session_id on vc_feedback(session_id);
create index if not exists idx_vc_feedback_created_at on vc_feedback(created_at desc);
