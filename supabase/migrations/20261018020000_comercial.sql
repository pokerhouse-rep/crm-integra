-- Comercial: catálogo, propostas (com versões e itens), contratos, reajustes e cobranças.
-- Dinheiro sempre em centavos (bigint). Tudo isolado por usuário (RLS).

create type public.tipo_valor as enum ('unico', 'recorrente');
create type public.tipo_desconto as enum ('percentual', 'valor');
create type public.status_proposta as enum ('rascunho', 'enviada', 'aceita', 'recusada');
create type public.status_contrato as enum ('ativo', 'pausado', 'cancelado');
create type public.status_cobranca as enum ('aberta', 'paga', 'suspensa');
create type public.tipo_cobranca as enum ('avista', 'parcela', 'mensalidade');

-- Novos tipos de evento (só ficam utilizáveis depois desta migration).
alter type public.tipo_evento add value 'proposta_criada';
alter type public.tipo_evento add value 'proposta_enviada';
alter type public.tipo_evento add value 'proposta_nova_versao';
alter type public.tipo_evento add value 'proposta_aceita';
alter type public.tipo_evento add value 'proposta_recusada';
alter type public.tipo_evento add value 'contrato_pausado';
alter type public.tipo_evento add value 'contrato_reativado';
alter type public.tipo_evento add value 'contrato_cancelado';
alter type public.tipo_evento add value 'contrato_reajustado';
alter type public.tipo_evento add value 'cobranca_paga';
alter type public.tipo_evento add value 'pagamento_desfeito';

create table public.catalogo_servicos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  tipo public.tipo_valor not null,
  preco_centavos bigint not null default 0 check (preco_centavos >= 0),
  ativo boolean default true,
  ordem int default 0,
  unique (user_id, nome)
);

create table public.propostas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  lead_id uuid not null references public.leads on delete cascade,
  titulo text not null default 'Proposta',
  status public.status_proposta not null default 'rascunho',
  aceita_em date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.versoes_proposta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  proposta_id uuid not null references public.propostas on delete cascade,
  numero int not null,
  total_unico_centavos bigint not null default 0,
  total_recorrente_centavos bigint not null default 0,
  enviada_em timestamptz,
  created_at timestamptz default now(),
  unique (proposta_id, numero)
);

create table public.itens_proposta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  versao_id uuid not null references public.versoes_proposta on delete cascade,
  ordem int not null,
  servico_id uuid references public.catalogo_servicos on delete set null,
  descricao text not null,
  tipo public.tipo_valor not null,
  valor_centavos bigint not null check (valor_centavos > 0),
  parcelas int not null default 1 check (parcelas between 1 and 48),
  mes_inicio date,
  desconto_tipo public.tipo_desconto,
  desconto_valor bigint,
  check (tipo = 'unico' or mes_inicio is not null),
  check ((desconto_tipo is null) = (desconto_valor is null))
);

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  lead_id uuid not null references public.leads on delete cascade,
  proposta_id uuid references public.propostas on delete set null,
  descricao text not null,
  dia_vencimento int not null check (dia_vencimento between 1 and 28),
  data_inicio date not null,
  status public.status_contrato not null default 'ativo',
  pausado_em date,
  cancelado_em date,
  created_at timestamptz default now()
);

create table public.contrato_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  contrato_id uuid not null references public.contratos on delete cascade,
  ordem int,
  descricao text not null,
  tipo public.tipo_valor not null,
  valor_centavos bigint not null check (valor_centavos > 0), -- líquido (já com desconto)
  parcelas int not null default 1,
  mes_inicio date
);

create table public.reajustes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  contrato_item_id uuid not null references public.contrato_itens on delete cascade,
  a_partir_de date not null,
  valor_centavos bigint not null check (valor_centavos > 0),
  created_at timestamptz default now(),
  unique (contrato_item_id, a_partir_de)
);

create table public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  contrato_id uuid not null references public.contratos on delete cascade,
  contrato_item_id uuid not null references public.contrato_itens on delete cascade,
  lead_id uuid not null references public.leads on delete cascade,
  tipo public.tipo_cobranca not null,
  numero int,
  total_parcelas int,
  competencia date,
  vencimento date not null,
  valor_centavos bigint not null check (valor_centavos >= 0),
  status public.status_cobranca not null default 'aberta',
  pago_em date,
  valor_pago_centavos bigint,
  created_at timestamptz default now(),
  unique (contrato_item_id, numero),
  unique (contrato_item_id, competencia)
);

create index propostas_lead_idx on public.propostas (lead_id);
create index versoes_proposta_proposta_idx on public.versoes_proposta (proposta_id);
create index itens_proposta_versao_idx on public.itens_proposta (versao_id);
create index contratos_lead_idx on public.contratos (lead_id);
create index cobrancas_user_status_vencimento_idx on public.cobrancas (user_id, status, vencimento);
create index cobrancas_contrato_idx on public.cobrancas (contrato_id);

do $$
declare t text;
begin
  foreach t in array array[
    'catalogo_servicos','propostas','versoes_proposta','itens_proposta',
    'contratos','contrato_itens','reajustes','cobrancas'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_isolamento', t
    );
  end loop;
end $$;

-- Catálogo padrão para novos usuários (trigger próprio; criar_dados_padrao não é alterada).
create function public.criar_catalogo_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.catalogo_servicos (user_id, nome, tipo, preco_centavos, ordem)
  select new.id, v.nome, v.tipo::public.tipo_valor, 0, v.ordem
  from (values
    ('Site', 'unico', 1), ('Plataforma', 'unico', 2), ('Sistema interno', 'unico', 3),
    ('Hospedagem', 'recorrente', 4), ('Manutenção', 'recorrente', 5)
  ) as v(nome, tipo, ordem)
  on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.criar_catalogo_padrao() from public, anon, authenticated;

create trigger criar_catalogo_padrao_apos_usuario
after insert on auth.users
for each row execute function public.criar_catalogo_padrao();

-- Usuários que já existem também recebem o catálogo.
insert into public.catalogo_servicos (user_id, nome, tipo, preco_centavos, ordem)
select u.id, v.nome, v.tipo::public.tipo_valor, 0, v.ordem
from auth.users u
cross join (values
  ('Site', 'unico', 1), ('Plataforma', 'unico', 2), ('Sistema interno', 'unico', 3),
  ('Hospedagem', 'recorrente', 4), ('Manutenção', 'recorrente', 5)
) as v(nome, tipo, ordem)
on conflict do nothing;
