-- Importação em lote de leads (security invoker: RLS do chamador continua valendo).
-- Duplicados por (user_id, whatsapp) são ignorados; cada lead inserido ganha o evento 'criado' com {"importado": true}.

create function public.importar_leads(p_leads jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total int;
  v_importados int;
begin
  if p_leads is null or jsonb_typeof(p_leads) <> 'array' then
    raise exception 'Lista de leads inválida.' using errcode = 'P0001';
  end if;
  v_total := jsonb_array_length(p_leads);
  if v_total > 1000 then
    raise exception 'Importe no máximo 1000 leads por vez.' using errcode = 'P0001';
  end if;

  with novos as (
    insert into public.leads (
      nome_contato, whatsapp, empresa, email, cidade, nicho_id, origem_id, link_mvp, observacoes
    )
    select
      btrim(x.nome_contato), x.whatsapp, nullif(btrim(x.empresa), ''), nullif(btrim(x.email), ''),
      nullif(btrim(x.cidade), ''), x.nicho_id, x.origem_id, nullif(btrim(x.link_mvp), ''),
      nullif(btrim(x.observacoes), '')
    from jsonb_to_recordset(p_leads) as x(
      nome_contato text, whatsapp text, empresa text, email text, cidade text,
      nicho_id uuid, origem_id uuid, link_mvp text, observacoes text
    )
    on conflict (user_id, whatsapp) do nothing
    returning id
  ),
  eventos_criados as (
    insert into public.eventos (lead_id, tipo, dados)
    select id, 'criado', jsonb_build_object('importado', true) from novos
    returning 1
  )
  select count(*) into v_importados from novos;

  return jsonb_build_object('importados', v_importados, 'ignorados', v_total - v_importados);
end;
$$;

revoke execute on function public.importar_leads(jsonb) from public, anon;
grant execute on function public.importar_leads(jsonb) to authenticated;
