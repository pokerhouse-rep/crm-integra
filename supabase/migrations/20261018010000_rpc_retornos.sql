-- Operações de retorno e etapa atômicas: tudo ou nada, com RLS do chamador (security invoker).

create index retornos_lead_idx on public.retornos (lead_id);
create index tarefas_lead_idx on public.tarefas (lead_id);
create index eventos_lead_idx on public.eventos (lead_id);

create function public.aplicar_resultado(
  p_retorno_id uuid,
  p_resultado public.resultado_retorno,
  p_pendentes_esperados int,
  p_cancelar_pendentes boolean,
  p_nova_etapa public.etapa,
  p_novos_retornos jsonb,
  p_frio text,
  p_motivo_perda_id uuid,
  p_nova_data date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_retorno public.retornos;
  v_lead public.leads;
  v_pendentes int;
  v_etapa_mudou boolean;
begin
  select * into v_retorno from public.retornos where id = p_retorno_id for update;
  if not found then
    raise exception 'Retorno não encontrado.' using errcode = 'P0001';
  end if;
  if v_retorno.status <> 'pendente' then
    raise exception 'Este retorno já foi registrado.' using errcode = 'P0001';
  end if;

  select * into v_lead from public.leads where id = v_retorno.lead_id for update;

  select count(*) into v_pendentes
  from public.retornos
  where lead_id = v_lead.id and status = 'pendente' and id <> p_retorno_id;
  if v_pendentes <> p_pendentes_esperados then
    raise exception 'Os retornos deste lead mudaram. Atualize a página e tente de novo.' using errcode = 'P0001';
  end if;

  update public.retornos
  set status = 'feito', resultado = p_resultado, feito_em = now()
  where id = p_retorno_id;

  if p_cancelar_pendentes then
    update public.retornos set status = 'cancelado'
    where lead_id = v_lead.id and status = 'pendente';
  end if;

  insert into public.retornos (lead_id, data_prevista, origem, ciclo)
  select v_lead.id, (n->>'data')::date, (n->>'origem')::public.origem_retorno, (n->>'ciclo')::int
  from jsonb_array_elements(coalesce(p_novos_retornos, '[]'::jsonb)) as n;

  v_etapa_mudou := p_nova_etapa is not null and p_nova_etapa <> v_lead.etapa;

  update public.leads
  set etapa = case when v_etapa_mudou then p_nova_etapa else etapa end,
      frio = case p_frio when 'marcar' then true when 'limpar' then false else frio end,
      motivo_perda_id = case when p_resultado = 'sem_interesse' then p_motivo_perda_id else motivo_perda_id end,
      updated_at = now()
  where id = v_lead.id;

  insert into public.eventos (lead_id, tipo, dados)
  values (v_lead.id, 'retorno_feito', jsonb_strip_nulls(jsonb_build_object(
    'resultado', p_resultado, 'retorno_id', p_retorno_id, 'ciclo', v_retorno.ciclo, 'nova_data', p_nova_data
  )));
  if v_etapa_mudou then
    insert into public.eventos (lead_id, tipo, dados)
    values (v_lead.id, 'etapa_alterada', jsonb_build_object('de', v_lead.etapa, 'para', p_nova_etapa));
  end if;
  if p_frio = 'marcar' then
    insert into public.eventos (lead_id, tipo, dados)
    values (v_lead.id, 'frio', jsonb_build_object('ciclo', v_retorno.ciclo + 1));
  end if;
  if p_frio = 'limpar' and v_lead.frio then
    insert into public.eventos (lead_id, tipo, dados) values (v_lead.id, 'reativado', '{}'::jsonb);
  end if;
end;
$$;

create function public.mover_etapa(p_lead_id uuid, p_etapa public.etapa, p_motivo_perda_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_conversa boolean;
  v_reativado boolean;
begin
  if p_etapa = 'perdido' and p_motivo_perda_id is null then
    raise exception 'Informe o motivo da perda.' using errcode = 'P0001';
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead não encontrado.' using errcode = 'P0001';
  end if;

  v_conversa := p_etapa in ('em_conversa', 'proposta_enviada', 'negociacao', 'fechado', 'perdido');
  v_reativado := v_conversa and coalesce(v_lead.frio, false);

  if p_etapa in ('perdido', 'fechado') then
    update public.retornos set status = 'cancelado' where lead_id = p_lead_id and status = 'pendente';
  elsif v_conversa then
    update public.retornos set status = 'cancelado'
    where lead_id = p_lead_id and status = 'pendente' and origem in ('sequencia', 'reativacao');
  end if;

  update public.leads
  set etapa = p_etapa,
      motivo_perda_id = case
        when p_etapa = 'perdido' then p_motivo_perda_id
        when v_lead.etapa = 'perdido' then null
        else motivo_perda_id end,
      cliente = case when p_etapa = 'fechado' then true else cliente end,
      frio = case when v_reativado then false else frio end,
      updated_at = now()
  where id = p_lead_id;

  insert into public.eventos (lead_id, tipo, dados)
  values (p_lead_id, 'etapa_alterada', jsonb_build_object('de', v_lead.etapa, 'para', p_etapa));
  if v_reativado then
    insert into public.eventos (lead_id, tipo, dados) values (p_lead_id, 'reativado', '{}'::jsonb);
  end if;
end;
$$;
