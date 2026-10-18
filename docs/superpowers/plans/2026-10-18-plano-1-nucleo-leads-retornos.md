# Plano 1 — Núcleo: leads, retornos e agenda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o núcleo usável do CRM: login, cadastro e histórico de leads, funil, sequência automática de retornos com WhatsApp, tela "Hoje", agenda de tarefas e configurações básicas, rodando localmente no PC e acessível no celular pela rede local.

**Architecture:** Next.js (App Router) com Server Components e Server Actions; dados e autenticação no Supabase **local** (Docker). As regras de negócio (datas, sequência, resultado de retorno, telefone/WhatsApp) ficam em funções TypeScript puras em `src/lib/dominio/`, testadas com Vitest. Uma camada de serviço (`src/lib/servicos/`) recebe um `SupabaseClient`, aplica os planos gerados pelo domínio no banco e é testada contra o Supabase local. A interface só chama serviços.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, @supabase/supabase-js + @supabase/ssr, Supabase CLI (devDependency, local via Docker), Vitest, @dnd-kit/core (kanban), lucide-react (ícones).

**Spec:** `docs/superpowers/specs/2026-10-18-crm-integra-sistemas-design.md`

**Planos seguintes (fora deste):** Plano 2: propostas, versões, contratos e cobranças (spec §4.6, §4.7, retorno após proposta). Plano 3: relatórios e indicadores (§4.8), importação/exportação (§4.9 export, §4.10 import) e painel do dia completo com cobranças.

## Global Constraints

- **PROIBIDO:** criar repositório no GitHub, usar Supabase na nuvem ou fazer deploy na Vercel. Nada de `git push`, `supabase link`, `vercel`. Só desenvolvimento local.
- O repositório git é o de `C:\Users\PC\Desktop\CRM Integra Sistemas`. Nunca commitar no repo de `C:\Users\PC`.
- Toda a interface em **pt-BR**. Datas exibidas como `dd/mm/aaaa`; moeda `R$` (Plano 2).
- Fuso de "hoje": `America/Araguaina`.
- Datas de agenda armazenadas como `date` (`'YYYY-MM-DD'` no TS); histórico como `timestamptz`.
- Valores monetários em centavos (inteiro). Não se aplica a este plano, mas o schema não deve contrariar isso.
- Prazos em **dias corridos**; se caírem em sábado/domingo, passam para a segunda-feira seguinte. **Datas escolhidas manualmente pelo usuário são respeitadas sem ajuste.**
- Sequência padrão: **D+2, D+5, D+10**. Reativação de frio: **30 dias**. Retorno após proposta: **3 dias** (Plano 2). Lembrete de cobrança: **3 dias** (Plano 2). Todos configuráveis.
- O sistema **nunca** move um lead para "Perdido" sozinho. Só por ação do usuário ("Sem interesse" ou "Marcar como perdido").
- Lead frio: ciclos de reativação **sem limite**.
- Celular primeiro: alvos de toque com pelo menos 44px; a tela "Hoje" usável com uma mão.
- Cores da logo (`docs/assets/logo-integra-sistemas.png`): marinho `#0B3A63` (principal), laranja `#D9782D` (ação/destaque), azul-claro `#29ABE2` (apoio). Confirmar os hex com um conta-gotas na logo e ajustar os tokens se divergirem.

## Review Focus

1. **WhatsApp digitado em qualquer formato** (`(63) 99999-0000`, `+55 63 9 9999-0000`, fixo com 10 dígitos): deve ser normalizado para `55` + DDD + número. Entrada inválida é rejeitada com mensagem clara, nunca salva quebrada. Teste na Task 3.
2. **Toque duplo em um resultado** (rede lenta, clique repetido): registrar resultado num retorno que não está `pendente` não pode criar retornos duplicados nem um ciclo frio em dobro. Teste na Task 7.
3. **"Hoje" perto da meia-noite:** às 22h em Palmas (01h UTC do dia seguinte), "Hoje" ainda é o dia local. Teste na Task 2.
4. **Usuário removeu todos os retornos pendentes à mão:** o lead não vira frio sozinho. Ele só vira frio quando um "Sem resposta" é registrado e não sobra retorno pendente. Teste na Task 4.
5. **Lead frio que responde na reativação:** o status frio é limpo, os retornos pendentes do ciclo são cancelados e o lead vai para "Em conversa". Teste na Task 4.

---

## Estrutura de arquivos

```
src/
  app/
    layout.tsx                 # html pt-BR, fonte, tokens
    globals.css                # Tailwind v4 + tokens de cor
    login/page.tsx             # login e-mail/senha
    (app)/layout.tsx           # shell autenticado: barra inferior (celular) / lateral (PC) + busca
    (app)/hoje/page.tsx
    (app)/leads/page.tsx       # lista + filtros
    (app)/leads/novo/page.tsx
    (app)/leads/[id]/page.tsx  # detalhe: dados, retornos, linha do tempo
    (app)/leads/[id]/editar/page.tsx
    (app)/funil/page.tsx       # kanban
    (app)/agenda/page.tsx      # semana + tarefas
    (app)/config/page.tsx      # configurações
    (app)/busca/page.tsx
    manifest.ts                # PWA
  components/                  # componentes de UI por tela (ex.: hoje/CartaoRetorno.tsx)
  lib/
    dominio/datas.ts
    dominio/telefone.ts
    dominio/mensagens.ts
    dominio/sequencia.ts
    dominio/tipos.ts           # Etapa, Resultado, etc.
    supabase/server.ts         # createServerClient (cookies)
    supabase/browser.ts
    servicos/leads.ts
    servicos/retornos.ts
    servicos/tarefas.ts
    servicos/agenda.ts
    servicos/config.ts
  middleware.ts                # protege rotas (app)
supabase/
  config.toml
  migrations/20261018000000_nucleo.sql
scripts/criar-usuario.ts
tests/
  unit/*.test.ts
  integracao/helpers.ts
  integracao/*.test.ts
public/icons/                  # ícones PWA gerados da logo
```

