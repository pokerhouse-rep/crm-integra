-- Aceite da proposta: contrato, itens e cobranças iniciais numa única transação.
-- Ordem de locks: lead primeiro, depois proposta (igual às demais funções de proposta).
-- p_itens: [{descricao, tipo, valor_centavos (líquido), parcelas, mes_inicio}] na ordem dos itens.
-- p_cobrancas: [{item_indice, tipo, numero, total_parcelas, competencia, vencimento, valor_centavos}].

create function public.aceitar_proposta(
  p_proposta_id uuid,
  p_versao_id uuid,
  p_descricao text,
  p_dia_vencimento int,
  p_data_inicio date,
  p_itens jsonb,
  p_cobrancas jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_lead public.leads;
  v_proposta public.propostas;
  v_versao public.versoes_proposta;
  v_itens_versao int;
  v_contrato_id uuid;
  v_item_ids uuid[] := '{}';
  v_item_id uuid;
  e record;
begin
  select lead_id into v_lead_id from public.propostas where id = p_proposta_id;
  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'P0001';
  end if;
  select * into v_lead from public.leads where id = v_lead_id for update;
  select * into v_proposta from public.propostas where id = p_proposta_id for update;

  if v_proposta.status = 'aceita' then
    raise exception 'Esta proposta já foi aceita.' using errcode = 'P0001';
  elsif v_proposta.status = 'recusada' then
    raise exception 'Proposta recusada: crie uma nova versão antes de aceitar.' using errcode = 'P0001';
  end if;

  select * into v_versao
  from public.versoes_proposta
  where proposta_id = p_proposta_id
  order by numero desc
  limit 1
  for update;

  if v_versao.id is distinct from p_versao_id then
    raise exception 'A proposta mudou. Atualize a página e tente de novo.' using errcode = 'P0001';
  end if;

  select count(*) into v_itens_versao from public.itens_proposta where versao_id = v_versao.id;
  if v_itens_versao = 0
     or p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A proposta não tem itens.' using errcode = 'P0001';
  end if;
  if p_cobrancas is null or jsonb_typeof(p_cobrancas) <> 'array' then
    raise exception 'Cobranças inválidas.' using errcode = 'P0001';
  end if;
  if p_dia_vencimento is null or p_dia_vencimento not between 1 and 28 then
    raise exception 'O dia de vencimento deve ser entre 1 e 28.' using errcode = 'P0001';
  end if;

  insert into public.contratos (lead_id, proposta_id, descricao, dia_vencimento, data_inicio)
  values (v_lead.id, p_proposta_id, p_descricao, p_dia_vencimento, p_data_inicio)
  returning id into v_contrato_id;

  for e in select item, ord from jsonb_array_elements(p_itens) with ordinality as t(item, ord) order by ord loop
    insert into public.contrato_itens (contrato_id, ordem, descricao, tipo, valor_centavos, parcelas, mes_inicio)
    values (
      v_contrato_id,
      (e.ord - 1)::int,
      e.item->>'descricao',
      (e.item->>'tipo')::public.tipo_valor,
      (e.item->>'valor_centavos')::bigint,
      coalesce((e.item->>'parcelas')::int, 1),
      nullif(e.item->>'mes_inicio', '')::date
    )
    returning id into v_item_id;
    v_item_ids := v_item_ids || v_item_id;
  end loop;

  for e in select c from jsonb_array_elements(p_cobrancas) as t(c) loop
    insert into public.cobrancas (
      contrato_id, contrato_item_id, lead_id, tipo, numero, total_parcelas, competencia, vencimento, valor_centavos
    )
    values (
      v_contrato_id,
      v_item_ids[(e.c->>'item_indice')::int + 1],
      v_lead.id,
      (e.c->>'tipo')::public.tipo_cobranca,
      (e.c->>'numero')::int,
      (e.c->>'total_parcelas')::int,
      nullif(e.c->>'competencia', '')::date,
      (e.c->>'vencimento')::date,
      (e.c->>'valor_centavos')::bigint
    );
  end loop;

  update public.propostas
  set status = 'aceita', aceita_em = p_data_inicio, updated_at = now()
  where id = p_proposta_id;

  if v_lead.etapa <> 'fechado' then
    perform public.mover_etapa(v_lead.id, 'fechado', null);
  else
    update public.retornos set status = 'cancelado'
    where lead_id = v_lead.id and status = 'pendente' and origem = 'proposta';
  end if;

  insert into public.eventos (lead_id, tipo, dados)
  values (
    v_lead.id,
    'proposta_aceita',
    jsonb_build_object('proposta_id', p_proposta_id, 'versao', v_versao.numero, 'contrato_id', v_contrato_id)
  );

  return v_contrato_id;
end;
$$;

revoke execute on function public.aceitar_proposta(uuid, uuid, text, int, date, jsonb, jsonb) from public, anon;
grant execute on function public.aceitar_proposta(uuid, uuid, text, int, date, jsonb, jsonb) to authenticated;
