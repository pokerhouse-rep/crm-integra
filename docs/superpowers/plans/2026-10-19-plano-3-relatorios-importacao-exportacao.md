# Plano 3 — Relatórios, importação e exportação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar o spec. Entram a tela de **Relatórios** (conversão por nicho e origem, financeiro e motivos de perda, com filtro de período), as **propostas aguardando resposta** em "Hoje", a **exportação** de todos os dados para planilha (CSV) e a **importação de leads** de planilha com detecção de WhatsApp duplicado. Também entram os reforços no banco que ficaram como "recomendado antes de usar de verdade" no registro do Plano 2.

**Architecture:** O padrão dos Planos 1 e 2 continua:
- Regras puras em `src/lib/dominio/`, testadas com Vitest.
- Serviços em `src/lib/servicos/` que recebem um `SupabaseClient` e são testados contra o Supabase local.
- Telas que só chamam serviços.
- Toda operação com mais de uma escrita é uma RPC SQL `security invoker`.

As novidades deste plano:
- **Relatórios:** os serviços leem as linhas cruas (eventos, contratos, cobranças) e as funções puras agregam. Toda leitura que pode passar de 1000 linhas (limite padrão do Supabase) passa por `lerTodas`, que pagina.
- **Exportação:** route handlers `GET` devolvem os CSVs.
- **Importação:** o processo tem duas etapas. Primeiro vem uma prévia, feita por server action, que lê e valida a planilha. Depois vem a confirmação, que revalida as linhas e grava tudo pela RPC `importar_leads`.

**Tech Stack:** o mesmo dos Planos 1 e 2 (Next.js 15, React 19, TypeScript, Tailwind v4, Supabase, Vitest, lucide-react). **Nenhuma dependência nova:** o CSV é lido e gerado à mão, e os gráficos são barras em HTML/CSS.

**Spec:** `docs/superpowers/specs/2026-10-18-crm-integra-sistemas-design.md` (§4.8, §4.9 exportar, §4.10 importar, §5.1 conversão por período). Ler também `docs/superpowers/plans/2026-10-18-plano-2-decisoes-e-pendencias.md`.

**Já existe (não refazer):** busca rápida global (`/busca`, `CampoBusca`), aviso de WhatsApp duplicado no cadastro manual (`criarLead`), valor em negociação no funil, MRR em Clientes.

## Global Constraints

- **Publicação:**
  - Quem implementa **não** faz `git push` nem deploy e não toca no Supabase da nuvem. Só usa o Supabase local via Docker, nas portas do projeto (API **54421**, banco 54422, Studio 54423).
  - Quem controla a execução publica no fim (Task 11). As migrations vão para a nuvem **antes** do push, porque a Vercel publica a `main` sozinha.
- **Repositório:** `C:\Users\PC\Desktop\CRM Integra Sistemas`. Nunca commitar no repo de `C:\Users\PC`.
- **Formatos:**
  - Interface em **pt-BR**.
  - Datas em `dd/mm/aaaa`.
  - Moeda em `R$ 1.500,00` na tela.
  - Fuso `America/Araguaina` (UTC−3 fixo, sem horário de verão).
- **Período:** um período `{ de, ate }` é **inclusivo** nos dois dias, em datas de Palmas. Em `timestamptz`, o intervalo vai de `${de}T03:00:00Z` (inclusive) até `${somarDias(ate, 1)}T03:00:00Z` (exclusive).
- **Valores monetários** são centavos inteiros em todo o código.
- **CSV gerado:**
  - UTF-8 com BOM (`\uFEFF`), separador `;` e quebra de linha `\r\n`.
  - Dinheiro sem `R$` e com vírgula decimal (`1500,00`), datas `dd/mm/aaaa` e data e hora `dd/mm/aaaa hh:mm` (Palmas).
  - Isso faz o Excel em português abrir a planilha certo com dois cliques.
- **Celular primeiro:** alvos de toque ≥ 44px. Os relatórios podem ser mais ricos no PC, mas precisam caber em 375px sem rolagem horizontal da página. Uma tabela pode rolar dentro do próprio contêiner.
- **RPCs novas:**
  - `security invoker`, `set search_path = ''` e nomes qualificados.
  - `revoke execute ... from public, anon` e `grant execute ... to authenticated`.

## Decisões deste plano (escolha do Claude — o dono pode corrigir)