---

### Task 1: Scaffold do projeto, identidade visual e Supabase local

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `vitest.config.ts`, `.gitignore`, `.env.example`, `supabase/config.toml`, `public/logo.png`, `tests/unit/sanidade.test.ts`, `README.md`

**Interfaces:**
- Produces: scripts npm `dev` (`next dev -H 0.0.0.0`, para acesso pelo celular na rede local), `build`, `test` (Vitest, projeto `unit`), `test:int` (Vitest, projeto `integracao`), `db:start` (`supabase start`), `db:reset` (`supabase db reset`). Tokens CSS `--cor-marinho`, `--cor-laranja`, `--cor-azul`, expostos no Tailwind como `marinho`, `laranja`, `azul`.

- [ ] **Step 1:** Rodar `npx create-next-app@15 . --ts --tailwind --app --src-dir --eslint --import-alias "@/*" --use-npm` na pasta do projeto (que já tem `docs/` e `.git`).
- [ ] **Step 2:** Instalar dependências: `npm i @supabase/supabase-js @supabase/ssr @dnd-kit/core lucide-react` e `npm i -D vitest supabase tsx dotenv`.
- [ ] **Step 3:** Rodar `npx supabase init` (sem `link`). Em `supabase/config.toml`, deixar `[auth] enable_signup = false`.
- [ ] **Step 4:** Configurar `vitest.config.ts` com dois projetos: `unit` (`tests/unit/**`, ambiente node) e `integracao` (`tests/integracao/**`, `fileParallelism: false`, carregando `.env.test.local` via dotenv). Alias `@` → `src`.
- [ ] **Step 5:** Escrever `tests/unit/sanidade.test.ts` com `expect(1 + 1).toBe(2)` e rodar `npm test`. Esperado: 1 passed.
- [ ] **Step 6:** Copiar `docs/assets/logo-integra-sistemas.png` para `public/logo.png`. Em `globals.css`, definir os tokens de cor e o tema Tailwind v4 (`@theme`). Em `layout.tsx`, usar `lang="pt-BR"`, título "CRM Integra Sistemas" e fundo claro. `src/app/page.tsx` redireciona para `/hoje`.
- [ ] **Step 7:** `.gitignore` inclui `.env*.local` e `supabase/.temp`. `.env.example` lista `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. O README explica: `npm run db:start`, copiar as chaves de `npx supabase status` para `.env.local` e `.env.test.local`, `npm run dev`, acessar pelo celular em `http://<ip-do-pc>:3000`.
- [ ] **Step 8:** Rodar `npm run db:start` (Docker precisa estar aberto). Esperado: a saída lista `API URL: http://127.0.0.1:54321`. Rodar `npm run build`. Esperado: build sem erros.
- [ ] **Step 9:** Commit: `git add -A && git commit -m "chore: scaffold Next.js + Supabase local + Vitest"`.

---

### Task 2: Domínio — datas

**Files:**
- Create: `src/lib/dominio/datas.ts`
- Test: `tests/unit/datas.test.ts`

**Interfaces:**
- Produces:
  - `type DataISO = string` (`'YYYY-MM-DD'`)
  - `hojeEmPalmas(agora?: Date): DataISO`
  - `somarDias(data: DataISO, dias: number): DataISO` (dias corridos, aceita negativos)
  - `ajustarFimDeSemana(data: DataISO): DataISO` (sábado → +2, domingo → +1)
  - `agendarPrazo(base: DataISO, dias: number): DataISO` = `ajustarFimDeSemana(somarDias(base, dias))`
  - `formatarDataBR(data: DataISO): string` (`'dd/mm/aaaa'`)
  - `inicioDaSemana(data: DataISO): DataISO` (segunda-feira)

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, it, expect } from 'vitest'
import { hojeEmPalmas, somarDias, ajustarFimDeSemana, agendarPrazo, formatarDataBR, inicioDaSemana } from '@/lib/dominio/datas'

describe('datas', () => {
  it('hoje em Palmas às 22h locais ainda é o mesmo dia', () => {
    // 2026-10-19T01:00Z = 18/10 22:00 em Palmas (UTC-3)
    expect(hojeEmPalmas(new Date('2026-10-19T01:00:00Z'))).toBe('2026-10-18')
  })
  it('soma dias corridos atravessando mês', () => {
    expect(somarDias('2026-10-30', 5)).toBe('2026-11-04')
  })
  it('sábado e domingo vão para segunda', () => {
    expect(ajustarFimDeSemana('2026-10-24')).toBe('2026-10-26') // sábado
    expect(ajustarFimDeSemana('2026-10-25')).toBe('2026-10-26') // domingo
    expect(ajustarFimDeSemana('2026-10-23')).toBe('2026-10-23') // sexta
  })
  it('agendarPrazo: quinta 22/10 + 2 = sábado → segunda 26/10', () => {
    expect(agendarPrazo('2026-10-22', 2)).toBe('2026-10-26')
  })
  it('formata em pt-BR', () => {
    expect(formatarDataBR('2026-10-05')).toBe('05/10/2026')
  })
  it('início da semana é segunda', () => {
    expect(inicioDaSemana('2026-10-18')).toBe('2026-10-12') // domingo → segunda anterior
    expect(inicioDaSemana('2026-10-19')).toBe('2026-10-19')
  })
})
```

- [ ] **Step 2:** `npx vitest run tests/unit/datas.test.ts`. Esperado: FAIL (módulo não existe).
- [ ] **Step 3: Implementar `src/lib/dominio/datas.ts`.** `hojeEmPalmas` usa `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' })`. A aritmética de datas usa `Date.UTC` e `getUTCDay`, nunca o fuso da máquina.
- [ ] **Step 4:** Rodar de novo. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: dominio de datas (dias corridos, fim de semana, fuso Palmas)`.

---

### Task 3: Domínio — telefone, mensagens e link do WhatsApp

**Files:**
- Create: `src/lib/dominio/telefone.ts`, `src/lib/dominio/mensagens.ts`
- Test: `tests/unit/telefone.test.ts`, `tests/unit/mensagens.test.ts`

**Interfaces:**
- Produces:
  - `normalizarTelefone(entrada: string): string | null`: só dígitos. Com 10 ou 11 dígitos, prefixa `55`. Com 12 ou 13 dígitos começando com `55`, mantém. Qualquer outro caso retorna `null`.
  - `formatarTelefone(normalizado: string): string` → `'(63) 99999-0000'`
  - `preencherModelo(texto: string, vars: Record<string, string | null | undefined>): string`: troca `{chave}`. Variável ausente ou nula vira `''`; chave desconhecida fica como está.
  - `linkWhatsApp(telefoneNormalizado: string, texto: string): string` → `https://wa.me/<num>?text=<encodeURIComponent(texto)>`
  - Variáveis suportadas: `{nome}`, `{empresa}`, `{link_mvp}`, `{cidade}`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// telefone.test.ts
