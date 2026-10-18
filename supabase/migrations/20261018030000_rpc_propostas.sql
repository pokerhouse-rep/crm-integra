-- Operações de proposta atômicas (security invoker: RLS do chamador continua valendo).
-- Ordem de locks: lead primeiro, depois proposta (igual a mover_etapa), para evitar deadlock.

create function public.criar_proposta(p_lead_id uuid, p_titulo text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_proposta_id uuid;
begin
  perform 1 from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead não encontrado.' using errcode = 'P0001';
  end if;

  insert into public.propostas (lead_id, titulo)
  values (p_lead_id, coalesce(nullif(btrim(p_titulo), ''), 'Proposta'))
  returning id into v_proposta_id;

  insert into public.versoes_proposta (proposta_id, numero) values (v_proposta_id, 1);

  insert into public.eventos (lead_id, tipo, dados)
  values (p_lead_id, 'proposta_criada', jsonb_build_object('proposta_id', v_proposta_id));

  return v_proposta_id;
end;
$$;

create function public.salvar_itens_versao(
  p_proposta_id uuid,
  p_itens jsonb,
  p_total_unico bigint,
  p_total_recorrente bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_proposta public.propostas;
  v_versao_id uuid;
begin
  select lead_id into v_lead_id from public.propostas where id = p_proposta_id;
  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'P0001';
  end if;
  perform 1 from public.leads where id = v_lead_id for update;
  select * into v_proposta from public.propostas where id = p_proposta_id for update;

  if v_proposta.status = 'aceita' then
    raise exception 'Proposta aceita não pode ser alterada.' using errcode = 'P0001';
  elsif v_proposta.status <> 'rascunho' then
    raise exception 'Esta versão já foi enviada. Crie uma nova versão para alterar.' using errcode = 'P0001';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'Itens inválidos.' using errcode = 'P0001';
  end if;

  select id into v_versao_id
  from public.versoes_proposta
  where proposta_id = p_proposta_id
  order by numero desc
  limit 1
  for update;

  delete from public.itens_proposta where versao_id = v_versao_id;

  insert into public.itens_proposta (
    versao_id, ordem, servico_id, descricao, tipo, valor_centavos, parcelas, mes_inicio, desconto_tipo, desconto_valor
  )
  select
    v_versao_id,
    (e.ord - 1)::int,
    nullif(e.item->>'servico_id', '')::uuid,
    e.item->>'descricao',
    (e.item->>'tipo')::public.tipo_valor,
    (e.item->>'valor_centavos')::bigint,
    coalesce((e.item->>'parcelas')::int, 1),
    nullif(e.item->>'mes_inicio', '')::date,
    nullif(e.item->>'desconto_tipo', '')::public.tipo_desconto,
    (e.item->>'desconto_valor')::bigint
  from jsonb_array_elements(p_itens) with ordinality as e(item, ord);

  update public.versoes_proposta
  set total_unico_centavos = p_total_unico, total_recorrente_centavos = p_total_recorrente
  where id = v_versao_id;

  update public.propostas set updated_at = now() where id = p_proposta_id;
end;
$$;

create function public.nova_versao(p_proposta_id uuid)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_proposta public.propostas;
  v_ultima public.versoes_proposta;
  v_nova_id uuid;
  v_numero int;
begin
  select lead_id into v_lead_id from public.propostas where id = p_proposta_id;
  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'P0001';
  end if;
  perform 1 from public.leads where id = v_lead_id for update;
  select * into v_proposta from public.propostas where id = p_proposta_id for update;

  if v_proposta.status = 'aceita' then
    raise exception 'Proposta aceita não pode ser alterada.' using errcode = 'P0001';
  elsif v_proposta.status = 'rascunho' then
    raise exception 'A versão atual ainda é um rascunho.' using errcode = 'P0001';
  end if;

  select * into v_ultima
  from public.versoes_proposta
  where proposta_id = p_proposta_id
  order by numero desc
  limit 1;

  v_numero := v_ultima.numero + 1;

  insert into public.versoes_proposta (proposta_id, numero, total_unico_centavos, total_recorrente_centavos)
  values (p_proposta_id, v_numero, v_ultima.total_unico_centavos, v_ultima.total_recorrente_centavos)
  returning id into v_nova_id;

  insert into public.itens_proposta (
    versao_id, ordem, servico_id, descricao, tipo, valor_centavos, parcelas, mes_inicio, desconto_tipo, desconto_valor
  )
  select v_nova_id, ordem, servico_id, descricao, tipo, valor_centavos, parcelas, mes_inicio, desconto_tipo, desconto_valor
  from public.itens_proposta
  where versao_id = v_ultima.id;

  update public.propostas set status = 'rascunho', updated_at = now() where id = p_proposta_id;

  insert into public.eventos (lead_id, tipo, dados)
  values (v_lead_id, 'proposta_nova_versao', jsonb_build_object('proposta_id', p_proposta_id, 'versao', v_numero));

  return v_numero;
end;
$$;

create function public.enviar_proposta(p_proposta_id uuid, p_data_retorno date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_lead_id uuid;
  v_proposta public.propostas;
  v_versao public.versoes_proposta;
  v_itens int;
  v_etapa public.etapa;
  v_ciclo int;
begin
  select lead_id into v_lead_id from public.propostas where id = p_proposta_id;
  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'P0001';
  end if;
  select * into v_lead from public.leads where id = v_lead_id for update;
  select * into v_proposta from public.propostas where id = p_proposta_id for update;

  if v_proposta.status = 'aceita' then
    raise exception 'Proposta aceita não pode ser alterada.' using errcode = 'P0001';
  elsif v_proposta.status = 'recusada' then
    raise exception 'Proposta recusada. Crie uma nova versão para enviar.' using errcode = 'P0001';
  elsif v_proposta.status <> 'rascunho' then
    raise exception 'Esta versão já foi enviada.' using errcode = 'P0001';
  end if;

  select * into v_versao
  from public.versoes_proposta
  where proposta_id = p_proposta_id
  order by numero desc
  limit 1
  for update;

  select count(*) into v_itens from public.itens_proposta where versao_id = v_versao.id;
  if v_itens = 0 then
    raise exception 'Adicione ao menos um item antes de enviar.' using errcode = 'P0001';
  end if;

  update public.versoes_proposta set enviada_em = now() where id = v_versao.id;
  update public.propostas set status = 'enviada', updated_at = now() where id = p_proposta_id;

  -- P2: v1 -> proposta_enviada; v2+ -> negociacao. Cliente existente não muda de etapa.
  v_etapa := case when v_versao.numero = 1 then 'proposta_enviada' else 'negociacao' end;
  if v_lead.etapa <> v_etapa and not coalesce(v_lead.cliente, false) then
    perform public.mover_etapa(v_lead.id, v_etapa, null);
  end if;

  select coalesce(max(ciclo), 1) into v_ciclo from public.retornos where lead_id = v_lead.id;

  update public.retornos set status = 'cancelado'
  where lead_id = v_lead.id and status = 'pendente' and origem = 'proposta';

  insert into public.retornos (lead_id, data_prevista, origem, ciclo)
  values (v_lead.id, p_data_retorno, 'proposta', v_ciclo);

  insert into public.eventos (lead_id, tipo, dados)
  values (
    v_lead.id,
    'proposta_enviada',
    jsonb_build_object(
      'proposta_id', p_proposta_id,
      'versao', v_versao.numero,
      'total_unico', v_versao.total_unico_centavos,
      'total_recorrente', v_versao.total_recorrente_centavos
    )
  );
end;
$$;

create function public.recusar_proposta(p_proposta_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_proposta public.propostas;
begin
  select lead_id into v_lead_id from public.propostas where id = p_proposta_id;
  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'P0001';
  end if;
  perform 1 from public.leads where id = v_lead_id for update;
  select * into v_proposta from public.propostas where id = p_proposta_id for update;

  if v_proposta.status = 'aceita' then
    raise exception 'Proposta aceita não pode ser alterada.' using errcode = 'P0001';
  elsif v_proposta.status = 'recusada' then
    raise exception 'Esta proposta já foi recusada.' using errcode = 'P0001';
  end if;

  update public.propostas set status = 'recusada', updated_at = now() where id = p_proposta_id;

  update public.retornos set status = 'cancelado'
  where lead_id = v_lead_id and status = 'pendente' and origem = 'proposta';

  insert into public.eventos (lead_id, tipo, dados)
  values (v_lead_id, 'proposta_recusada', jsonb_build_object('proposta_id', p_proposta_id));
end;
$$;

revoke execute on function public.criar_proposta(uuid, text) from public, anon;
grant execute on function public.criar_proposta(uuid, text) to authenticated;
revoke execute on function public.salvar_itens_versao(uuid, jsonb, bigint, bigint) from public, anon;
grant execute on function public.salvar_itens_versao(uuid, jsonb, bigint, bigint) to authenticated;
revoke execute on function public.nova_versao(uuid) from public, anon;
grant execute on function public.nova_versao(uuid) to authenticated;
revoke execute on function public.enviar_proposta(uuid, date) from public, anon;
grant execute on function public.enviar_proposta(uuid, date) to authenticated;
revoke execute on function public.recusar_proposta(uuid) from public, anon;
grant execute on function public.recusar_proposta(uuid) to authenticated;
