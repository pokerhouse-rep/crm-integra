# CRM Integra Sistemas

CRM pessoal (Next.js + Supabase local). Desenvolvimento apenas local.

## Como rodar

1. Abra o Docker Desktop e rode `npm install`.
2. `npm run db:start` sobe o Supabase local (API em `http://127.0.0.1:54421`).
   As portas foram deslocadas +100 (db 54422, studio 54423) para nao colidir com outro Supabase local.
3. Rode `npx supabase status` e copie as chaves para `.env.local` e `.env.test.local`, seguindo o modelo de `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
4. Crie o usuario unico: `npx tsx scripts/criar-usuario.ts <email> <senha>`. Credencial de desenvolvimento em `.env.local` (`DEV_LOGIN_EMAIL` / `DEV_LOGIN_SENHA`).
5. `npm run dev` inicia o app em `http://localhost:3000`.
6. Pelo celular, na mesma rede Wi-Fi: `http://<ip-do-pc>:3000`.

## Testes

- `npm test` - testes unitarios.
- `npm run test:int` - testes de integracao (exigem o Supabase local no ar e `.env.test.local`).
- `npm run db:reset` recria o banco local a partir das migrations.

## Celular e rede local

- Com o PC e o celular no mesmo Wi-Fi, abra `http://<ip-do-pc>:3000` no navegador do celular (descubra o IP com `ipconfig`, campo "Endereco IPv4"). Rode o app com `npm run dev -- -H 0.0.0.0` se ele nao responder por fora do PC.
- Se nao abrir, o Firewall do Windows provavelmente esta bloqueando a porta 3000. Isso e decisao do dono; o projeto nao altera o firewall. Para liberar por conta propria: PowerShell **como administrador**, `New-NetFirewallRule -DisplayName "CRM Integra dev 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private`. Para desfazer: `Remove-NetFirewallRule -DisplayName "CRM Integra dev 3000"`.
- PWA: ha manifest e icones (gerados da logo com `python -I scripts/gerar-icones.py`), mas nao ha service worker nem cache offline. A instalacao como app no celular exige HTTPS fora de `localhost`; na rede local o celular usa o app pelo navegador normalmente. A instalacao completa vem quando o dono autorizar a hospedagem.

## Propostas, clientes e cobrancas

- No lead, crie uma proposta com itens do catalogo (valor unico em ate 48 parcelas e/ou mensalidade), com desconto em % ou R$. Cada versao enviada fica congelada; para mudar, crie uma nova versao. Enviar leva o lead para "Proposta enviada" (v1) ou "Negociacao" (v2 em diante) e agenda um retorno em 3 dias.
- Aceitar a proposta cria o contrato e transforma o lead em cliente. As parcelas viram cobrancas previstas; as mensalidades sao geradas ate o mes seguinte sempre que "Hoje" ou "Clientes" abrem.
- A aba **Clientes** mostra contratos (pausar, reativar, cancelar, reajustar) e o painel de cobrancas do mes. Marcar como recebida e 1 toque. Cobrancas vencidas e lembretes (3 dias antes) aparecem em "Hoje".

### Simular vencimentos (teste local)

Abra o Studio local em `http://127.0.0.1:54423` (SQL Editor) ou use `psql` na porta 54422 e mude as datas. Use a data de Palmas, e nao `current_date`: o banco roda em UTC e, depois das 21h, `current_date` ja e o dia seguinte.

```sql
-- deixar uma cobranca atrasada
update public.cobrancas set vencimento = (now() at time zone 'America/Araguaina')::date - 5 where id = '<id>';
-- fazer um retorno pos-proposta cair hoje
update public.retornos set data_prevista = (now() at time zone 'America/Araguaina')::date
 where origem = 'proposta' and status = 'pendente';
```