expect(normalizarTelefone('(63) 99999-0000')).toBe('5563999990000')
expect(normalizarTelefone('+55 63 9 9999-0000')).toBe('5563999990000')
expect(normalizarTelefone('63 3214-0000')).toBe('556332140000')
expect(normalizarTelefone('99999-0000')).toBeNull()
expect(normalizarTelefone('abc')).toBeNull()
expect(formatarTelefone('5563999990000')).toBe('(63) 99999-0000')
expect(formatarTelefone('556332140000')).toBe('(63) 3214-0000')

// mensagens.test.ts
expect(preencherModelo('Oi {nome}, veja {link_mvp}', { nome: 'Ana', link_mvp: 'https://x.dev' }))
  .toBe('Oi Ana, veja https://x.dev')
expect(preencherModelo('Oi {nome} {empresa}', { nome: 'Ana', empresa: null })).toBe('Oi Ana ')
expect(preencherModelo('{desconhecida}', {})).toBe('{desconhecida}')
expect(linkWhatsApp('5563999990000', 'Olá, tudo bem?'))
  .toBe('https://wa.me/5563999990000?text=Ol%C3%A1%2C%20tudo%20bem%3F')
```

- [ ] **Step 2:** Rodar: FAIL.
- [ ] **Step 3:** Implementar os dois módulos.
- [ ] **Step 4:** Rodar: PASS.
- [ ] **Step 5:** Commit: `feat: dominio de telefone, modelos de mensagem e link WhatsApp`.

---

### Task 4: Domínio — sequência de retornos e resultado

**Files:**
- Create: `src/lib/dominio/tipos.ts`, `src/lib/dominio/sequencia.ts`
- Test: `tests/unit/sequencia.test.ts`

**Interfaces:**
- Consumes: `agendarPrazo`, `somarDias` (Task 2).
- Produces (`tipos.ts`):
  - `type Etapa = 'prospect' | 'mvp_enviado' | 'em_conversa' | 'proposta_enviada' | 'negociacao' | 'fechado' | 'perdido'`
  - `const ETAPAS: { valor: Etapa; rotulo: string }[]` com os rótulos: Prospect, MVP enviado, Em conversa, Proposta enviada, Negociação, Fechado, Perdido
  - `type Resultado = 'respondeu' | 'pediu_tempo' | 'sem_interesse' | 'sem_resposta'`
  - `type OrigemRetorno = 'sequencia' | 'reativacao' | 'adiado' | 'manual' | 'proposta'`
- Produces (`sequencia.ts`):
  - `gerarDatasSequencia(base: DataISO, offsets: number[]): DataISO[]` = `offsets.map(o => agendarPrazo(base, o))`
  - `gerarDatasReativacao(hoje: DataISO, offsets: number[], diasReativacao: number): DataISO[]`: o 1º retorno cai em `hoje + diasReativacao` e os demais mantêm os intervalos da sequência, ou seja, `agendarPrazo(hoje, diasReativacao + (o - offsets[0]))`. Com `[2,5,10]` e 30, os prazos ficam em +30, +33 e +38.
  - `planejarResultado(e: EntradaResultado): PlanoResultado`

```ts
interface EntradaResultado {
  resultado: Resultado
  hoje: DataISO
  novaData?: DataISO            // obrigatório se 'pediu_tempo'
  pendentesRestantes: number    // pendentes do lead, sem contar o retorno atual
  offsetsPadrao: number[]
  diasReativacao: number
}
interface PlanoResultado {
  cancelarPendentes: boolean
  novaEtapa: Etapa | null
  novosRetornos: { data: DataISO; origem: OrigemRetorno }[]
  frio: 'marcar' | 'limpar' | 'manter'
  pedirMotivoPerda: boolean
}
```

Regras (copiar exatamente):

| resultado | cancelarPendentes | novaEtapa | novosRetornos | frio | pedirMotivoPerda |
|---|---|---|---|---|---|
| respondeu | true | `em_conversa` | [] | limpar | false |
| pediu_tempo | true | null | `[{data: novaData, origem: 'adiado'}]` (sem ajuste de fim de semana) | limpar | false |
| sem_interesse | true | `perdido` | [] | limpar | true |
| sem_resposta, pendentesRestantes > 0 | false | null | [] | manter | false |
| sem_resposta, pendentesRestantes = 0 | false | null | `gerarDatasReativacao(...)` com origem `reativacao` | marcar | false |

`planejarResultado` lança `Error('novaData obrigatória')` se o resultado for `pediu_tempo` sem `novaData`.

- [ ] **Step 1: Escrever os testes que falham**, cobrindo cada linha da tabela e mais:

```ts
it('gera D+2, D+5, D+10 ajustando fim de semana', () => {
  // base segunda 19/10: +2=21/10 qua, +5=24/10 sáb→26/10, +10=29/10 qui
  expect(gerarDatasSequencia('2026-10-19', [2,5,10])).toEqual(['2026-10-21','2026-10-26','2026-10-29'])
})
it('reativação mantém os intervalos a partir de +30', () => {
  // 19/10 +30 = 18/11 qua; +33 = 21/11 sáb→23/11; +38 = 26/11 qui
  expect(gerarDatasReativacao('2026-10-19', [2,5,10], 30)).toEqual(['2026-11-18','2026-11-23','2026-11-26'])
})
it('sem resposta com pendentes restantes não vira frio', () => {
  const p = planejarResultado({ resultado: 'sem_resposta', hoje: '2026-10-19', pendentesRestantes: 1, offsetsPadrao: [2,5,10], diasReativacao: 30 })
  expect(p.frio).toBe('manter'); expect(p.novosRetornos).toEqual([])
})
it('último sem resposta vira frio e agenda novo ciclo completo', () => {
  const p = planejarResultado({ resultado: 'sem_resposta', hoje: '2026-10-19', pendentesRestantes: 0, offsetsPadrao: [2,5,10], diasReativacao: 30 })
  expect(p.frio).toBe('marcar')
  expect(p.novosRetornos.map(r => r.data)).toEqual(['2026-11-18','2026-11-23','2026-11-26'])
  expect(p.novaEtapa).toBeNull()
})
it('frio que responde: limpa frio, cancela pendentes e vai para em_conversa', () => {
  const p = planejarResultado({ resultado: 'respondeu', hoje: '2026-11-18', pendentesRestantes: 2, offsetsPadrao: [2,5,10], diasReativacao: 30 })
  expect(p).toMatchObject({ frio: 'limpar', cancelarPendentes: true, novaEtapa: 'em_conversa' })
})
it('pediu tempo respeita a data escolhida, mesmo num sábado', () => {
  const p = planejarResultado({ resultado: 'pediu_tempo', novaData: '2026-10-24', hoje: '2026-10-19', pendentesRestantes: 2, offsetsPadrao: [2,5,10], diasReativacao: 30 })
  expect(p.novosRetornos).toEqual([{ data: '2026-10-24', origem: 'adiado' }])
})
```

- [ ] **Step 2:** Rodar: FAIL.
- [ ] **Step 3:** Implementar `tipos.ts` e `sequencia.ts`.
- [ ] **Step 4:** Rodar: PASS.
- [ ] **Step 5:** Commit: `feat: dominio da sequencia de retornos e resultados`.

---

### Task 5: Schema do banco, RLS e dados padrão

**Files:**
- Create: `supabase/migrations/20261018000000_nucleo.sql`, `tests/integracao/helpers.ts`, `tests/integracao/schema.test.ts`, `scripts/criar-usuario.ts`

**Interfaces:**
- Produces: as tabelas abaixo. Todas têm `user_id uuid not null default auth.uid() references auth.users on delete cascade`, RLS ligada e policy `using (user_id = auth.uid()) with check (user_id = auth.uid())` para todas as operações.
  - Enums: `etapa` (valores de `Etapa`), `resultado_retorno` (valores de `Resultado`), `origem_retorno` (valores de `OrigemRetorno`), `status_retorno` (`pendente`, `feito`, `cancelado`), `tipo_opcao` (`nicho`, `origem`, `motivo_perda`), `tipo_evento` (`criado`, `mvp_enviado`, `retorno_feito`, `etapa_alterada`, `frio`, `reativado`, `anotacao`, `tarefa_concluida`, `dados_editados`).
  - `configuracoes(user_id pk, sequencia_padrao int[] not null default '{2,5,10}', dias_reativacao int default 30, dias_retorno_proposta int default 3, dias_lembrete_cobranca int default 3)`
  - `opcoes(id uuid pk, user_id, tipo tipo_opcao, nome text, ativo bool default true, ordem int default 0, unique(user_id, tipo, nome))`
  - `modelos_mensagem(id, user_id, nome text, texto text, passo int null)`: `passo` = posição na sequência (1, 2, 3...) ou null para avulso
  - `leads(id, user_id, nome_contato text not null, empresa text, whatsapp text not null, email text, cidade text, nicho_id uuid → opcoes, origem_id uuid → opcoes, link_mvp text, mvp_enviado_em date, etapa etapa not null default 'prospect', frio bool default false, motivo_perda_id uuid → opcoes, cliente bool default false, observacoes text, created_at timestamptz default now(), updated_at timestamptz default now(), unique(user_id, whatsapp))`
  - `retornos(id, user_id, lead_id → leads on delete cascade, data_prevista date not null, ciclo int not null default 1, origem origem_retorno not null, status status_retorno not null default 'pendente', resultado resultado_retorno null, feito_em timestamptz null, created_at)`; índice `(user_id, status, data_prevista)`
  - `tarefas(id, user_id, lead_id null → leads on delete cascade, titulo text not null, data date not null, hora time null, feita bool default false, feita_em timestamptz null, created_at)`
  - `eventos(id, user_id, lead_id → leads on delete cascade, tipo tipo_evento not null, dados jsonb default '{}', ocorrido_em timestamptz default now())`; índice `(user_id, tipo, ocorrido_em)`
  - Trigger `after insert on auth.users` → função `security definer` `criar_dados_padrao()` que insere:
    - `configuracoes`;
    - nichos: Corretor de imóveis, Clínica, Restaurante, Loja, Outro;
    - origens: Prospecção ativa, Indicação, Tráfego pago, Site, Outro;
    - motivos de perda: Sem orçamento, Já tem site/sistema, Sem interesse, Não respondeu, Fechou com concorrente, Outro;
    - 3 modelos de mensagem com `passo` 1, 2 e 3, além de um avulso "Primeiro contato" contendo `{nome}` e `{link_mvp}`.
- Produces (`helpers.ts`): `clienteAdmin(): SupabaseClient` (service role); `criarUsuarioTeste(): Promise<{ cliente: SupabaseClient; userId: string }>` (cria um usuário com e-mail aleatório via `auth.admin.createUser`, faz login com o cliente anon e devolve o cliente autenticado).
- Produces (`scripts/criar-usuario.ts`): `npx tsx scripts/criar-usuario.ts <email> <senha>` cria o usuário único no Supabase local via service role.

- [ ] **Step 1: Escrever os testes que falham** em `schema.test.ts`:
  - `novo usuário recebe configurações padrão`: `select sequencia_padrao, dias_reativacao from configuracoes` → `[2,5,10]` e `30`.
  - `novo usuário recebe 5 nichos, 5 origens, 6 motivos e 4 modelos`.
  - `RLS isola usuários`: o usuário A insere um lead; o usuário B faz `select` em `leads` e recebe 0 linhas.
  - `whatsapp duplicado para o mesmo usuário é rejeitado`: o 2º insert com o mesmo `whatsapp` retorna erro com código `23505`.
- [ ] **Step 2:** `npm run test:int -- schema`. Esperado: FAIL (tabelas não existem).
- [ ] **Step 3:** Escrever a migration e o script `criar-usuario.ts`.
- [ ] **Step 4:** `npm run db:reset`, depois `npm run test:int -- schema`. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: schema do nucleo com RLS e dados padrao`.