| # | Decisão | Custo se estiver errada |
|---|---|---|
| D1 | **Conversão conta leads distintos com o evento no período**, etapa por etapa (§5.1: eventos, não coortes). As etapas são definidas assim:<br>• **MVP enviado**: evento `mvp_enviado`.<br>• **Resposta**: `retorno_feito` com resultado `respondeu`, ou `etapa_alterada` para `em_conversa`.<br>• **Proposta**: `proposta_enviada`.<br>• **Fechamento**: `proposta_aceita`, ou `etapa_alterada` para `fechado`. | Num período curto, uma etapa pode ter mais leads que a anterior. A taxa pode passar de 100%, e a tela explica isso numa linha. |
| D2 | Os filtros de nicho e origem usam o nicho e a origem **atuais** do lead. | Se você trocar o nicho de um lead, o histórico dele muda de grupo. |
| D3 | As tabelas de conversão por nicho e por origem mostram as 4 etapas e a **taxa de fechamento** (fechamentos ÷ MVPs enviados). Um grupo com 0 MVPs mostra "—". Leads sem nicho ou sem origem entram em "Sem nicho" e "Sem origem". | Nenhum. |
| D4 | Os períodos prontos são: **Este mês** (padrão; do dia 1 até hoje), **Mês passado**, **Últimos 30 dias**, **Últimos 90 dias**, **Este ano** e **Personalizado** (de/até). O período fica na URL (`?periodo=...&de=...&ate=...&nicho=...&origem=...`). Se "de" for depois de "até", as datas são trocadas. Uma data inválida volta ao padrão. | Nenhum. |
| D5 | **Vendido no período:** contratos com data de início (aceite) dentro do período, **incluindo os que depois foram cancelados**. O resultado mostra o valor único (soma dos itens únicos, já com desconto), o mensal (soma dos itens mensais com o valor do aceite) e a quantidade de contratos. | Um contrato cancelado logo depois continua contando como vendido. |
| D6 | **Ticket médio** = vendido no período ÷ quantidade de contratos, mostrado como "R$ X + R$ Y/mês". | Nenhum. |
| D7 | **Tempo médio até fechar:** dias corridos da data de cadastro do lead até o aceite, só no **primeiro contrato** de cada lead fechado no período, com arredondamento. | Lead antigo importado ou cadastrado bem antes de ser abordado aumenta a média. |
| D8 | O **MRR** do relatório é o de **hoje**, não acompanha o período, porque o banco não guarda o histórico de pausas. A tela mostra "MRR hoje". | O MRR de meses passados não está disponível. |
| D9 | **Recebido x a receber:** considera as cobranças com **vencimento** no período (não a data de pagamento). Mostra previsto, recebido, a receber e, dentro de "a receber", quanto já está atrasado. As suspensas ficam fora. | Um pagamento atrasado recebido neste mês conta no mês do vencimento. |
| D10 | **Motivos de perda:** leads com `etapa_alterada` para `perdido` no período que **continuam perdidos hoje**, agrupados pelo motivo atual. Quem não tem motivo entra em "Sem motivo". A lista vem do maior para o menor, com a porcentagem. | Um lead perdido e depois recuperado some do relatório. |
| D11 | **Relatórios na navegação:** a tela fica no menu lateral do PC, como 7º item, entre Clientes e Config. No celular, a barra de baixo continua com 6 itens (7 não cabem em 375px com o texto legível). Por isso, o acesso no celular é um botão "Relatórios" no topo de "Hoje" e outro no topo de "Config". | No celular, Relatórios fica um pouco menos à vista. |
| D12 | **Propostas aguardando resposta**, em "Hoje": propostas com status `enviada`, da mais antiga para a mais nova. Cada uma mostra o lead, a versão, o valor e "enviada há N dias", com link para a proposta. A seção aparece depois das cobranças, inclusive quando o resto do dia está vazio. Ela não entra na contagem do topo. | Nenhum. |
| D13 | **Exportação:** 7 arquivos CSV separados, cada um com seu botão em Config → "Dados": leads, retornos, tarefas, propostas (uma linha por item de cada versão), contratos (uma linha por item), cobranças e histórico. Não há XLSX nem ZIP, porque isso exigiria biblioteca nova. Uma célula que começa com `=`, `+`, `-`, `@`, tabulação ou retorno de carro ganha um `'` na frente, para o Excel não executar fórmula. | São 7 cliques para um backup completo. Um texto que começa com "-" aparece no Excel como `'- ...`. |
| D14 | **Importação só por CSV.** No Excel, "Salvar como → CSV" atende. O sistema aceita `;` ou `,` como separador (detecta pela 1ª linha) e UTF-8 ou Windows-1252, que é o padrão do Excel em português. Os limites são 1 MB e 1000 linhas por arquivo. Há um modelo para baixar. | Um arquivo `.xlsx` precisa ser salvo como CSV antes. |
| D15 | **Colunas da importação:** nome e WhatsApp são obrigatórios; empresa, e-mail, cidade, nicho, origem, link do MVP e observações são opcionais. Os cabeçalhos são reconhecidos sem diferenciar maiúsculas e acentos, com sinônimos (ex.: "telefone", "celular" e "whatsapp"). Uma coluna desconhecida é ignorada e gera um aviso.<br>Para nicho e origem:<br>• Um nome cadastrado é usado.<br>• Um nome não cadastrado deixa o campo em branco, com aviso na linha. A opção **não** é criada sozinha, para evitar que um erro de digitação vire nicho.<br>• Uma célula vazia usa o "Nicho padrão" e a "Origem padrão" escolhidos na tela de importação. | Um nicho novo precisa ser criado em Config antes de importar. |
| D16 | **Duplicados na importação:**<br>• Um WhatsApp que já existe no CRM ou que se repete na planilha (comparação pelo número normalizado) fica de fora. Na planilha, vale a 1ª ocorrência.<br>• Uma linha inválida fica de fora com o motivo.<br>• A prévia mostra tudo isso antes da confirmação.<br>Os leads importados entram como **Prospect**, sem disparar "MVP enviado", mesmo com link do MVP preenchido. O evento `criado` recebe `{ "importado": true }`. | Para iniciar as sequências, é preciso marcar "MVP enviado" lead a lead. |
| D17 | **Reforços no banco** (pendências do Plano 2):<br>• Checks em itens de proposta: desconto em R$ > 0 e menor que o valor; percentual entre 1 e 9999; valor ≤ R$ 10.000.000,00.<br>• Checks em itens de contrato: parcelas de 1 a 48.<br>• Checks em cobranças: número ≥ 1 e ≤ total de parcelas.<br>• Gatilho de `updated_at` em `propostas`.<br>• As telas de Clientes passam a resistir a uma falha da geração de mensalidades, como "Hoje" já faz. | Se algum dado antigo na nuvem violar um check, a migration falha antes de publicar. Nesse caso o controlador mostra o dado e corrige antes de continuar. |

## Review Focus

1. **CSV salvo pelo Excel em português** (Windows-1252, `;`, com "Clínica", "João", "Palmas–TO" no conteúdo): importa com os acentos certos e nunca mostra `Ã©` ou `�`. Teste na Task 6.
2. **WhatsApp em formatos variados na planilha:**
   - `63 99999-8888`, `+55 (63) 99999-8888`, `5563999998888` e `63999998888` são o mesmo número.
   - Duas linhas com esse número em formatos diferentes contam como duplicadas.
   - `6,39E+10` (notação científica do Excel) é rejeitado com "WhatsApp inválido".
   - Teste na Task 8.
3. **Virada de dia no fuso:** um evento às 23:30 de 31/10 em Palmas (02:30Z de 01/11) conta em outubro, não em novembro. Testes nas Tasks 1 e 3.
4. **Texto com `;`, aspas, quebra de linha ou começando com `=`** nas observações: o CSV exportado abre no Excel com uma linha por registro e sem fórmula executada, e o mesmo texto lido de volta por `lerCsv` é idêntico. Testes nas Tasks 6 e 7.
5. **Mais de 1000 eventos ou leads:** relatórios e exportação não cortam no limite de 1000 linhas do Supabase. Teste de `lerTodas` com página pequena na Task 3.

---

## Estrutura de arquivos

```
supabase/migrations/
  20261019000000_importar_leads.sql      # Task 9: RPC importar_leads
  20261019010000_reforcos.sql            # Task 10: checks + gatilho updated_at
src/lib/dominio/
  periodo.ts                             # Task 1: períodos prontos, intervalo UTC
  relatorios.ts                          # Tasks 1–2: agregações puras
  csv.ts                                 # Task 6: gerar/ler CSV, decodificar arquivo
  importacao.ts                          # Task 8: cabeçalhos, validação de linhas, duplicados
src/lib/servicos/
  paginacao.ts                           # Task 3: lerTodas
  relatorios.ts                          # Task 3
  propostas.ts                           # Task 5: + propostasAguardando
  exportacao.ts                          # Task 7
  importacao.ts                          # Task 9
src/app/(app)/relatorios/page.tsx        # Task 4
src/app/(app)/exportar/[tabela]/route.ts # Task 7
src/app/(app)/leads/importar/            # Task 9: page.tsx, actions.ts
src/components/relatorios/               # Task 4
src/components/leads/ImportarLeads.tsx   # Task 9
tests/unit/periodo.test.ts  relatorios.test.ts  csv.test.ts  importacao.test.ts
tests/integracao/relatorios.test.ts  hoje-propostas.test.ts  exportacao.test.ts  importacao.test.ts  reforcos.test.ts
```

