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
  if jsonb_array_length(p_itens) <> v_itens_versao then
    raise exception 'A proposta mudou. Atualize a página e tente de novo.' using errcode = 'P0001';
  end if;
  if p_descricao is null or btrim(p_descricao) = '' then
    raise exception 'Informe a descrição do contrato.' using errcode = 'P0001';
  end if;
  if p_cobrancas is null or jsonb_typeof(p_cobrancas) <> 'array' then
    raise exception 'Cobranças inválidas.' using errcode = 'P0001';
  end if;
  if p_dia_vencimento is null or p_dia_vencimento not between 1 and 28 then
    raise exception 'O dia de vencimento deve ser entre 1 e 28.' using errcode = 'P0001';
  end if;

  for e in select c from jsonb_array_elements(p_cobrancas) as t(c) loop
    if (e.c->>'item_indice') is null
       or (e.c->>'item_indice')::int < 0
       or (e.c->>'item_indice')::int >= jsonb_array_length(p_itens) then
      raise exception 'Dados do aceite inválidos.' using errcode = 'P0001';
    end if;
  end loop;

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

-- Marcar cobrança como paga (1 toque). Bloqueia a linha para o toque duplo falhar com mensagem clara.
create function public.marcar_pago(p_cobranca_id uuid, p_pago_em date, p_valor_pago bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_cobranca public.cobrancas;
  v_valor bigint;
begin
  select lead_id into v_lead_id from public.cobrancas where id = p_cobranca_id;
  if not found then
    raise exception 'Cobrança não encontrada.' using errcode = 'P0001';
  end if;
  perform 1 from public.leads where id = v_lead_id for update;
  select * into v_cobranca from public.cobrancas where id = p_cobranca_id for update;

  if v_cobranca.status = 'paga' then
    raise exception 'Esta cobrança já foi paga.' using errcode = 'P0001';
  elsif v_cobranca.status = 'suspensa' then
    raise exception 'Cobrança suspensa: reative o contrato para receber.' using errcode = 'P0001';
  end if;
  if p_pago_em is null then
    raise exception 'Informe a data do pagamento.' using errcode = 'P0001';
  end if;
  -- p_valor_pago nulo = o valor da própria cobrança, lido depois do lock.
  if p_valor_pago is not null and p_valor_pago <= 0 then
    raise exception 'Valor recebido inválido.' using errcode = 'P0001';
  end if;
  v_valor := coalesce(p_valor_pago, v_cobranca.valor_centavos);

  update public.cobrancas
  set status = 'paga', pago_em = p_pago_em, valor_pago_centavos = v_valor
  where id = p_cobranca_id;

  insert into public.eventos (lead_id, tipo, dados)
  values (v_cobranca.lead_id, 'cobranca_paga',
    jsonb_build_object('cobranca_id', p_cobranca_id, 'valor', v_valor));
end;
$$;

create function public.desfazer_pagamento(p_cobranca_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_cobranca public.cobrancas;
begin
  select lead_id into v_lead_id from public.cobrancas where id = p_cobranca_id;
  if not found then
    raise exception 'Cobrança não encontrada.' using errcode = 'P0001';
  end if;
  perform 1 from public.leads where id = v_lead_id for update;
  select * into v_cobranca from public.cobrancas where id = p_cobranca_id for update;

  if v_cobranca.status <> 'paga' then
    raise exception 'Esta cobrança não está paga.' using errcode = 'P0001';
  end if;

  update public.cobrancas
  set status = 'aberta', pago_em = null, valor_pago_centavos = null
  where id = p_cobranca_id;

  insert into public.eventos (lead_id, tipo, dados)
  values (v_cobranca.lead_id, 'pagamento_desfeito', jsonb_build_object('cobranca_id', p_cobranca_id));
end;
$$;

revoke execute on function public.marcar_pago(uuid, date, bigint) from public, anon;
grant execute on function public.marcar_pago(uuid, date, bigint) to authenticated;
revoke execute on function public.desfazer_pagamento(uuid) from public, anon;
grant execute on function public.desfazer_pagamento(uuid) to authenticated;

-- Ciclo de vida do contrato. Ordem de locks: lead primeiro, depois contrato.
-- Trava o contrato (lead antes); falha se não existir ou estiver cancelado.
create function public.travar_contrato(p_contrato_id uuid)
returns public.contratos
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_contrato public.contratos;
begin
  select lead_id into v_lead_id from public.contratos where id = p_contrato_id;
  if not found then
    raise exception 'Contrato não encontrado.' using errcode = 'P0001';
  end if;
  perform 1 from public.leads where id = v_lead_id for update;
  select * into v_contrato from public.contratos where id = p_contrato_id for update;
  if not found then
    raise exception 'Contrato não encontrado.' using errcode = 'P0001';
  end if;
  if v_contrato.status = 'cancelado' then
    raise exception 'Contrato cancelado não pode ser alterado.' using errcode = 'P0001';
  end if;
  return v_contrato;
end;
$$;

create function public.pausar_contrato(p_contrato_id uuid, p_hoje date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contrato public.contratos;
begin
  v_contrato := public.travar_contrato(p_contrato_id);
  if v_contrato.status <> 'ativo' then
    raise exception 'Este contrato não está ativo.' using errcode = 'P0001';
  end if;
  if p_hoje is null then
    raise exception 'Informe a data.' using errcode = 'P0001';
  end if;

  update public.cobrancas set status = 'suspensa'
  where contrato_id = p_contrato_id and status = 'aberta' and vencimento >= p_hoje;

  update public.contratos set status = 'pausado', pausado_em = p_hoje where id = p_contrato_id;

  insert into public.eventos (lead_id, tipo, dados)
  values (v_contrato.lead_id, 'contrato_pausado', jsonb_build_object('contrato_id', p_contrato_id));
end;
$$;

create function public.reativar_contrato(p_contrato_id uuid, p_hoje date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contrato public.contratos;
begin
  v_contrato := public.travar_contrato(p_contrato_id);
  if v_contrato.status <> 'pausado' then
    raise exception 'Este contrato não está pausado.' using errcode = 'P0001';
  end if;
  if p_hoje is null then
    raise exception 'Informe a data.' using errcode = 'P0001';
  end if;

  -- Parcelas e à vista voltam a abertas; mensalidades só se vencerem de hoje em diante.
  update public.cobrancas set status = 'aberta'
  where contrato_id = p_contrato_id and status = 'suspensa'
    and (tipo <> 'mensalidade' or vencimento >= p_hoje);

  update public.contratos set status = 'ativo', pausado_em = null where id = p_contrato_id;

  insert into public.eventos (lead_id, tipo, dados)
  values (v_contrato.lead_id, 'contrato_reativado', jsonb_build_object('contrato_id', p_contrato_id));
end;
$$;

create function public.cancelar_contrato(p_contrato_id uuid, p_hoje date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contrato public.contratos;
begin
  v_contrato := public.travar_contrato(p_contrato_id);
  if p_hoje is null then
    raise exception 'Informe a data.' using errcode = 'P0001';
  end if;

  if v_contrato.status = 'pausado' then
    -- Parcelas e à vista suspensas já vencidas continuam devidas; mensalidades dos meses pausados não são cobradas.
    update public.cobrancas set status = 'aberta'
    where contrato_id = p_contrato_id and status = 'suspensa' and tipo <> 'mensalidade' and vencimento < p_hoje;
    delete from public.cobrancas
    where contrato_id = p_contrato_id and status = 'suspensa' and tipo = 'mensalidade' and vencimento < p_hoje;
  end if;

  delete from public.cobrancas
  where contrato_id = p_contrato_id and status in ('aberta', 'suspensa') and vencimento >= p_hoje;

  update public.contratos set status = 'cancelado', cancelado_em = p_hoje where id = p_contrato_id;

  insert into public.eventos (lead_id, tipo, dados)
  values (v_contrato.lead_id, 'contrato_cancelado', jsonb_build_object('contrato_id', p_contrato_id));
end;
$$;

create function public.reajustar_item(p_item_id uuid, p_a_partir_de date, p_valor bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.contrato_itens;
  v_contrato public.contratos;
  v_ate date;
begin
  select * into v_item from public.contrato_itens where id = p_item_id;
  if not found then
    raise exception 'Item não encontrado.' using errcode = 'P0001';
  end if;
  v_contrato := public.travar_contrato(v_item.contrato_id);
  if v_item.tipo <> 'recorrente' then
    raise exception 'Só mensalidades podem ser reajustadas.' using errcode = 'P0001';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe o novo valor da mensalidade.' using errcode = 'P0001';
  end if;
  if p_a_partir_de is null or p_a_partir_de <> date_trunc('month', p_a_partir_de)::date then
    raise exception 'Informe o mês do reajuste.' using errcode = 'P0001';
  end if;

  insert into public.reajustes (contrato_item_id, a_partir_de, valor_centavos)
  values (p_item_id, p_a_partir_de, p_valor)
  on conflict (contrato_item_id, a_partir_de) do update set valor_centavos = excluded.valor_centavos;

  -- Vale até o próximo reajuste do mesmo item (que tem valor próprio).
  select min(a_partir_de) into v_ate
  from public.reajustes where contrato_item_id = p_item_id and a_partir_de > p_a_partir_de;

  update public.cobrancas set valor_centavos = p_valor
  where contrato_item_id = p_item_id and tipo = 'mensalidade' and status in ('aberta', 'suspensa')
    and competencia >= p_a_partir_de and (v_ate is null or competencia < v_ate);

  insert into public.eventos (lead_id, tipo, dados)
  values (v_contrato.lead_id, 'contrato_reajustado',
    jsonb_build_object('item', p_item_id, 'valor', p_valor, 'a_partir_de', p_a_partir_de));
end;
$$;

revoke execute on function public.travar_contrato(uuid) from public, anon;
revoke execute on function public.pausar_contrato(uuid, date) from public, anon;
grant execute on function public.pausar_contrato(uuid, date) to authenticated;
revoke execute on function public.reativar_contrato(uuid, date) from public, anon;
grant execute on function public.reativar_contrato(uuid, date) to authenticated;
revoke execute on function public.cancelar_contrato(uuid, date) from public, anon;
grant execute on function public.cancelar_contrato(uuid, date) to authenticated;
revoke execute on function public.reajustar_item(uuid, date, bigint) from public, anon;
grant execute on function public.reajustar_item(uuid, date, bigint) to authenticated;
grant execute on function public.travar_contrato(uuid) to authenticated;