---

### Task 6: Clientes Supabase, login e proteção de rotas

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/(app)/layout.tsx` (temporário: só cabeçalho com "Sair")

**Interfaces:**
- Produces: `criarClienteServidor(): Promise<SupabaseClient>` (server components/actions, via `@supabase/ssr` com `cookies()`), `criarClienteNavegador(): SupabaseClient`, server actions `entrar(formData)` e `sair()`.
- O middleware redireciona para `/login` quem não tem sessão, em toda rota que não for `/login`, assets ou `manifest`. Quem está logado e abre `/login` vai para `/hoje`.

- [ ] **Step 1:** Implementar os clientes e o middleware seguindo o padrão oficial do `@supabase/ssr` para Next.js App Router (refresh da sessão no middleware).
- [ ] **Step 2:** A página de login tem a logo, campos e-mail e senha e o botão "Entrar". Em caso de erro, mostrar "E-mail ou senha inválidos." Não há link de cadastro.
- [ ] **Step 3:** Criar o usuário local: `npx tsx scripts/criar-usuario.ts <email> <senha>`, com e-mail e senha escolhidos pelo implementador e anotados no README local como credencial **de desenvolvimento**. Não usar dados reais do dono.
- [ ] **Step 4:** Verificar no navegador (`npm run dev`): abrir `/hoje` sem sessão leva a `/login`; login válido leva a `/hoje`; "Sair" volta para `/login`; senha errada mostra a mensagem.
- [ ] **Step 5:** Commit: `feat: autenticacao de usuario unico e protecao de rotas`.

---

### Task 7: Serviços de leads e retornos

**Files:**
- Create: `src/lib/servicos/config.ts`, `src/lib/servicos/leads.ts`, `src/lib/servicos/retornos.ts`
- Test: `tests/integracao/leads.test.ts`, `tests/integracao/retornos.test.ts`

**Interfaces:**
- Consumes: domínio (Tasks 2–4) e `criarUsuarioTeste` (Task 5).
- Produces (todas recebem `db: SupabaseClient` como 1º parâmetro e lançam `ErroNegocio(mensagem)` com texto em pt-BR para erros de regra):
  - `class ErroNegocio extends Error`
  - `obterConfig(db): Promise<Config>` com `Config = { sequenciaPadrao: number[]; diasReativacao: number; diasRetornoProposta: number; diasLembreteCobranca: number }`
  - `criarLead(db, dados: DadosLead): Promise<Lead>`: normaliza o WhatsApp (inválido → `ErroNegocio('WhatsApp inválido. Use DDD + número.')`; duplicado → `ErroNegocio('Já existe um lead com este WhatsApp: <nome>')`) e registra o evento `criado`.
  - `atualizarLead(db, id, dados: Partial<DadosLead>): Promise<Lead>`: evento `dados_editados`.
  - `marcarMvpEnviado(db, leadId, { link?: string; hoje: DataISO }): Promise<void>`: grava `link_mvp` e `mvp_enviado_em`, muda a etapa para `mvp_enviado`, cria os retornos `gerarDatasSequencia(hoje, config.sequenciaPadrao)` (origem `sequencia`, ciclo 1) e registra o evento `mvp_enviado`. Se já houver retornos pendentes, lança `ErroNegocio('Este lead já tem retornos pendentes.')`.
  - `registrarResultado(db, retornoId, { resultado, novaData?, motivoPerdaId?, hoje }): Promise<PlanoResultado>`: lê o retorno. Se o status não for `pendente`, lança `ErroNegocio('Este retorno já foi registrado.')`. Caso contrário, marca o retorno como `feito`, conta os pendentes restantes, chama `planejarResultado` e aplica o plano: cancela pendentes, muda etapa, cria retornos (os de reativação com `ciclo = cicloAtual + 1`), marca ou limpa frio, grava `motivo_perda_id`. Registra o evento `retorno_feito` e também `etapa_alterada` / `frio` quando houver.
  - `moverEtapa(db, leadId, etapa: Etapa, motivoPerdaId?: string): Promise<void>`: ir para `perdido` exige motivo; ir para `perdido` ou `fechado` cancela os pendentes; `fechado` marca `cliente = true`. Registra `etapa_alterada`.
  - `adicionarRetorno(db, leadId, data: DataISO): Promise<void>` (origem `manual`), `alterarDataRetorno(db, retornoId, data: DataISO): Promise<void>`, `cancelarRetorno(db, retornoId): Promise<void>`. Datas manuais não recebem ajuste de fim de semana.
  - `aplicarSequencia(db, leadId, offsets: number[], base: DataISO): Promise<void>`: cancela os pendentes e cria nova sequência com os offsets dados (troca a sequência inteira de um lead).
  - `adicionarAnotacao(db, leadId, texto: string): Promise<void>` → evento `anotacao` com `dados.texto`.
  - `listarLeads(db, filtros: { etapa?: Etapa; nichoId?: string; origemId?: string; frio?: boolean; busca?: string }): Promise<LeadResumo[]>`: `busca` procura em nome, empresa e WhatsApp (dígitos).
  - `obterLead(db, id): Promise<LeadDetalhe>`: inclui retornos (pendentes primeiro) e eventos (mais recentes primeiro).

- [ ] **Step 1: Escrever os testes que falham.** Cada teste cria seu próprio usuário. Os nomes dos testes:
  - `criarLead normaliza whatsapp e registra evento criado`
  - `criarLead rejeita whatsapp duplicado com mensagem citando o lead existente`
  - `marcarMvpEnviado em 2026-10-19 cria retornos 21/10, 26/10, 29/10 e etapa mvp_enviado`
  - `marcarMvpEnviado duas vezes falha com "já tem retornos pendentes"`
  - `respondeu cancela os outros pendentes e move para em_conversa`
  - `três sem_resposta deixam o lead frio com 3 retornos de ciclo 2 a partir de +30`
  - `registrar resultado duas vezes no mesmo retorno falha e não duplica retornos` (Review Focus 2: depois do erro, a contagem de retornos não muda)
  - `cancelar todos os pendentes manualmente não deixa o lead frio` (Review Focus 4)
  - `sem_interesse exige motivo e move para perdido`
  - `pediu_tempo cria um retorno na data escolhida e cancela os demais`
  - `aplicarSequencia troca a sequência do lead`
  - `listarLeads com busca por dígitos do telefone encontra o lead`
- [ ] **Step 2:** `npm run test:int -- leads retornos`. Esperado: FAIL.
- [ ] **Step 3:** Implementar os serviços.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: servicos de leads e retornos`.