---

### Task 1: Domínio — período e conversão

**Files:**
- Create: `src/lib/dominio/periodo.ts`, `src/lib/dominio/relatorios.ts`
- Test: `tests/unit/periodo.test.ts`, `tests/unit/relatorios.test.ts`

**Interfaces:**
- Produces (`periodo.ts`):
  - `type ChavePeriodo = 'mes' | 'mes_passado' | '30d' | '90d' | 'ano' | 'personalizado'`
  - `interface Periodo { chave: ChavePeriodo; de: DataISO; ate: DataISO }`
  - `PERIODOS: { valor: ChavePeriodo; rotulo: string }[]`, com os rótulos exatos de D4.
  - `resolverPeriodo(params: { periodo?: string; de?: string; ate?: string }, hoje: DataISO): Periodo` (D4). `30d` = `somarDias(hoje, -29)`..`hoje`; `90d` = `-89`. Datas são validadas com `dataValida` de `@/lib/validacao`.
  - `intervaloUTC(p: { de: DataISO; ate: DataISO }): { inicio: string; fim: string }` (Global Constraints).
  - `dataEmPalmas(timestamp: string): DataISO`, que é `hojeEmPalmas(new Date(timestamp))`.
  - `rotuloPeriodo(p: Periodo): string`, no formato `'01/10/2026 a 19/10/2026'`.
- Produces (`relatorios.ts`):
  - `interface EventoRelatorio { leadId: string; tipo: string; dados: Record<string, unknown> | null }`
  - `type EtapaConversao = 'mvp' | 'resposta' | 'proposta' | 'fechamento'`
  - `etapaDoEvento(e: EventoRelatorio): EtapaConversao | null` (D1)
  - `interface ContagemConversao { mvp: number; resposta: number; proposta: number; fechamento: number }`
  - `contarConversao(eventos: EventoRelatorio[]): ContagemConversao` conta leads distintos por etapa.
  - `quebrarConversao(eventos: EventoRelatorio[], grupoDoLead: (leadId: string) => string | null): Map<string | null, ContagemConversao>`
  - `taxa(parte: number, todo: number): number | null` devolve `null` se `todo === 0`. Senão devolve `Math.round(parte * 1000 / todo) / 10` (uma casa).

- [ ] **Step 1: Escrever os testes que falham:**

```ts
// periodo.test.ts — hoje = '2026-10-19'
expect(resolverPeriodo({}, '2026-10-19')).toEqual({ chave: 'mes', de: '2026-10-01', ate: '2026-10-19' })
expect(resolverPeriodo({ periodo: 'mes_passado' }, '2026-10-19')).toMatchObject({ de: '2026-09-01', ate: '2026-09-30' })
expect(resolverPeriodo({ periodo: 'mes_passado' }, '2026-01-10')).toMatchObject({ de: '2025-12-01', ate: '2025-12-31' })
expect(resolverPeriodo({ periodo: '30d' }, '2026-10-19')).toMatchObject({ de: '2026-09-20', ate: '2026-10-19' })
expect(resolverPeriodo({ periodo: 'ano' }, '2026-10-19')).toMatchObject({ de: '2026-01-01', ate: '2026-10-19' })
expect(resolverPeriodo({ periodo: 'personalizado', de: '2026-10-10', ate: '2026-10-01' }, '2026-10-19'))
  .toEqual({ chave: 'personalizado', de: '2026-10-01', ate: '2026-10-10' })
expect(resolverPeriodo({ periodo: 'personalizado', de: '2026-02-30', ate: '2026-10-01' }, '2026-10-19').chave).toBe('mes')
expect(resolverPeriodo({ periodo: 'xyz' }, '2026-10-19').chave).toBe('mes')
expect(intervaloUTC({ de: '2026-10-01', ate: '2026-10-31' })).toEqual({ inicio: '2026-10-01T03:00:00Z', fim: '2026-11-01T03:00:00Z' })
expect(dataEmPalmas('2026-11-01T02:30:00Z')).toBe('2026-10-31')
// relatorios.test.ts
const ev = (leadId: string, tipo: string, dados = {}) => ({ leadId, tipo, dados })
expect(contarConversao([
  ev('a', 'mvp_enviado'), ev('a', 'mvp_enviado'), ev('b', 'mvp_enviado'),
  ev('a', 'retorno_feito', { resultado: 'respondeu' }), ev('a', 'etapa_alterada', { de: 'mvp_enviado', para: 'em_conversa' }),
  ev('b', 'retorno_feito', { resultado: 'sem_resposta' }),
  ev('c', 'etapa_alterada', { de: 'prospect', para: 'em_conversa' }),
  ev('a', 'proposta_enviada'), ev('a', 'proposta_aceita'), ev('a', 'etapa_alterada', { para: 'fechado' }),
])).toEqual({ mvp: 2, resposta: 2, proposta: 1, fechamento: 1 })
const q = quebrarConversao([ev('a', 'mvp_enviado'), ev('b', 'mvp_enviado'), ev('b', 'proposta_aceita')], (id) => (id === 'a' ? 'n1' : null))
expect(q.get('n1')).toEqual({ mvp: 1, resposta: 0, proposta: 0, fechamento: 0 })
expect(q.get(null)).toEqual({ mvp: 1, resposta: 0, proposta: 0, fechamento: 1 })
expect(taxa(1, 3)).toBe(33.3)
expect(taxa(0, 0)).toBeNull()
```

- [ ] **Step 2:** `npm test -- periodo relatorios`. Esperado: FAIL (módulos não existem).
- [ ] **Step 3:** Implementar `periodo.ts` e a parte de conversão de `relatorios.ts`.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: dominio de periodo e conversao dos relatorios`.

---

### Task 2: Domínio — financeiro e motivos de perda

**Files:**
- Modify: `src/lib/dominio/relatorios.ts`
- Test: `tests/unit/relatorios.test.ts`

**Interfaces:**
- Produces:
  - `interface ContratoRelatorio { id: string; leadId: string; dataInicio: DataISO; leadCriadoEm: DataISO; itens: { tipo: TipoValor; valorCentavos: number }[] }`
  - `interface ResumoVendas { contratos: number; unicoCentavos: number; mensalCentavos: number; ticketUnicoCentavos: number | null; ticketMensalCentavos: number | null; tempoMedioDias: number | null }`
  - `resumirVendas(doPeriodo: ContratoRelatorio[], primeiroContratoDoLead: (leadId: string) => string): ResumoVendas` aplica D5, D6 e D7. Os tickets usam `Math.round`. O tempo médio usa só os contratos cujo `id === primeiroContratoDoLead(leadId)` e é `Math.round` da média das diferenças em dias.
  - `resumirRecebimentos(cs: { status: StatusCobranca; vencimento: DataISO; valorCentavos: number; valorPagoCentavos: number | null }[], hoje: DataISO): { previstoCentavos: number; recebidoCentavos: number; aReceberCentavos: number; atrasadoCentavos: number }` reusa `resumirMes` de `cobrancas.ts`. O atrasado é a soma das `aberta` com `vencimento < hoje`.
  - `contarMotivos(perdidos: { motivoId: string | null }[], nomeDoMotivo: (id: string) => string | undefined): { nome: string; quantidade: number; percentual: number }[]` aplica D10. Um id sem nome entra como "Sem motivo". A ordem é por quantidade decrescente e depois por nome. O percentual vem de `taxa`.
  - `diasEntre(de: DataISO, ate: DataISO): number`, para exportar e testar.

- [ ] **Step 1: Escrever os testes que falham:**

```ts
const c = (id: string, leadId: string, dataInicio: string, leadCriadoEm: string, itens: { tipo: 'unico' | 'recorrente'; valorCentavos: number }[]) =>
  ({ id, leadId, dataInicio, leadCriadoEm, itens })
