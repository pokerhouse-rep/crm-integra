-- A função só deve rodar pelo trigger de novo usuário, nunca via API.
revoke execute on function public.criar_dados_padrao() from public, anon, authenticated;