---

### Task 8: Serviços de tarefas e agenda (Hoje / Semana)

**Files:**
- Create: `src/lib/servicos/tarefas.ts`, `src/lib/servicos/agenda.ts`
- Test: `tests/integracao/agenda.test.ts`

**Interfaces:**
- Produces:
  - `criarTarefa(db, { titulo, data, hora?, leadId? }): Promise<Tarefa>`, `concluirTarefa(db, id): Promise<void>` (evento `tarefa_concluida` se tiver lead), `reagendarTarefa(db, id, data, hora?)`, `excluirTarefa(db, id)`.
  - `agendaDoDia(db, hoje: DataISO): Promise<AgendaDia>` com `AgendaDia = { atrasados: ItemAgenda[]; hoje: ItemAgenda[] }`. `ItemAgenda` é uma união discriminada `{ tipo: 'retorno'; retorno; lead; passo: number; totalPassos: number; modelo: ModeloMensagem | null } | { tipo: 'tarefa'; tarefa; lead: LeadResumo | null }`. Um item é atrasado quando `data < hoje` e ainda está pendente ou não foi feito. `passo` é a posição do retorno dentro do seu ciclo (1-based); `modelo` é o modelo com `passo` igual, ou o de maior passo existente.
  - `agendaDaSemana(db, inicio: DataISO): Promise<Record<DataISO, ItemAgenda[]>>`: 7 dias a partir de `inicio`, só itens pendentes ou não feitos.