const r = resumirVendas(
  [
    c('k1', 'a', '2026-10-10', '2026-10-01', [{ tipo: 'unico', valorCentavos: 150000 }, { tipo: 'recorrente', valorCentavos: 15000 }]),
    c('k2', 'b', '2026-10-15', '2026-10-14', [{ tipo: 'unico', valorCentavos: 100001 }]),
    c('k3', 'a', '2026-10-18', '2026-10-01', [{ tipo: 'recorrente', valorCentavos: 5000 }]),
  ],
  (leadId) => (leadId === 'a' ? 'k1' : 'k2'),
)
expect(r).toEqual({ contratos: 3, unicoCentavos: 250001, mensalCentavos: 20000, ticketUnicoCentavos: 83334, ticketMensalCentavos: 6667, tempoMedioDias: 5 })
expect(resumirVendas([], () => '').ticketUnicoCentavos).toBeNull()
expect(resumirRecebimentos([
  { status: 'paga', vencimento: '2026-10-05', valorCentavos: 50000, valorPagoCentavos: 45000 },
  { status: 'aberta', vencimento: '2026-10-10', valorCentavos: 15000, valorPagoCentavos: null },
  { status: 'aberta', vencimento: '2026-10-25', valorCentavos: 15000, valorPagoCentavos: null },
  { status: 'suspensa', vencimento: '2026-10-25', valorCentavos: 9000, valorPagoCentavos: null },
], '2026-10-19')).toEqual({ previstoCentavos: 80000, recebidoCentavos: 45000, aReceberCentavos: 30000, atrasadoCentavos: 15000 })
expect(contarMotivos([{ motivoId: 'm1' }, { motivoId: 'm1' }, { motivoId: null }, { motivoId: 'm2' }], (id) => ({ m1: 'Sem orçamento', m2: 'Outro' })[id]))
  .toEqual([{ nome: 'Sem orçamento', quantidade: 2, percentual: 50 }, { nome: 'Outro', quantidade: 1, percentual: 25 }, { nome: 'Sem motivo', quantidade: 1, percentual: 25 }])
```

(No tempo médio, k1 = 9 dias e k2 = 1 dia: média 5. O k3 não é o primeiro contrato do lead `a` e fica fora.)

- [ ] **Step 2:** `npm test -- relatorios`. Esperado: os testes novos falham.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: dominio financeiro e motivos de perda dos relatorios`.

---

### Task 3: Serviço de relatórios e leitura paginada

**Files:**
- Create: `src/lib/servicos/paginacao.ts`, `src/lib/servicos/relatorios.ts`
- Test: `tests/integracao/relatorios.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2; `listarContratos` e `mrrAtivo` de `contratos.ts`; `listarOpcoes` de `config.ts`.
- Produces (`paginacao.ts`): `lerTodas<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>, contexto: string, tamanho = 1000): Promise<T[]>`. A função chama `pagina(0, tamanho-1)`, `pagina(tamanho, 2*tamanho-1)`, ... até vir uma página com menos de `tamanho` linhas e trata erro com `lancarSeErro`. Toda consulta passada a ela precisa ter `.order(...)` estável (inclua `id` como desempate).
- Produces (`relatorios.ts`):
  - `interface FiltrosRelatorio { nichoId: string | null; origemId: string | null }`
  - `relatorioConversao(db, periodo: Periodo, filtros: FiltrosRelatorio): Promise<{ total: ContagemConversao; porNicho: { nome: string; contagem: ContagemConversao }[]; porOrigem: { nome: string; contagem: ContagemConversao }[] }>` lê `eventos` dos tipos `mvp_enviado`, `retorno_feito`, `etapa_alterada`, `proposta_enviada` e `proposta_aceita` dentro de `intervaloUTC`, com `select('id, lead_id, tipo, dados, ocorrido_em, leads!inner(nicho_id, origem_id)')`. Os filtros entram como `.eq('leads.nicho_id', ...)`. Os nomes vêm de `listarOpcoes` (inclui as inativas em uso). Os grupos ficam na ordem das opções, com "Sem nicho"/"Sem origem" por último, e um grupo com contagem toda zero não aparece.
  - `relatorioFinanceiro(db, periodo: Periodo, hoje: DataISO): Promise<{ vendas: ResumoVendas; mrrCentavos: number; recebimentos: ReturnType<typeof resumirRecebimentos> }>`. As vendas vêm de todos os contratos com itens e `leads(created_at)`, com o primeiro contrato de cada lead decidido por `data_inicio` e depois `created_at`. O MRR é `mrrAtivo(await listarContratos(db, hoje, { status: 'ativo' }))`. Os recebimentos são as cobranças com `vencimento` entre `de` e `ate`.
  - `relatorioMotivos(db, periodo: Periodo): Promise<ReturnType<typeof contarMotivos>>` (D10).
  - As leituras de eventos e cobranças usam `lerTodas`.

- [ ] **Step 1: Escrever os testes que falham:**
  - `lerTodas junta páginas sem perder nem repetir linhas`: criar 5 leads; `lerTodas((de, ate) => cliente.from('leads').select('id').order('id').range(de, ate), 'x', 2)` devolve 5 ids distintos.
  - `conversão conta evento de 23:30 de Palmas no dia certo`: lead com nicho "Clínica". Inserir pelo cliente do usuário um evento `mvp_enviado` com `ocorrido_em: '2026-11-01T02:30:00Z'`. Outubro (`{ de: '2026-10-01', ate: '2026-10-31' }`) dá `total.mvp === 1`; novembro dá 0.
  - `conversão filtra por nicho e agrupa por origem`: dois leads (nichos "Clínica" e "Restaurante"), ambos com `marcarMvpEnviado` hoje. O filtro de nicho "Clínica" dá `total.mvp === 1`. Sem filtro, `porNicho` tem as duas linhas com `mvp: 1`.
  - `financeiro do contrato de teste`: `criarClienteComContrato` (aceite em 2026-10-19). Período outubro: `vendas` tem `{ contratos: 1, unicoCentavos: 150000, mensalCentavos: 15000 }` (use `toMatchObject`; o `tempoMedioDias` depende do dia em que o teste roda e não é conferido aqui). Período setembro: `contratos: 0`. Recebimentos de outubro: `previstoCentavos === 50000` (1ª parcela).
  - `motivos de perda só de quem continua perdido`: lead A perdido com o motivo "Sem orçamento"; lead B perdido e depois movido para `em_conversa`. Resultado: `[{ nome: 'Sem orçamento', quantidade: 1, percentual: 100 }]`.
- [ ] **Step 2:** `npm run test:int -- relatorios`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: servicos de relatorios com leitura paginada`.

