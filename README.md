# CRM Integra Sistemas

CRM pessoal (Next.js + Supabase local). Desenvolvimento apenas local.

## Como rodar

1. Abra o Docker Desktop e rode `npm install`.
2. `npm run db:start` sobe o Supabase local (API em `http://127.0.0.1:54321`).
3. Rode `npx supabase status` e copie as chaves para `.env.local` e `.env.test.local`, seguindo o modelo de `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
4. `npm run dev` inicia o app em `http://localhost:3000`.
5. Pelo celular, na mesma rede Wi-Fi: `http://<ip-do-pc>:3000`.

## Testes

- `npm test` - testes unitarios.
- `npm run test:int` - testes de integracao (exigem o Supabase local no ar e `.env.test.local`).
- `npm run db:reset` recria o banco local a partir das migrations.