- [ ] **Step 1: Escrever os testes que falham:**
  - `agendaDoDia separa atrasados e de hoje`: retorno em 16/10 e tarefa em 19/10, com hoje 19/10, resultam em `atrasados.length === 1` e `hoje.length === 1`.
  - `retornos feitos e cancelados não aparecem`.
  - `item de retorno traz passo 2 de 3 e o modelo de passo 2`.
  - `agendaDaSemana agrupa por dia`.
- [ ] **Step 2:** Rodar: FAIL. **Step 3:** Implementar. **Step 4:** Rodar: PASS.
- [ ] **Step 5:** Commit: `feat: servicos de tarefas e agenda`.

---

### Task 9: Shell do app, navegação e busca global

**Files:**
- Create/Modify: `src/app/(app)/layout.tsx`, `src/components/shell/BarraInferior.tsx`, `src/components/shell/MenuLateral.tsx`, `src/components/shell/CampoBusca.tsx`, `src/app/(app)/busca/page.tsx`

**Interfaces:**
- Itens de navegação: **Hoje** (`/hoje`), **Leads** (`/leads`), **Funil** (`/funil`), **Agenda** (`/agenda`), **Config** (`/config`).
- Celular (< 768px): barra inferior fixa com ícones e rótulos, e um botão laranja flutuante "+ Lead" → `/leads/novo`. PC: menu lateral marinho com a logo.
- Busca: o campo no topo leva a `/busca?q=`, que usa `listarLeads(db, { busca: q })`.

- [ ] **Step 1:** Implementar o layout, a navegação e a busca com páginas placeholder para as rotas ainda vazias.
- [ ] **Step 2:** Verificar no navegador do PC e em viewport de celular (375×812): a navegação funciona, a barra inferior não cobre o conteúdo e a busca encontra um lead criado via script ou SQL.
- [ ] **Step 3:** Commit: `feat: shell do app com navegacao e busca`.

---

### Task 10: Tela "Hoje"