---

### Task 4: Tela de Relatórios

**Files:**
- Create: `src/app/(app)/relatorios/page.tsx`, `src/components/relatorios/FiltrosRelatorio.tsx` (client), `src/components/relatorios/FunilConversao.tsx`, `src/components/relatorios/TabelaConversao.tsx`, `src/components/relatorios/CartoesFinanceiro.tsx`, `src/components/relatorios/ListaMotivos.tsx`
- Modify: `src/components/shell/itens.ts`, `src/components/shell/BarraInferior.tsx`, `src/app/(app)/hoje/page.tsx` (botão do topo), `src/app/(app)/config/page.tsx` (botão do topo)

**Interfaces:**
- Consumes: Task 3, `PERIODOS`, `resolverPeriodo`, `rotuloPeriodo`, `taxa`, `formatarReais`, `formatarValorNegociacao`.
- `itens.ts`: o item `{ href: '/relatorios', rotulo: 'Relatórios', icone: ChartColumn, celular: false }` entra entre Clientes e Config. Os outros recebem `celular: true`, e `BarraInferior` filtra por `celular`.

- [ ] **Step 1:** Implementar a página (`dynamic = 'force-dynamic'`, `searchParams` como Promise, como no Next 15). Ela lê o período e os filtros, chama os três relatórios em paralelo e mostra, nesta ordem:
  1. **Filtros:** um seletor de período (com os campos de/até quando for personalizado) e os seletores de nicho e de origem. Ao trocar, a URL muda com `router.replace`.
  2. **Conversão:** 4 barras horizontais. Cada uma mostra o rótulo (MVPs enviados, Responderam, Propostas enviadas, Fechamentos), a quantidade e a "% da anterior". A largura é proporcional ao maior valor. Abaixo vai uma linha cinza: "Conta os leads com cada acontecimento no período; num período curto uma etapa pode superar a anterior."
  3. **Por nicho / por origem:** tabelas com Grupo, MVPs, Respostas, Propostas, Fechamentos e Taxa de fechamento. Cada tabela rola dentro de um `overflow-x-auto`.
  4. **Financeiro:** cartões com Vendido no período, Contratos fechados, Ticket médio, Tempo médio até fechar ("N dias" ou "—"), MRR hoje e Recebido/A receber/Atrasado do período.
  5. **Motivos de perda:** barras com nome, quantidade e %. Sem dados, mostra "Nenhuma perda no período."
- [ ] **Step 2:** Botão "Relatórios" (link, ≥ 44px, ícone `ChartColumn`) no topo de Hoje e de Config, só no celular (`md:hidden`).
- [ ] **Step 3:** `npm run lint` e `npx tsc --noEmit`. Esperado: sem erros.
- [ ] **Step 4:** Ver no navegador em 375px e 1280px, com `npm run dev` (não rodar `npm run build` com o dev ligado). Conferir:
  - nenhuma rolagem horizontal da página;
  - o filtro muda a URL e os números;
  - o MRR bate com o de Clientes.
- [ ] **Step 5:** Commit: `feat: tela de relatorios`.

---

### Task 5: Propostas aguardando resposta em "Hoje"

**Files:**
- Modify: `src/lib/servicos/propostas.ts`, `src/app/(app)/hoje/page.tsx`
- Create: `src/components/hoje/ListaPropostasAguardando.tsx`
- Test: `tests/integracao/hoje-propostas.test.ts`

**Interfaces:**
- Produces: `interface PropostaAguardando { id: string; leadId: string; nomeLead: string; empresa: string | null; titulo: string; versao: number; unicoCentavos: number; recorrenteCentavos: number; enviadaEm: DataISO; dias: number }` e `propostasAguardando(db, hoje: DataISO): Promise<PropostaAguardando[]>`.
  - Considera as propostas `status = 'enviada'` e, de cada uma, a última versão enviada.
  - `enviadaEm` = `dataEmPalmas(enviada_em)`; `dias` = `diasEntre(enviadaEm, hoje)`.
  - A ordem é de `enviadaEm` crescente.

- [ ] **Step 1: Escrever o teste que falha:** `lista só propostas enviadas, com versão e dias`:
  - Criar 3 propostas: uma em rascunho, uma enviada e uma aceita. Para a enviada, gravar `versoes_proposta.enviada_em = '2026-10-15T12:00:00Z'` pelo cliente admin.
  - Resultado esperado para hoje `2026-10-19`: um item, com `versao: 1`, `dias: 4` e os totais da versão.
- [ ] **Step 2:** `npm run test:int -- hoje-propostas`. Esperado: FAIL.
- [ ] **Step 3:** Implementar o serviço e a seção D12.
  - O título é "Propostas aguardando resposta (n)".
  - Cada linha é um link (≥ 44px) para `/leads/{leadId}/propostas/{id}`, no formato "Nome · Empresa", "v2 · R$ 1.500,00 + R$ 150,00/mês · enviada há 4 dias". Para 0 dias, mostra "enviada hoje"; para 1 dia, "enviada ontem".
  - Em "Hoje", a chamada usa `.catch` que devolve `[]` e registra no console, como as cobranças.
- [ ] **Step 4:** Rodar o teste (PASS), `npm run lint` e ver "Hoje" no navegador.
- [ ] **Step 5:** Commit: `feat: propostas aguardando resposta em Hoje`.

---

### Task 6: Domínio — CSV

**Files:**
- Create: `src/lib/dominio/csv.ts`
- Test: `tests/unit/csv.test.ts`

