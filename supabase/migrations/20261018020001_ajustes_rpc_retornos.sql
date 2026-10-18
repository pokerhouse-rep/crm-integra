-- Ajustes das RPCs de retorno: permissões (só usuários autenticados) e ordem de locks
-- (lead primeiro, depois retorno), igual a mover_etapa, para evitar deadlock.

create or replace function public.aplicar_resultado(
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
  v_lead_id uuid;
  v_pendentes int;
  v_etapa_mudou boolean;
begin
  -- Descobre o lead sem travar; trava o lead primeiro e só depois o retorno.
  select lead_id into v_lead_id from public.retornos where id = p_retorno_id;
  if not found then
    raise exception 'Retorno não encontrado.' using errcode = 'P0001';
  end if;

  select * into v_lead from public.leads where id = v_lead_id for update;

  select * into v_retorno from public.retornos where id = p_retorno_id for update;
  if not found then
    raise exception 'Retorno não encontrado.' using errcode = 'P0001';
  end if;
  if v_retorno.status <> 'pendente' then
    raise exception 'Este retorno já foi registrado.' using errcode = 'P0001';
  end if;

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

revoke execute on function public.aplicar_resultado(
  uuid, public.resultado_retorno, int, boolean, public.etapa, jsonb, text, uuid, date
) from public, anon;
grant execute on function public.aplicar_resultado(
  uuid, public.resultado_retorno, int, boolean, public.etapa, jsonb, text, uuid, date
) to authenticated;

revoke execute on function public.mover_etapa(uuid, public.etapa, uuid) from public, anon;
grant execute on function public.mover_etapa(uuid, public.etapa, uuid) to authenticated;