**Files:**
- Create: `src/app/(app)/hoje/page.tsx`, `src/app/(app)/hoje/actions.ts`, `src/components/hoje/CartaoRetorno.tsx`, `src/components/hoje/CartaoTarefa.tsx`, `src/components/hoje/SeletorNovaData.tsx`, `src/components/leads/DialogoMotivoPerda.tsx`

**Interfaces:**
- Consumes: `agendaDoDia`, `registrarResultado`, `concluirTarefa`, `reagendarTarefa`, `preencherModelo`, `linkWhatsApp`, `hojeEmPalmas`.
- Server actions: `acaoResultado(retornoId, resultado, novaData?, motivoPerdaId?)` e `acaoConcluirTarefa(id)`, ambas com `revalidatePath('/hoje')`.

Comportamento:
- Cabeçalho: "Hoje, dd/mm" e contadores (retornos e tarefas).
- Seção **Atrasados** (borda laranja) acima de **Hoje**. Se não houver nada, mostrar o estado vazio "Nada para hoje. 🎯" com o botão "Cadastrar lead".
- O cartão de retorno mostra nome, empresa, nicho, "Retorno 2 de 3", o selo "Frio · reativação" quando o ciclo for maior que 1, e o link do MVP.
- Botões do cartão:
  - **WhatsApp:** abre `linkWhatsApp` em nova aba, com o modelo preenchido.
  - **Copiar mensagem.**
  - **Respondeu**, **Pediu tempo**, **Sem interesse** e **Sem resposta**, em 1 toque cada.
  - "Pediu tempo" abre `SeletorNovaData` com os atalhos +3 dias, +1 semana e +1 mês (calculados com `agendarPrazo`) e uma data livre.
  - "Sem interesse" abre `DialogoMotivoPerda`.
- Os botões ficam desabilitados enquanto a action roda (Review Focus 2). Um `ErroNegocio` aparece como aviso no cartão.
- O cartão de tarefa tem título, hora, lead vinculado (link) e os botões **Concluir** e **Reagendar**.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** Verificar no navegador com dados de teste: um lead com o MVP enviado há 2 dias aparece em Hoje; o botão WhatsApp abre `wa.me` com o texto preenchido; "Sem resposta" tira o cartão da tela; "Respondeu" leva o lead para "Em conversa" (conferir no detalhe); tocar duas vezes rápido não duplica nada.
- [ ] **Step 3:** Commit: `feat: tela Hoje com retornos e acoes de resultado`.

---

### Task 11: Leads — lista, formulário e detalhe

**Files:**
- Create: `src/app/(app)/leads/page.tsx`, `src/app/(app)/leads/novo/page.tsx`, `src/app/(app)/leads/[id]/page.tsx`, `src/app/(app)/leads/[id]/editar/page.tsx`, `src/app/(app)/leads/actions.ts`, `src/components/leads/FormLead.tsx`, `src/components/leads/ListaLeads.tsx`, `src/components/leads/EditorRetornos.tsx`, `src/components/leads/LinhaDoTempo.tsx`, `src/components/leads/BotaoMvpEnviado.tsx`

**Interfaces:**
- Consumes: os serviços da Task 7, `formatarTelefone` e `formatarDataBR`.

Comportamento:
- **Lista:** filtros por etapa, nicho, origem e "só frios", com o filtro no query string. Cada item mostra nome, empresa, etapa, selo frio e a data do próximo retorno.
- **Formulário (novo/editar):**
  - Campos: nome do contato\*, WhatsApp\*, empresa, e-mail, cidade, nicho, origem (padrão "Prospecção ativa"), link do MVP e observações.
  - Erros de `ErroNegocio` aparecem junto do campo. No caso de WhatsApp duplicado, mostrar também um link para o lead existente.
  - Depois de salvar, ir para o detalhe.
- **Detalhe:**
  - Cabeçalho com nome, etapa (com seletor para mover, e "Perdido" pedindo o motivo), selo frio e botão WhatsApp com o modelo avulso.
  - Botão **"Marcar MVP enviado"** com campo de link, visível quando a etapa for `prospect` ou quando não houver retornos pendentes.
  - **EditorRetornos:** lista os retornos pendentes, permite mudar a data (date input), cancelar, "+ Adicionar retorno" e **"Trocar sequência"** (campo com offsets, ex.: `3, 7, 15`, que chama `aplicarSequencia` com base em hoje).
  - **LinhaDoTempo:** eventos com ícone, texto em pt-BR e data e hora; campo "Adicionar anotação".
  - Seção "Tarefas do lead" com "+ Tarefa".

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** Verificar no navegador os critérios de aceite 1 e 4 da spec:
  - Cadastrar um lead pela viewport de celular e marcar o MVP enviado. Aparecem 3 retornos nas datas certas.
  - Mudar a data de um retorno; adicionar e cancelar um retorno; trocar a sequência para `3, 7`.
  - Tentar cadastrar o mesmo WhatsApp em outro formato. Aparece o aviso de duplicado.
- [ ] **Step 3:** Commit: `feat: cadastro, lista e detalhe de leads com editor de retornos`.

---

### Task 12: Funil (kanban)

**Files:**
- Create: `src/app/(app)/funil/page.tsx`, `src/app/(app)/funil/actions.ts`, `src/components/funil/QuadroFunil.tsx`, `src/components/funil/CartaoLeadFunil.tsx`

**Interfaces:**
- Consumes: `listarLeads`, `moverEtapa`, `ETAPAS`.

Comportamento:
- PC: uma coluna por etapa, com contador no topo. Arrastar e soltar com `@dnd-kit/core` chama `moverEtapa`. Soltar em "Perdido" abre `DialogoMotivoPerda`; se o usuário cancelar, o cartão volta.
- Celular (< 768px): abas por etapa, com lista; o cartão tem o menu "Mover para…".
- Os leads frios aparecem na coluna "MVP enviado" com o selo "Frio".
- O valor em negociação por etapa fica para o Plano 2 (propostas). Não mostrar valor agora.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** Verificar no navegador: arrastar entre colunas persiste após recarregar; "Perdido" exige motivo; em viewport de celular as abas funcionam.
- [ ] **Step 3:** Commit: `feat: funil kanban com arrastar entre etapas`.