**Interfaces:**
- Produces:
  - `type Celula = string | number | null`
  - `gerarCsv(linhas: Celula[][]): string` gera o BOM, `;` e `\r\n`. Também faz:
    - `null` → vazio;
    - aspas em volta quando a célula tem `;`, `"`, `\r` ou `\n` (aspas internas dobradas);
    - proteção de fórmula (D13) antes das aspas.
  - `lerCsv(texto: string): string[][]` segue RFC 4180:
    - tira o BOM;
    - detecta o separador pela 1ª linha fora de aspas (`;` se houver algum, senão `,`);
    - aceita `\r\n` e `\n` e campos com aspas, inclusive com quebra de linha;
    - ignora as linhas totalmente vazias.
  - `decodificarArquivo(bytes: Uint8Array): string` tenta `new TextDecoder('utf-8', { fatal: true })` e, se falhar, usa `new TextDecoder('windows-1252')`.
  - `centavosParaCsv(c: number): string` → `150000` → `'1500,00'`, `-5` → `'-0,05'`.

- [ ] **Step 1: Escrever os testes que falham:**

```ts
const csv = gerarCsv([['Nome', 'Obs'], ['João', 'a;b "c"\nlinha 2'], ['=1+1', null], [-3, 'ok']])
expect(csv.startsWith('\uFEFFNome;Obs\r\n')).toBe(true)
expect(csv).toContain('João;"a;b ""c""\nlinha 2"\r\n')
expect(csv).toContain("'=1+1;\r\n")
expect(lerCsv(csv)).toEqual([['Nome', 'Obs'], ['João', 'a;b "c"\nlinha 2'], ["'=1+1", ''], ["'-3", 'ok']])
expect(lerCsv('nome,whatsapp\nAna,63999998888\n\n')).toEqual([['nome', 'whatsapp'], ['Ana', '63999998888']])
const latin1 = new Uint8Array([0x43, 0x6c, 0xed, 0x6e, 0x69, 0x63, 0x61, 0x3b, 0x4a, 0x6f, 0xe3, 0x6f]) // "Clínica;João" em Windows-1252
expect(decodificarArquivo(latin1)).toBe('Clínica;João')
expect(decodificarArquivo(new TextEncoder().encode('Clínica;João'))).toBe('Clínica;João')
expect(centavosParaCsv(150000)).toBe('1500,00')
```

(Números passam pela proteção como texto: `-3` vira `'-3`. Por isso os valores em dinheiro vão como `centavosParaCsv`, que só tem `-` em valor negativo, o que não acontece nos dados do CRM.)

- [ ] **Step 2:** `npm test -- csv`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: dominio de CSV`.

---

### Task 7: Exportação

**Files:**
- Create: `src/lib/servicos/exportacao.ts`, `src/app/(app)/exportar/[tabela]/route.ts`
- Modify: `src/app/(app)/config/page.tsx` (nova seção "Dados")
- Test: `tests/integracao/exportacao.test.ts`

**Interfaces:**
- Consumes: `gerarCsv`, `centavosParaCsv`, `lerTodas`, `formatarDataBR`, `formatarTelefone`, `ETAPAS`, `rotuloCobranca`, `dataEmPalmas`.
- Produces:
  - `TABELAS_EXPORTACAO = ['leads', 'retornos', 'tarefas', 'propostas', 'contratos', 'cobrancas', 'historico'] as const`
  - `type TabelaExportacao = typeof TABELAS_EXPORTACAO[number]`
  - `linhasExportacao(db, tabela: TabelaExportacao): Promise<Celula[][]>`: a 1ª linha é o cabeçalho.
  - `dataHoraPalmas(ts: string): string` → `'dd/mm/aaaa hh:mm'`.
- Cabeçalhos exatos:
  - **leads:** Nome; Empresa; WhatsApp; E-mail; Cidade; Nicho; Origem; Etapa; Frio; Cliente; Motivo da perda; Link do MVP; MVP enviado em; Observações; Cadastrado em
  - **retornos:** Lead; WhatsApp; Data prevista; Ciclo; Origem; Situação; Resultado; Feito em
  - **tarefas:** Título; Lead; Data; Hora; Feita; Feita em
  - **propostas:** Lead; Proposta; Status; Versão; Enviada em; Item; Tipo; Valor; Parcelas; Mês de início; Desconto
  - **contratos:** Cliente; Contrato; Situação; Início; Dia de vencimento; Pausado em; Cancelado em; Item; Tipo; Valor; Parcelas; Mês de início
  - **cobrancas:** Cliente; Contrato; Cobrança; Vencimento; Valor; Situação; Pago em; Valor pago
  - **historico:** Data e hora; Lead; Evento; Detalhes
- Regras de formato:
  - Sim/Não para os booleanos.
  - Etapa pelo rótulo de `ETAPAS`.
  - Tipo como "Único"/"Mensal".
  - Desconto como `'10%'` ou `'150,00'`.
  - Mês de início como `mm/aaaa`.
  - Detalhes do histórico como `JSON.stringify(dados)`.
- Ordem das linhas:
  - leads, retornos, tarefas e histórico pela data de criação;
  - propostas e contratos pela data e depois pela ordem do item;
  - cobranças pelo vencimento.
- Route handler `GET`:
  - Uma `tabela` fora da lista devolve 404. A Task 9 acrescenta `modelo`.
  - A resposta tem `Content-Type: text/csv; charset=utf-8` e `Content-Disposition: attachment; filename="crm-${tabela}-${hojeEmPalmas()}.csv"`.
  - Também leva `Cache-Control: no-store`.
- Seção "Dados" em Config: 7 links de download (`<a href download>`, ≥ 44px) e a frase "Abra no Excel ou no Google Planilhas. Use como backup."

- [ ] **Step 1: Escrever os testes que falham:**
  - `leads exporta nicho pelo nome, etapa pelo rótulo e telefone formatado`: lead com nicho "Clínica", WhatsApp `63999998888` e observação `'=SOMA(A1)'`. Resultado: linha `[..., '(63) 99999-8888', ..., 'Clínica', ..., 'Prospect', 'Não', 'Não', ...]`. Ao passar por `gerarCsv`, a observação fica `'=SOMA(A1)`.
  - `cobrancas exporta valor com vírgula e rótulo da cobrança`: com `criarClienteComContrato`, uma linha tem `'Site institucional · parcela 1 de 3'` e `'500,00'`.
  - `propostas tem uma linha por item de cada versão`: proposta com 2 itens e 2 versões → 4 linhas além do cabeçalho.
- [ ] **Step 2:** `npm run test:int -- exportacao`. Esperado: FAIL.
- [ ] **Step 3:** Implementar o serviço, a rota e a seção.
- [ ] **Step 4:** Rodar (PASS). Depois baixar `leads` no navegador local e abrir o arquivo: a 1ª linha é o cabeçalho e o acento aparece certo.
- [ ] **Step 5:** Commit: `feat: exportacao de dados em CSV`.

---

### Task 8: Domínio — importação de leads

**Files:**
- Create: `src/lib/dominio/importacao.ts`
- Test: `tests/unit/importacao.test.ts`

