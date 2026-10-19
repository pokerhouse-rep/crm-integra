-- Reforços de integridade no banco (Plano 3, D17).

alter table public.itens_proposta
  add constraint itens_proposta_desconto_valor_ck check (
    desconto_tipo is null
    or (desconto_tipo = 'valor' and desconto_valor > 0 and desconto_valor < valor_centavos)
    or (desconto_tipo = 'percentual' and desconto_valor between 1 and 9999)
  ),
  add constraint itens_proposta_valor_max_ck check (valor_centavos <= 1000000000);

alter table public.contrato_itens
  add constraint contrato_itens_parcelas_ck check (parcelas between 1 and 48);

alter table public.cobrancas
  add constraint cobrancas_numero_ck check (
    numero is null or (numero >= 1 and (total_parcelas is null or numero <= total_parcelas))
  ),
  add constraint cobrancas_total_parcelas_ck check (total_parcelas is null or total_parcelas between 1 and 48);

-- O link do MVP é renderizado como href: só aceita http(s).
alter table public.leads
  add constraint leads_link_mvp_ck check (link_mvp is null or link_mvp ~* '^https?://');

create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.tocar_updated_at() from public, anon;
grant execute on function public.tocar_updated_at() to authenticated;

create trigger propostas_updated_at
  before update on public.propostas
  for each row execute function public.tocar_updated_at();