---

### Task 13: Agenda da semana e tarefas

**Files:**
- Create: `src/app/(app)/agenda/page.tsx`, `src/app/(app)/agenda/actions.ts`, `src/components/agenda/SemanaAgenda.tsx`, `src/components/agenda/FormTarefa.tsx`

**Interfaces:**
- Consumes: `agendaDaSemana`, `inicioDaSemana`, `criarTarefa`, `concluirTarefa`, `reagendarTarefa`, `excluirTarefa`.

Comportamento:
- Semana de segunda a domingo, com navegação "‹ semana anterior / próxima ›" (`?inicio=`). No PC, 7 colunas; no celular, lista agrupada por dia, com o dia de hoje destacado.
- Retornos aparecem com o nome do lead (link). Tarefas têm concluir, reagendar e excluir.
- **"+ Tarefa":** título\*, data\*, hora e lead (busca por nome, opcional).

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** Verificar no navegador: criar tarefa avulsa e tarefa ligada a lead; ambas aparecem na semana e em "Hoje" no dia; concluir remove; navegar entre semanas.
- [ ] **Step 3:** Commit: `feat: agenda semanal e tarefas`.

---

### Task 14: Configurações

**Files:**
- Create: `src/app/(app)/config/page.tsx`, `src/app/(app)/config/actions.ts`, `src/components/config/FormPrazos.tsx`, `src/components/config/ListaOpcoes.tsx`, `src/components/config/EditorModelos.tsx`
- Modify: `src/lib/servicos/config.ts`
- Test: `tests/integracao/config.test.ts`

**Interfaces:**
- Produces:
  - `salvarConfig(db, parcial: Partial<Config>): Promise<void>`. Valida: a sequência não pode ser vazia, os offsets são inteiros positivos em ordem crescente e os dias ficam entre 1 e 365. Caso contrário, `ErroNegocio`.
  - `listarOpcoes(db, tipo)`, `salvarOpcao(db, { id?, tipo, nome, ativo })`.
  - `listarModelos(db)`, `salvarModelo(db, { id?, nome, texto, passo })`, `excluirModelo(db, id)`.
  - Desativar uma opção só a esconde dos formulários; nada é apagado, para não quebrar leads antigos.

Comportamento:
- Seções da página:
  - **Retornos:** sequência padrão (ex.: `2, 5, 10`) e dias de reativação de frios.
  - **Modelos de mensagem:** com a lista de variáveis disponíveis e uma pré-visualização preenchida com dados de exemplo.
  - **Nichos**, **Origens** e **Motivos de perda:** adicionar, renomear e ativar/desativar.
- Os campos de prazo de proposta e de lembrete de cobrança só aparecem no Plano 2.
- Sair: o botão "Sair" fica nesta página no celular.

- [ ] **Step 1: Escrever os testes que falham:**
  - `salvarConfig rejeita sequência vazia ou fora de ordem`
  - `nova sequência padrão é usada no próximo marcarMvpEnviado`: salvar `[1,3]` e marcar o MVP em 19/10 gera 20/10 e 22/10.
  - `opção desativada não aparece em listarOpcoes ativas mas o lead mantém a referência`
- [ ] **Step 2:** Rodar: FAIL. **Step 3:** Implementar os serviços e a página. **Step 4:** Rodar: PASS.
- [ ] **Step 5:** Verificar no navegador: editar um modelo e conferir que o WhatsApp em "Hoje" usa o texto novo.
- [ ] **Step 6:** Commit: `feat: tela de configuracoes`.

---

### Task 15: PWA e verificação final do Plano 1

**Files:**
- Create: `src/app/manifest.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png`
- Modify: `src/app/layout.tsx` (theme-color `#0B3A63`, apple-touch-icon), `README.md`

**Interfaces:**
- Manifest com `name` "CRM Integra Sistemas", `short_name` "Integra CRM", `start_url` `/hoje`, `display` `standalone`, `theme_color` `#0B3A63`, `background_color` `#FFFFFF`. Ícones gerados da logo (fundo branco, margem de segurança para ícone maskable).
- Não é preciso service worker com cache offline. Observação para o README: a instalação como app no celular exige HTTPS fora de `localhost`; na rede local o celular abre pelo navegador normalmente. A instalação completa vem quando o dono autorizar a hospedagem.

- [ ] **Step 1:** Implementar o manifest e os ícones.
- [ ] **Step 2:** Rodar `npm test`, `npm run test:int` e `npm run build`. Esperado: tudo passa, build sem erros.
- [ ] **Step 3:** Verificação de ponta a ponta no navegador, nos critérios de aceite 1–5 da spec:
  1. Cadastrar um lead e marcar o MVP enviado: aparecem 3 retornos (D+2/D+5/D+10).
  2. Com o retorno de hoje, o WhatsApp abre com a mensagem preenchida. Para simular, marcar o MVP com data passada via SQL.
  3. "Respondeu" para a sequência e move para "Em conversa".
  4. As datas da sequência de um lead podem ser alteradas.
  5. Três "Sem resposta" deixam o lead frio, com um novo ciclo 30 dias depois.
- [ ] **Step 4:** Abrir pelo celular na rede local (`http://<ip-do-pc>:3000`) e conferir login e a tela Hoje. Se o Firewall do Windows bloquear, anotar no README como liberar a porta 3000 (decisão do dono, não alterar sozinho).
- [ ] **Step 5:** Commit: `feat: manifest PWA e verificacao final do plano 1`.