**Interfaces:**
- Produces:
  - `type CampoImportacao = 'nome' | 'empresa' | 'whatsapp' | 'email' | 'cidade' | 'nicho' | 'origem' | 'link_mvp' | 'observacoes'`
  - `normalizarTexto(s: string): string` faz `trim`, minúsculas, remove acentos (`normalize('NFD')` sem marcas combinantes) e junta espaços repetidos.
  - `mapearCabecalho(cabecalho: string[]): { colunas: (CampoImportacao | null)[]; ignoradas: string[]; erro: string | null }`.
    - Sinônimos, já normalizados:
      - nome: `nome`, `nome do contato`, `contato`
      - empresa: `empresa`, `nome da empresa`, `imobiliaria`
      - whatsapp: `whatsapp`, `telefone`, `celular`, `fone`, `zap`
      - email: `email`, `e-mail`
      - cidade: `cidade`
      - nicho: `nicho`, `segmento`
      - origem: `origem`
      - link_mvp: `link do mvp`, `link mvp`, `mvp`, `link`
      - observacoes: `observacoes`, `observacao`, `obs`
    - Sem coluna de nome ou de whatsapp: `'A planilha precisa das colunas "nome" e "whatsapp".'`
    - Coluna repetida: vale a 1ª.
  - `interface OpcoesImportacao { nichos: { id: string; nome: string }[]; origens: { id: string; nome: string }[]; nichoPadraoId: string | null; origemPadraoId: string | null; whatsappsExistentes: Set<string> }`
  - `type SituacaoLinha = 'nova' | 'duplicada_crm' | 'duplicada_planilha' | 'invalida'`
  - `interface LinhaImportacao { numero: number; situacao: SituacaoLinha; motivo: string | null; avisos: string[]; dados: DadosLead | null }`. `numero` é a linha da planilha, contando o cabeçalho como 1. `dados` vem preenchido só em `nova`. O `whatsapp` em `dados` já está normalizado.
  - `validarLinhas(linhas: string[][], colunas: (CampoImportacao | null)[], o: OpcoesImportacao): LinhaImportacao[]` aplica D15 e D16.
    - Mensagens exatas:
      - `'Nome vazio.'`
      - `'WhatsApp inválido.'`
      - `'WhatsApp já cadastrado no CRM.'`
      - `'WhatsApp repetido na planilha (linha N).'`
    - Avisos:
      - `'Nicho "X" não cadastrado; ficará em branco.'`
      - o mesmo para Origem.
    - E-mail, cidade etc.: `trim`, e vazio vira `undefined`.
    - `validarLinhas` não confere o limite de linhas; quem chama confere antes (Task 9).
  - `LIMITE_LINHAS_IMPORTACAO = 1000`, `LIMITE_BYTES_IMPORTACAO = 1_048_576`.

- [ ] **Step 1: Escrever os testes que falham:**

```ts
expect(mapearCabecalho(['Nome do Contato', 'Celular', 'Segmento', 'Coluna X']))
  .toEqual({ colunas: ['nome', 'whatsapp', 'nicho', null], ignoradas: ['Coluna X'], erro: null })
expect(mapearCabecalho(['Empresa']).erro).toBe('A planilha precisa das colunas "nome" e "whatsapp".')
const o = { nichos: [{ id: 'n1', nome: 'Clínica' }], origens: [{ id: 'o1', nome: 'Prospecção ativa' }],
  nichoPadraoId: null, origemPadraoId: 'o1', whatsappsExistentes: new Set(['5563988887777']) }
const cols = ['nome', 'whatsapp', 'nicho'] as const
const r = validarLinhas([
  ['Ana', '63 99999-8888', 'clinica'],
  ['Bia', '+55 (63) 99999-8888', ''],
  ['Caio', '6,39E+10', ''],
  ['', '63977776666', ''],
  ['Duda', '63988887777', ''],
  ['Eva', '5563966665555', 'Padaria'],
], [...cols], o)
expect(r.map((l) => l.situacao)).toEqual(['nova', 'duplicada_planilha', 'invalida', 'invalida', 'duplicada_crm', 'nova'])
expect(r[0].dados).toMatchObject({ nomeContato: 'Ana', whatsapp: '5563999998888', nichoId: 'n1', origemId: 'o1' })
expect(r[1].motivo).toBe('WhatsApp repetido na planilha (linha 2).')
expect(r[2].motivo).toBe('WhatsApp inválido.')
expect(r[3].motivo).toBe('Nome vazio.')
expect(r[5].avisos).toEqual(['Nicho "Padaria" não cadastrado; ficará em branco.'])
expect(r[5].dados?.nichoId ?? null).toBeNull()
```

