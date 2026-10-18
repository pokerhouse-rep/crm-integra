-- Núcleo do CRM: leads, retornos, tarefas, eventos, configurações. Tudo isolado por usuário (RLS).

create type public.etapa as enum (
  'prospect', 'mvp_enviado', 'em_conversa', 'proposta_enviada', 'negociacao', 'fechado', 'perdido'
);
create type public.resultado_retorno as enum ('respondeu', 'pediu_tempo', 'sem_interesse', 'sem_resposta');
create type public.origem_retorno as enum ('sequencia', 'reativacao', 'adiado', 'manual', 'proposta');
create type public.status_retorno as enum ('pendente', 'feito', 'cancelado');
create type public.tipo_opcao as enum ('nicho', 'origem', 'motivo_perda');
create type public.tipo_evento as enum (
  'criado', 'mvp_enviado', 'retorno_feito', 'etapa_alterada', 'frio', 'reativado',
  'anotacao', 'tarefa_concluida', 'dados_editados'
);

create table public.configuracoes (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  sequencia_padrao int[] not null default '{2,5,10}',
  dias_reativacao int default 30,
  dias_retorno_proposta int default 3,
  dias_lembrete_cobranca int default 3
);

create table public.opcoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tipo public.tipo_opcao not null,
  nome text not null,
  ativo boolean default true,
  ordem int default 0,
  unique (user_id, tipo, nome)
);

create table public.modelos_mensagem (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  texto text not null,
  passo int null
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome_contato text not null,
  empresa text,
  whatsapp text not null,
  email text,
  cidade text,
  nicho_id uuid references public.opcoes,
  origem_id uuid references public.opcoes,
  link_mvp text,
  mvp_enviado_em date,
  etapa public.etapa not null default 'prospect',
  frio boolean default false,
  motivo_perda_id uuid references public.opcoes,
  cliente boolean default false,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, whatsapp)
);

create table public.retornos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  lead_id uuid not null references public.leads on delete cascade,
  data_prevista date not null,
  ciclo int not null default 1,
  origem public.origem_retorno not null,
  status public.status_retorno not null default 'pendente',
  resultado public.resultado_retorno null,
  feito_em timestamptz null,
  created_at timestamptz default now()
);
create index retornos_user_status_data_idx on public.retornos (user_id, status, data_prevista);

create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  lead_id uuid null references public.leads on delete cascade,
  titulo text not null,
  data date not null,
  hora time null,
  feita boolean default false,
  feita_em timestamptz null,
  created_at timestamptz default now()
);

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  lead_id uuid not null references public.leads on delete cascade,
  tipo public.tipo_evento not null,
  dados jsonb default '{}',
  ocorrido_em timestamptz default now()
);
create index eventos_user_tipo_ocorrido_idx on public.eventos (user_id, tipo, ocorrido_em);

-- RLS: cada usuário só enxerga e altera o que é seu.
do $$
declare t text;
begin
  foreach t in array array['configuracoes','opcoes','modelos_mensagem','leads','retornos','tarefas','eventos']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_isolamento', t
    );
  end loop;
end $$;

-- Dados padrão para cada novo usuário.
create function public.criar_dados_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.configuracoes (user_id) values (new.id);

  insert into public.opcoes (user_id, tipo, nome, ordem)
  select new.id, v.tipo::public.tipo_opcao, v.nome, v.ordem
  from (values
    ('nicho', 'Corretor de imóveis', 1), ('nicho', 'Clínica', 2), ('nicho', 'Restaurante', 3),
    ('nicho', 'Loja', 4), ('nicho', 'Outro', 5),
    ('origem', 'Prospecção ativa', 1), ('origem', 'Indicação', 2), ('origem', 'Tráfego pago', 3),
    ('origem', 'Site', 4), ('origem', 'Outro', 5),
    ('motivo_perda', 'Sem orçamento', 1), ('motivo_perda', 'Já tem site/sistema', 2),
    ('motivo_perda', 'Sem interesse', 3), ('motivo_perda', 'Não respondeu', 4),
    ('motivo_perda', 'Fechou com concorrente', 5), ('motivo_perda', 'Outro', 6)
  ) as v(tipo, nome, ordem);

  insert into public.modelos_mensagem (user_id, nome, texto, passo) values
    (new.id, 'Primeiro contato',
      'Olá {nome}! Preparei uma demonstração pensando no seu negócio: {link_mvp}. Pode dar uma olhada?', null),
    (new.id, 'Retorno 1',
      'Oi {nome}, tudo bem? Conseguiu ver a demonstração que te enviei? Fico à disposição para conversar.', 1),
    (new.id, 'Retorno 2',
      'Oi {nome}! Passando para saber o que achou da demonstração. Posso te ajudar com alguma dúvida?', 2),
    (new.id, 'Retorno 3',
      'Oi {nome}, esse é meu último contato por enquanto. Se fizer sentido conversar, é só me chamar!', 3);

  return new;
end;
$$;

create trigger criar_dados_padrao_apos_usuario
after insert on auth.users
for each row execute function public.criar_dados_padrao();