- [ ] **Step 2:** `npm test -- importacao`. Esperado: FAIL.
- [ ] **Step 3:** Implementar, usando `normalizarTelefone`.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: dominio de importacao de leads`.

---

### Task 9: Importação — RPC, serviço e tela

**Files:**
- Create: `supabase/migrations/20261019000000_importar_leads.sql`, `src/lib/servicos/importacao.ts`, `src/app/(app)/leads/importar/page.tsx`, `src/app/(app)/leads/importar/actions.ts`, `src/components/leads/ImportarLeads.tsx` (client)
- Modify: `src/app/(app)/leads/page.tsx` (botão "Importar planilha"), `src/app/(app)/exportar/[tabela]/route.ts` (`modelo`), `src/app/(app)/config/page.tsx` (link para importar e para o modelo na seção "Dados")
- Test: `tests/integracao/importacao.test.ts`

**Interfaces:**
- Consumes: Tasks 6 e 8, `chamarRpc`, `listarOpcoes`.
- Produces (SQL): `public.importar_leads(p_leads jsonb) returns jsonb`.
  - `p_leads` = `[{ nome_contato, whatsapp, empresa, email, cidade, nicho_id, origem_id, link_mvp, observacoes }]`.
  - Mais de 1000 itens → `'Importe no máximo 1000 leads por vez.'` (P0001).
  - Insere com `on conflict (user_id, whatsapp) do nothing returning id`.
  - Para cada id inserido, grava o evento `criado` com `{"importado": true}`.
  - Retorna `{"importados": n, "ignorados": total - n}`.
- Produces (`importacao.ts`):
  - `previaImportacao(db, bytes: Uint8Array, padroes: { nichoId: string | null; origemId: string | null }): Promise<{ linhas: LinhaImportacao[]; ignoradas: string[] }>`.
    - Confere `LIMITE_BYTES_IMPORTACAO` → `ErroNegocio('Arquivo maior que 1 MB.')`.
    - Decodifica e lê o CSV. Sem linha de dados → `ErroNegocio('A planilha está vazia.')`.
    - Mais de `LIMITE_LINHAS_IMPORTACAO` linhas de dados → `ErroNegocio('A planilha tem mais de 1000 linhas. Divida em arquivos menores.')`.
    - Erro do cabeçalho → `ErroNegocio(erro)`.
    - Lê todos os WhatsApps existentes com `lerTodas`.
  - `importarLeads(db, leads: DadosLead[]): Promise<{ importados: number; ignorados: number }>`. Cada item passa de novo por `normalizarTelefone` e pela checagem de nome (revalidação no servidor). Um inválido → `ErroNegocio('Há linhas inválidas. Gere a prévia de novo.')`.
- Tela `/leads/importar`:
  1. Texto curto com as colunas aceitas e o link "Baixar modelo" (`/exportar/modelo`: cabeçalho `nome;whatsapp;empresa;email;cidade;nicho;origem;link do mvp;observacoes` mais uma linha de exemplo).
  2. Seletores "Nicho padrão" e "Origem padrão" (origem padrão pré-selecionada: "Prospecção ativa", se existir), um campo de arquivo (`accept=".csv,text/csv"`) e o botão "Ver prévia".
  3. Prévia com os totais ("N novos · N já no CRM · N repetidos · N com erro") e uma tabela que rola dentro do contêiner (Linha, Nome, WhatsApp, Situação/motivo, Avisos).
  4. Botão "Importar N leads", desabilitado com 0, que envia só as linhas `nova`.
  5. Resultado: "N leads importados." (mais "N ignorados porque já existiam." quando houver) e um link "Ver leads".
- Na action, o arquivo vem em `FormData`. A action de confirmação recebe `DadosLead[]` em JSON e devolve `RespostaAcao` com o resultado. A confirmação faz `revalidatePath('/leads')`.

- [ ] **Step 1: Escrever os testes que falham:**
  - `prévia marca duplicado do CRM e importa só os novos`: um lead já existente com `63988887777`. CSV em Windows-1252 com `nome;whatsapp;nicho`, `João;63 99999-8888;Clínica` e `Duda;63988887777;`. A prévia dá as situações `['nova', 'duplicada_crm']` e `dados.nomeContato === 'João'`. `importarLeads` com as novas dá `{ importados: 1, ignorados: 0 }`. O lead fica em `prospect` e tem um evento `criado` com `dados.importado === true`.
  - `importar duas vezes não duplica`: a 2ª chamada com os mesmos dados dá `{ importados: 0, ignorados: 1 }`.
  - `importar_leads recusa mais de 1000`: `cliente.rpc('importar_leads', { p_leads: Array(1001).fill({...}) })` dá erro com a mensagem exata.
  - `anônimo não executa importar_leads`: um cliente sem login recebe erro de permissão.
- [ ] **Step 2:** `npm run db:reset` (recriar o usuário dev, Q3 do Plano 2) e `npm run test:int -- importacao`. Esperado: FAIL.
- [ ] **Step 3:** Implementar a migration, o serviço, as actions e a tela.
- [ ] **Step 4:** Rodar o teste (PASS) e `npm run lint`. No navegador local, importar um CSV salvo pelo Excel ou criado em Windows-1252 com acentos e conferir a prévia, a importação e a lista de Leads.
- [ ] **Step 5:** Commit: `feat: importacao de leads por planilha CSV`.

---

### Task 10: Reforços no banco e resiliência de Clientes

**Files:**
- Create: `supabase/migrations/20261019010000_reforcos.sql`
- Modify: `src/app/(app)/clientes/page.tsx`, `src/app/(app)/clientes/cobrancas/page.tsx`
- Test: `tests/integracao/reforcos.test.ts`

**Interfaces:**
- Migration (D17), com os checks nomeados:
  - `itens_proposta_desconto_valor_ck`: `desconto_tipo is null or (desconto_tipo = 'valor' and desconto_valor > 0 and desconto_valor < valor_centavos) or (desconto_tipo = 'percentual' and desconto_valor between 1 and 9999)`
  - `itens_proposta_valor_max_ck`: `valor_centavos <= 1000000000`
  - `contrato_itens_parcelas_ck`: `parcelas between 1 and 48`
  - `cobrancas_numero_ck`: `numero is null or (numero >= 1 and (total_parcelas is null or numero <= total_parcelas))`
  - `cobrancas_total_parcelas_ck`: `total_parcelas is null or total_parcelas between 1 and 48`
  - Função `public.tocar_updated_at()` (`returns trigger`, `security invoker`, `set search_path = ''`), que faz `new.updated_at := now()`, e o gatilho `propostas_updated_at` `before update on public.propostas`.
- As duas páginas de Clientes: `garantirMensalidades` em `try/catch` com `console.error`, como em `hoje/page.tsx`.

- [ ] **Step 1: Escrever os testes que falham:**
  - `banco recusa desconto em R$ que zera o item`: um insert direto em `itens_proposta` com `valor_centavos: 1000, desconto_tipo: 'valor', desconto_valor: 1000` → erro `23514`.
  - `banco recusa percentual de 100%`: `desconto_tipo: 'percentual', desconto_valor: 10000` → `23514`.
  - `updated_at da proposta muda sozinho`: update direto do `titulo` → `updated_at` maior que o anterior.
- [ ] **Step 2:** `npm run test:int -- reforcos`. Esperado: FAIL.
- [ ] **Step 3:** Escrever a migration e o `try/catch`.
- [ ] **Step 4:** `npm run db:reset`, depois `npm test` e `npm run test:int` completos. Esperado: tudo passa (os dados de teste dos Planos 1 e 2 respeitam os checks).
- [ ] **Step 5:** Commit: `fix: reforcos no banco e Clientes resiste a falha de mensalidades`.

---

### Task 11: Verificação final e publicação (controlador)

- [ ] **Step 1:** Rodar `npm test`, `npm run test:int`, `npm run lint` e `npm run build` (com o dev parado). Esperado: tudo passa.
- [ ] **Step 2:** Critério de aceite 8 do spec no navegador local: em Relatórios, a conversão por nicho aparece e o MRR é igual ao de Clientes.
- [ ] **Step 3:** Antes de aplicar a `20261019010000_reforcos.sql` na nuvem, consultar via MCP (`execute_sql`) se algum dado viola os checks novos. Se houver, mostrar ao dono e corrigir antes de seguir.
- [ ] **Step 4:** Aplicar as 2 migrations via `apply_migration`, na ordem, e rodar `get_advisors` (security). Esperado: só o aviso já conhecido de "Leaked password protection".
- [ ] **Step 5:** `git push` da `main`. Esperar o deploy da Vercel ficar READY (`vercel api ...?teamId=team_f0fuYELIotvri2oK4y4XpzGs`).
- [ ] **Step 6:** Testar em produção: `/login` responde 200, e `/relatorios` e `/exportar/leads` sem sessão respondem 307 para `/login`.
- [ ] **Step 7:** Registrar as decisões tomadas na execução em `docs/superpowers/plans/2026-10-19-plano-3-decisoes-e-pendencias.md` e commitar.

---

**Fora deste plano (spec §9):** notificações push, captura automática de leads (webhook), PDF da proposta e multiusuário.
