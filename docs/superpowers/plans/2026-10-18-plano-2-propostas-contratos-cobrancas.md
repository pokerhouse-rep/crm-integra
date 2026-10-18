# Plano 2 — Propostas, contratos e cobranças — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o ciclo comercial: propostas com itens únicos (à vista ou parcelados) e mensais, desconto por item, versões e retorno pós-envio; o aceite gera o contrato e as cobranças previstas; o dono marca o que foi pago, vê atrasadas e lembretes em "Hoje" e administra pausas, cancelamentos e reajustes. O funil passa a mostrar o valor em negociação por etapa.

**Architecture:** Mantém o padrão do Plano 1: regras puras em `src/lib/dominio/` (Vitest), serviços em `src/lib/servicos/` que recebem um `SupabaseClient` (testados contra o Supabase local) e telas que só chamam serviços via server actions. Novidade: **toda operação com mais de uma escrita no banco é uma função SQL (RPC) que roda numa transação**. O TypeScript calcula (datas, valores, parcelas) e a função SQL valida o estado, trava as linhas (`for update`) e grava tudo de uma vez. Erros de regra saem do SQL com `raise exception` (código `P0001`) e viram `ErroNegocio` no TS.

**Tech Stack:** o do Plano 1 (Next.js 15, React 19, TypeScript, Tailwind v4, Supabase local via Docker, Vitest, @dnd-kit/core, lucide-react). Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-18-crm-integra-sistemas-design.md` (§4.6, §4.7, §4.9 catálogo e prazos, §5.1). Ler também `docs/superpowers/plans/2026-10-18-plano-1-decisoes-e-pendencias.md`.

**Fora deste plano (Plano 3):** relatórios e indicadores (§4.8: conversão, MRR em relatório, ticket médio, motivos de perda), "propostas aguardando resposta" no painel, exportação e importação.

## Global Constraints

- **PROIBIDO:** GitHub, Supabase na nuvem e Vercel. Nada de `git push`, `supabase link`, `vercel`. Só Supabase local via Docker, com as portas do projeto (API **54421**, banco 54422, Studio 54423).
- Repositório: `C:\Users\PC\Desktop\CRM Integra Sistemas`. Nunca commitar no repo de `C:\Users\PC`.
- Interface em **pt-BR**. Datas `dd/mm/aaaa`. Moeda `R$ 1.500,00` (espaço comum depois de `R$`).
- **Valores monetários em centavos (inteiro).** No banco, colunas de dinheiro são `bigint`. Percentual de desconto em **centésimos de ponto percentual** (`750` = 7,5%).
- Fuso de "hoje": `America/Araguaina`. Datas de vencimento e retorno são `date` (`'YYYY-MM-DD'`); competência de mensalidade é o 1º dia do mês (`'YYYY-MM-01'`).
- Prazos em dias corridos (retorno após proposta: **3 dias**, configurável) passam por `agendarPrazo` (sábado/domingo → segunda). **Vencimentos de cobrança não são ajustados por fim de semana** (são dias fixos do mês). Datas escolhidas à mão são respeitadas.
- Lembrete de cobrança: **3 dias** antes do vencimento (configurável).
- Dia de vencimento do contrato: **1 a 28**; padrão = dia do aceite (se o aceite for dia 29, 30 ou 31, o padrão é 28).
- À vista e 1ª parcela vencem na data do aceite (editável); as demais parcelas, mês a mês no dia de vencimento; a mensalidade começa no mês de início do item, no dia de vencimento.
- Desconto por item, em % ou R$. Os totais mostram separados o único e o recorrente, já com desconto.
- O sistema **nunca** move um lead para "Perdido" sozinho (recusar proposta não muda a etapa).
- Celular primeiro: alvos de toque ≥ 44px. Marcar uma cobrança como recebida: 1 toque.
- Toda operação com mais de uma escrita vai para uma função SQL `security invoker` (RLS continua valendo), com `set search_path = ''` e nomes qualificados (`public.`).

## Decisões deste plano (escolha do Claude — o dono pode corrigir)

| # | Decisão | Custo se estiver errada |
|---|---|---|
| P1 | O status (rascunho, enviada, aceita, recusada) é da proposta. Cada versão fica congelada depois de enviada; para mudar, cria-se uma nova versão (cópia da última), que volta a rascunho. | Não há "editar versão enviada". |
| P2 | Enviar a versão 1 leva o lead para "Proposta enviada"; enviar a versão 2 em diante leva para "Negociação". Se o lead já é cliente, a etapa não muda (proposta de novo contrato). | O dono move a etapa à mão se preferir outra. |
| P3 | Enviar cancela o retorno pós-proposta pendente anterior e cria um novo em hoje + 3 dias. "Sem resposta" no último retorno pós-proposta agenda outro retorno pós-proposta (+3); o lead não vira frio. | Mais um retorno na lista até o dono decidir. |
| P4 | Recusar não move o lead para Perdido; só cancela o retorno pós-proposta pendente. | O dono marca Perdido à mão. |
| P5 | Aceite aceito a partir de rascunho ou enviada (o dono pode fechar pessoalmente sem "enviar"). | Nenhum. |
| P6 | Divisão de parcelas: parte inteira para todas, o centavo que sobra vai para a 1ª parcela (R$ 1.000 em 3x = 333,34 + 333,33 + 333,33). | Centavos de diferença. |
| P7 | As parcelas do valor único são todas criadas no aceite. As mensalidades são criadas até o **mês seguinte ao de hoje**, de forma idempotente, sempre que "Hoje" ou "Clientes" abrem. | Mensalidades distantes só aparecem quando o mês chega perto. |
| P8 | Mês de início padrão de um item mensal: o mês seguinte ao de hoje. | Um campo a mais para mudar. |
| P9 | Pausar: cobranças não pagas com vencimento a partir de hoje ficam suspensas; meses criados durante a pausa nascem suspensos. Reativar: parcelas suspensas voltam a abertas (continuam devidas, com a data original; o dono pode editar); mensalidades suspensas só voltam se vencerem de hoje em diante (meses pausados não são cobrados). | Parcelas reativadas podem aparecer como atrasadas até o dono ajustar a data. |
| P10 | Cancelar: apaga as cobranças não pagas (abertas ou suspensas) com vencimento de hoje em diante; pagas e vencidas ficam. | Nenhum. |
| P11 | Reajuste só em itens mensais, "a partir da competência X": recalcula as mensalidades abertas dessa competência em diante e vale para as próximas geradas. O MRR usa o valor vigente no mês atual. | Nenhum. |
| P12 | Valor em negociação no funil: soma da última versão das propostas em rascunho ou enviadas, por etapa do lead; leads perdidos não somam. Mostra "R$ X + R$ Y/mês". | Rascunhos também contam como negociação. |
| P13 | Desconto não pode zerar um item. Parcelas de 1 a 48. Valor máximo digitável por campo: R$ 10.000.000,00. | Limites raros. |
| P14 | Mensagem de cobrança pelo WhatsApp com texto fixo (não editável nesta versão). | Editar fica para depois. |
| P15 | Nova aba de navegação **Clientes** (contratos e cobranças), entre Agenda e Config. | 6 itens na barra inferior. |

## Review Focus

1. **Valor digitado em qualquer formato** (`1500`, `1.500`, `1.500,00`, `1500.50`, `R$ 150`): vira os centavos certos; `1,234`, `-10` e texto são rejeitados com mensagem, nunca salvos errados. Teste na Task 2.
2. **Parcelas que não dividem exato** (R$ 1.000 em 3x, desconto de 3,33%): a soma das parcelas é igual ao total líquido, sem centavo perdido. Teste na Task 3.
3. **Toque duplo em "Aceitar" ou "Recebido"** (rede lenta): não cria dois contratos nem paga duas vezes; a segunda chamada falha com mensagem clara. Testes nas Tasks 8 e 9.
4. **Abrir o app várias vezes (ou em duas abas ao mesmo tempo) no mês:** a geração de mensalidades não duplica nada. Teste na Task 9.
5. **Aceite no fim do mês** (31/10, 3x): o dia de vencimento padrão vira 28 e as parcelas caem em 31/10, 28/11 e 28/12. Teste na Task 4.

---

## Estrutura de arquivos

```
supabase/migrations/
  20261018010000_rpc_retornos.sql        # Task 1: RPCs aplicar_resultado e mover_etapa + índices
  20261018020000_comercial.sql           # Task 5: catálogo, propostas, contratos, cobranças
  20261018030000_rpc_propostas.sql       # Task 7
  20261018040000_rpc_contratos.sql       # Tasks 8–10 (cada task acrescenta suas funções neste arquivo)
src/lib/dominio/
  dinheiro.ts                            # Task 2: ler/formatar reais e percentual
  propostas.ts                           # Task 3: desconto, totais, parcelas, validação de item
  cobrancas.ts                           # Task 4: competências, vencimentos, plano de cobranças, situação
  tipos.ts                               # + TipoValor, StatusProposta, StatusContrato, StatusCobranca
src/lib/servicos/
  rpc.ts                                 # Task 1: chamarRpc
  catalogo.ts                            # Task 6
  propostas.ts                           # Tasks 7–8
  cobrancas.ts                           # Task 9
  contratos.ts                           # Task 10
  tipos.ts                               # + linhas das tabelas novas
src/app/(app)/leads/[id]/propostas/      # Task 11: [propostaId]/page.tsx, actions.ts
src/app/(app)/clientes/                  # Task 12: page.tsx, [contratoId]/page.tsx, cobrancas/page.tsx, actions.ts
src/components/propostas/  src/components/clientes/  src/components/cobrancas/
tests/unit/dinheiro.test.ts  propostas.test.ts  cobrancas.test.ts
tests/integracao/comercial-schema.test.ts  catalogo.test.ts  propostas.test.ts  aceite.test.ts  cobrancas.test.ts  contratos.test.ts
```

---

### Task 1: `registrarResultado` e `moverEtapa` transacionais (RPC)

Pendência recomendada no registro do Plano 1: hoje são várias escritas em sequência e uma falha no meio deixa o lead sem próximo passo. Esta task **não muda o comportamento** do Plano 1 (todos os testes atuais continuam passando), exceto a regra P3 do retorno pós-proposta, que entra aqui porque o enum `origem_retorno` já tem `proposta`.

**Files:**
- Create: `supabase/migrations/20261018010000_rpc_retornos.sql`, `src/lib/servicos/rpc.ts`
- Modify: `src/lib/servicos/retornos.ts` (`registrarResultado`, `moverEtapa`; remover `ETAPAS_COM_CONVERSA`), `src/lib/dominio/sequencia.ts`
- Test: `tests/unit/sequencia.test.ts`, `tests/integracao/retornos.test.ts`

**Interfaces:**
- Produces (`rpc.ts`): `chamarRpc<T = void>(db: SupabaseClient, funcao: string, args: Record<string, unknown>, contexto: string): Promise<T>`. Erro com `code === 'P0001'` → `throw new ErroNegocio(error.message)`; outro erro → `lancarSeErro(error, contexto)`. Retorna `data as T`.
- Produces (`sequencia.ts`): `EntradaResultado` ganha `origem?: OrigemRetorno` (padrão `'sequencia'`) e `diasRetornoProposta?: number` (padrão 3). Nova linha da tabela de regras: `sem_resposta`, `pendentesRestantes = 0`, `origem = 'proposta'` → `{ cancelarPendentes: false, novaEtapa: null, novosRetornos: [{ data: agendarPrazo(hoje, diasRetornoProposta), origem: 'proposta' }], frio: 'manter', pedirMotivoPerda: false }`. As outras linhas não mudam.
- Produces (SQL), ambas `language plpgsql security invoker set search_path = ''`:
  - `public.aplicar_resultado(p_retorno_id uuid, p_resultado public.resultado_retorno, p_pendentes_esperados int, p_cancelar_pendentes boolean, p_nova_etapa public.etapa, p_novos_retornos jsonb, p_frio text, p_motivo_perda_id uuid, p_nova_data date) returns void`. `p_novos_retornos` = `[{ "data": "YYYY-MM-DD", "origem": "...", "ciclo": n }]`; `p_frio` ∈ `'marcar' | 'limpar' | 'manter'`. Ordem: trava o retorno (`for update`; inexistente → `'Retorno não encontrado.'`; status ≠ pendente → `'Este retorno já foi registrado.'`); trava o lead; conta os pendentes do lead sem o atual e, se ≠ `p_pendentes_esperados`, `'Os retornos deste lead mudaram. Atualize a página e tente de novo.'`; marca o retorno feito; cancela pendentes se pedido; insere os novos; atualiza o lead (etapa se não nula e diferente, frio, `motivo_perda_id` quando `sem_interesse`, `updated_at`); grava os mesmos eventos de hoje (`retorno_feito` com `resultado`, `retorno_id`, `ciclo`, `nova_data` opcional; `etapa_alterada {de, para}`; `frio {ciclo: ciclo+1}`; `reativado`).
  - `public.mover_etapa(p_lead_id uuid, p_etapa public.etapa, p_motivo_perda_id uuid) returns void`: as regras exatas do `moverEtapa` atual (R10 do registro): perdido sem motivo → `'Informe o motivo da perda.'`; lead inexistente → `'Lead não encontrado.'`; motivo gravado em perdido e limpo ao sair de perdido; fechado → `cliente = true`; etapas com conversa (`em_conversa` em diante) limpam o frio; perdido/fechado cancelam todos os pendentes, as outras etapas com conversa cancelam só `sequencia`/`reativacao`; eventos `etapa_alterada` e `reativado`.
  - Na mesma migration, os índices pendentes: `retornos(lead_id)`, `tarefas(lead_id)`, `eventos(lead_id)`.
- `registrarResultado` (mesma assinatura e retorno `PlanoResultado`): valida entrada como hoje, lê retorno, lead, config e pendentes restantes, aplica R1 (`respondeu` não regride etapas além de `mvp_enviado`), calcula `planejarResultado` (passando `origem: retorno.origem` e `diasRetornoProposta`), calcula o ciclo de cada novo retorno (`reativacao` → `retorno.ciclo + 1`, demais → `retorno.ciclo`) e chama `aplicar_resultado` uma única vez.
- `moverEtapa` (mesma assinatura): mantém a checagem de motivo em TS e chama `mover_etapa`.

- [ ] **Step 1: Escrever os testes que falham.**
  - Unit (`sequencia.test.ts`): `sem resposta no último retorno pós-proposta agenda outro retorno de proposta e não deixa frio`: `planejarResultado({ resultado: 'sem_resposta', hoje: '2026-10-22', pendentesRestantes: 0, origem: 'proposta', diasRetornoProposta: 3, offsetsPadrao: [2,5,10], diasReativacao: 30 })` → `frio: 'manter'`, `novosRetornos: [{ data: '2026-10-26', origem: 'proposta' }]` (22/10 + 3 = domingo → segunda).
  - Integração (`retornos.test.ts`):
    - `sem_interesse com motivo inexistente falha e não altera nada`: lead com MVP enviado em 19/10; `registrarResultado` do retorno de 21/10 com `motivoPerdaId: crypto.randomUUID()` rejeita; depois disso os 3 retornos continuam `pendente` e a etapa continua `mvp_enviado`.
    - `moverEtapa para perdido com motivo inexistente não cancela os retornos`: rejeita e os 3 pendentes continuam.
    - `aplicar_resultado recusa quando os pendentes mudaram`: chamar `cliente.rpc('aplicar_resultado', {...})` com `p_pendentes_esperados: 5` → erro com a mensagem `'Os retornos deste lead mudaram. Atualize a página e tente de novo.'` e o retorno continua pendente.
    - `sem_resposta no último retorno pós-proposta cria novo retorno de proposta`: lead movido para `proposta_enviada`, retorno inserido direto (`origem: 'proposta'`, `data_prevista: '2026-10-22'`, `ciclo: 1`); `registrarResultado` `sem_resposta` em `2026-10-22` → um pendente `proposta` em `2026-10-26` e `lead.frio === false`.
- [ ] **Step 2:** `npm test -- sequencia` e `npm run test:int -- retornos`. Esperado: os testes novos falham.
- [ ] **Step 3:** Escrever a migration, `rpc.ts`, a nova regra de domínio e reescrever os dois serviços.
- [ ] **Step 4:** `npm run db:reset`, depois `npm test` e `npm run test:int`. Esperado: tudo passa, inclusive os testes antigos de retornos, leads, agenda e config.
- [ ] **Step 5:** Commit: `refactor: registrarResultado e moverEtapa transacionais via RPC`.

---

### Task 2: Domínio — dinheiro e percentual

**Files:**
- Create: `src/lib/dominio/dinheiro.ts`
- Test: `tests/unit/dinheiro.test.ts`

**Interfaces:**
- Produces:
  - `formatarReais(centavos: number): string` → `'R$ 1.500,00'` (Intl pt-BR/BRL, trocando o espaço não separável `\u00a0` por espaço comum).
  - `lerReais(texto: string): number | null`: tira `R$` e espaços. Só aceita dígitos, `.` e `,`. Com vírgula: o que vem depois da última vírgula são os centavos (1 ou 2 dígitos) e os pontos antes dela são separadores de milhar. Sem vírgula e com um único ponto seguido de 1 ou 2 dígitos no fim: o ponto é decimal. Nos demais casos com ponto, cada grupo depois de um ponto precisa ter 3 dígitos (milhar). Acima de `1_000_000_000` centavos (R$ 10.000.000,00) → `null`.
  - `lerPercentual(texto: string): number | null` → centésimos de ponto percentual, aceitando `,` ou `.` como decimal (até 2 casas); acima de 100 → `null`.
  - `formatarPercentual(centesimos: number): string` → `750` → `'7,5%'`, `1000` → `'10%'`.
  - `formatarValorNegociacao(v: { unicoCentavos: number; recorrenteCentavos: number }): string` → `'R$ 1.500,00 + R$ 150,00/mês'`; só único → `'R$ 1.500,00'`; só recorrente → `'R$ 150,00/mês'`; ambos zero → `''`.

- [ ] **Step 1: Escrever os testes que falham:**

```ts
expect(formatarReais(150000)).toBe('R$ 1.500,00')
expect(formatarReais(5)).toBe('R$ 0,05')
expect(lerReais('1500')).toBe(150000)
expect(lerReais('1.500')).toBe(150000)
expect(lerReais('1.500,00')).toBe(150000)
expect(lerReais('1500,5')).toBe(150050)
expect(lerReais('1500.50')).toBe(150050)
expect(lerReais('R$ 150')).toBe(15000)
expect(lerReais('1.234.567,89')).toBe(123456789)
for (const t of ['', 'abc', '1,234', '-10', '1.50.0', '10000000,01']) expect(lerReais(t)).toBeNull()
expect(lerPercentual('10')).toBe(1000)
expect(lerPercentual('7,5')).toBe(750)
expect(lerPercentual('7.5')).toBe(750)
expect(lerPercentual('100')).toBe(10000)
for (const t of ['', '100,01', '0,005', 'x']) expect(lerPercentual(t)).toBeNull()
expect(formatarPercentual(750)).toBe('7,5%')
expect(formatarValorNegociacao({ unicoCentavos: 150000, recorrenteCentavos: 15000 })).toBe('R$ 1.500,00 + R$ 150,00/mês')
expect(formatarValorNegociacao({ unicoCentavos: 0, recorrenteCentavos: 15000 })).toBe('R$ 150,00/mês')
expect(formatarValorNegociacao({ unicoCentavos: 0, recorrenteCentavos: 0 })).toBe('')
```

- [ ] **Step 2:** `npm test -- dinheiro`. Esperado: FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `dinheiro.ts`. Nada de `parseFloat` para centavos: montar o inteiro a partir das partes de texto.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: dominio de dinheiro e percentual`.

---

### Task 3: Domínio — itens de proposta, desconto, totais e parcelas

**Files:**
- Create: `src/lib/dominio/propostas.ts`
- Modify: `src/lib/dominio/tipos.ts`
- Test: `tests/unit/propostas.test.ts`

**Interfaces:**
- Produces (`tipos.ts`): `type TipoValor = 'unico' | 'recorrente'`; `type StatusProposta = 'rascunho' | 'enviada' | 'aceita' | 'recusada'`; `type StatusContrato = 'ativo' | 'pausado' | 'cancelado'`; `type StatusCobranca = 'aberta' | 'paga' | 'suspensa'`; `type TipoCobranca = 'avista' | 'parcela' | 'mensalidade'`; `type Competencia = string` (`'YYYY-MM-01'`).
- Produces (`propostas.ts`):

```ts
interface Desconto { tipo: 'percentual' | 'valor'; valor: number } // percentual em centésimos de %; valor em centavos
interface ItemProposta {
  servicoId: string | null
  descricao: string
  tipo: TipoValor
  valorCentavos: number
  parcelas: number            // único: 1 = à vista; recorrente: sempre 1
  mesInicio: Competencia | null // obrigatório se recorrente
  desconto: Desconto | null
}
```

  - `descontoDoItem(item: ItemProposta): number`: percentual → `Math.round(valorCentavos * valor / 10000)`; valor → `valor`; sem desconto → 0.
  - `valorLiquido(item: ItemProposta): number`
  - `totaisProposta(itens: ItemProposta[]): { unicoCentavos: number; recorrenteCentavos: number; descontoCentavos: number }` (líquidos)
  - `dividirParcelas(totalCentavos: number, n: number): number[]` (P6)
  - `validarItem(item: ItemProposta): string | null`, com as mensagens exatas, nesta ordem:
    - descrição vazia (após `trim`) → `'Informe a descrição do item.'`
    - `valorCentavos` não inteiro ou ≤ 0 → `'O valor do item deve ser maior que zero.'`
    - único com `parcelas` fora de 1–48 ou não inteiro → `'O número de parcelas deve ser de 1 a 48.'`
    - recorrente sem `mesInicio` → `'Informe o mês de início da mensalidade.'`
    - desconto com `valor` ≤ 0 → `'O desconto deve ser maior que zero.'`
    - `valorLiquido(item) <= 0` → `'O desconto deve ser menor que o valor do item.'`

- [ ] **Step 1: Escrever os testes que falham:**
  - `desconto percentual arredonda ao centavo`: 150000 com 1000 → 15000; 9999 com 333 → 333.
  - `desconto em reais`: 150000 com `{ tipo: 'valor', valor: 20000 }` → líquido 130000.
  - `totais separam único e recorrente com desconto`: site 150000 em 3x com 10% + hospedagem 15000 recorrente → `{ unicoCentavos: 135000, recorrenteCentavos: 15000, descontoCentavos: 15000 }`.
  - `parcelas somam o total` (Review Focus 2): `dividirParcelas(100000, 3)` → `[33334, 33333, 33333]`; `dividirParcelas(150000, 3)` → `[50000, 50000, 50000]`; para `n` de 1 a 48 e totais `[1, 99, 100000, 145501]` (quando total ≥ n), a soma é igual ao total.
  - `validarItem` cobre cada mensagem acima, incluindo 100% de desconto e desconto em R$ igual ao valor (ambos → `'O desconto deve ser menor que o valor do item.'`), e devolve `null` para um item válido.
- [ ] **Step 2:** Rodar: FAIL. **Step 3:** Implementar. **Step 4:** Rodar: PASS.
- [ ] **Step 5:** Commit: `feat: dominio de itens de proposta, desconto e parcelas`.

---

### Task 4: Domínio — cobranças

**Files:**
- Create: `src/lib/dominio/cobrancas.ts`
- Test: `tests/unit/cobrancas.test.ts`

**Interfaces:**
- Consumes: `somarDias`, `formatarDataBR` (Plano 1), `dividirParcelas` (Task 3), `formatarReais` (Task 2).
- Produces:
  - `competenciaDe(data: DataISO): Competencia`, `somarMeses(c: Competencia, n: number): Competencia`, `vencimentoNaCompetencia(c: Competencia, dia: number): DataISO`
  - `horizonteCobrancas(hoje: DataISO): Competencia` = mês seguinte ao de hoje (P7)
  - `diaVencimentoPadrao(hoje: DataISO): number` = `Math.min(dia, 28)`
  - `interface ItemContratado { tipo: TipoValor; valorCentavos: number /* líquido */; parcelas: number; mesInicio: Competencia | null }`
  - `interface CobrancaPlanejada { itemIndice: number; tipo: TipoCobranca; numero: number | null; totalParcelas: number | null; competencia: Competencia | null; vencimento: DataISO; valorCentavos: number }`
  - `planejarCobrancasIniciais(itens: ItemContratado[], o: { diaVencimento: number; primeiroVencimento: DataISO; ate: Competencia }): CobrancaPlanejada[]`. Único com 1 parcela → `avista` (`numero` e `totalParcelas` nulos) em `primeiroVencimento`. Único com N parcelas → `parcela` k=1 em `primeiroVencimento`, k ≥ 2 em `vencimentoNaCompetencia(somarMeses(competenciaDe(primeiroVencimento), k-1), diaVencimento)`, valores de `dividirParcelas`. Recorrente → uma `mensalidade` por competência de `mesInicio` até `ate` (inclusive), em `vencimentoNaCompetencia(c, diaVencimento)`.
  - `competenciasFaltantes(mesInicio: Competencia, ate: Competencia, existentes: Competencia[]): Competencia[]`
  - `valorVigente(valorBase: number, reajustes: { aPartirDe: Competencia; valorCentavos: number }[], c: Competencia): number`: o reajuste de maior `aPartirDe` ≤ `c`; sem nenhum, `valorBase`.
  - `situacaoCobranca(c: { status: StatusCobranca; vencimento: DataISO }, hoje: DataISO, diasLembrete: number): 'paga' | 'suspensa' | 'atrasada' | 'vencendo' | 'futura'`: aberta e `vencimento < hoje` → atrasada; aberta e `vencimento <= somarDias(hoje, diasLembrete)` → vencendo.
  - `resumirMes(cs: { status: StatusCobranca; valorCentavos: number; valorPagoCentavos: number | null }[]): { previstoCentavos: number; recebidoCentavos: number; aReceberCentavos: number }`: previsto = soma das não suspensas; recebido = soma de `valorPagoCentavos` das pagas; a receber = soma das abertas.
  - `rotuloCobranca(c: { descricaoItem: string; tipo: TipoCobranca; numero: number | null; totalParcelas: number | null; competencia: Competencia | null }): string` → `'Site · à vista'`, `'Site · parcela 2 de 3'`, `'Hospedagem · mensalidade 11/2026'`.
  - `mensagemCobranca(c: { nome: string; rotulo: string; valorCentavos: number; vencimento: DataISO }, hoje: DataISO): string`, com o texto exato:
    - em dia: `Olá {nome}! Passando para lembrar do pagamento de {rotulo}, no valor de {valor}, com vencimento em {dd/mm/aaaa}. Qualquer dúvida, estou à disposição.`
    - atrasada (`vencimento < hoje`): `Olá {nome}! O pagamento de {rotulo}, no valor de {valor}, venceu em {dd/mm/aaaa}. Consegue verificar para mim? Qualquer dúvida, estou à disposição.`

- [ ] **Step 1: Escrever os testes que falham:**

```ts
expect(competenciaDe('2026-10-19')).toBe('2026-10-01')
expect(somarMeses('2026-11-01', 2)).toBe('2027-01-01')
expect(somarMeses('2026-01-01', -1)).toBe('2025-12-01')
expect(vencimentoNaCompetencia('2026-02-01', 28)).toBe('2026-02-28')
expect(horizonteCobrancas('2026-12-05')).toBe('2027-01-01')
expect(diaVencimentoPadrao('2026-10-31')).toBe(28)
expect(diaVencimentoPadrao('2026-10-19')).toBe(19)

it('critério 6: 3 parcelas de 450,00 e mensalidade a partir de novembro', () => {
  const p = planejarCobrancasIniciais(
    [{ tipo: 'unico', valorCentavos: 135000, parcelas: 3, mesInicio: null },
     { tipo: 'recorrente', valorCentavos: 15000, parcelas: 1, mesInicio: '2026-11-01' }],
    { diaVencimento: 19, primeiroVencimento: '2026-10-19', ate: '2026-11-01' })
  expect(p.map(c => [c.tipo, c.numero, c.vencimento, c.valorCentavos])).toEqual([
    ['parcela', 1, '2026-10-19', 45000], ['parcela', 2, '2026-11-19', 45000], ['parcela', 3, '2026-12-19', 45000],
    ['mensalidade', null, '2026-11-19', 15000],
  ])
})
it('aceite em 31/10 com dia 28: 31/10, 28/11, 28/12', () => { /* Review Focus 5 */ })
it('à vista vence no primeiro vencimento', () => { /* tipo 'avista', numero null */ })
it('mensalidade que começa depois do horizonte não gera nada', () => {})
expect(competenciasFaltantes('2026-11-01', '2027-01-01', ['2026-11-01'])).toEqual(['2026-12-01', '2027-01-01'])
expect(valorVigente(15000, [{ aPartirDe: '2027-01-01', valorCentavos: 18000 }], '2026-12-01')).toBe(15000)
expect(valorVigente(15000, [{ aPartirDe: '2027-01-01', valorCentavos: 18000 }], '2027-02-01')).toBe(18000)
// situação com lembrete de 3 dias, vencimento 19/11
expect(situacaoCobranca({ status: 'aberta', vencimento: '2026-11-19' }, '2026-11-15', 3)).toBe('futura')
expect(situacaoCobranca({ status: 'aberta', vencimento: '2026-11-19' }, '2026-11-16', 3)).toBe('vencendo')
expect(situacaoCobranca({ status: 'aberta', vencimento: '2026-11-19' }, '2026-11-19', 3)).toBe('vencendo')
expect(situacaoCobranca({ status: 'aberta', vencimento: '2026-11-19' }, '2026-11-20', 3)).toBe('atrasada')
expect(situacaoCobranca({ status: 'paga', vencimento: '2026-11-19' }, '2026-11-20', 3)).toBe('paga')
expect(rotuloCobranca({ descricaoItem: 'Hospedagem', tipo: 'mensalidade', numero: null, totalParcelas: null, competencia: '2026-11-01' }))
  .toBe('Hospedagem · mensalidade 11/2026')
expect(mensagemCobranca({ nome: 'Maria', rotulo: 'Site · parcela 2 de 3', valorCentavos: 45000, vencimento: '2026-11-19' }, '2026-11-20'))
  .toBe('Olá Maria! O pagamento de Site · parcela 2 de 3, no valor de R$ 450,00, venceu em 19/11/2026. Consegue verificar para mim? Qualquer dúvida, estou à disposição.')
```

  Mais um teste de `resumirMes` com uma paga (valor pago diferente do previsto), uma aberta e uma suspensa.
- [ ] **Step 2:** Rodar: FAIL. **Step 3:** Implementar (aritmética de mês em UTC, como em `datas.ts`). **Step 4:** Rodar: PASS.
- [ ] **Step 5:** Commit: `feat: dominio de cobrancas e vencimentos`.

---

### Task 5: Schema comercial (catálogo, propostas, contratos, cobranças)

**Files:**
- Create: `supabase/migrations/20261018020000_comercial.sql`, `tests/integracao/comercial-schema.test.ts`
- Modify: `src/lib/servicos/tipos.ts` (interfaces das linhas novas, com os nomes de coluna em snake_case, como `Lead`: `ServicoCatalogo`, `Proposta`, `VersaoProposta`, `ItemPropostaRow`, `Contrato`, `ContratoItem`, `Reajuste`, `Cobranca`; colunas `bigint` tipadas como `number`)

**Interfaces:**
- Produces: todas as tabelas com `user_id uuid not null default auth.uid() references auth.users on delete cascade`, RLS ligada e a mesma policy de isolamento do núcleo. Dinheiro em `bigint`.
  - Enums: `tipo_valor` (`unico`, `recorrente`), `tipo_desconto` (`percentual`, `valor`), `status_proposta`, `status_contrato`, `status_cobranca`, `tipo_cobranca` (valores da Task 3).
  - `alter type public.tipo_evento add value` para: `proposta_criada`, `proposta_enviada`, `proposta_nova_versao`, `proposta_aceita`, `proposta_recusada`, `contrato_pausado`, `contrato_reativado`, `contrato_cancelado`, `contrato_reajustado`, `cobranca_paga`, `pagamento_desfeito`. Não usar os valores novos nesta mesma migration.
  - `catalogo_servicos(id, user_id, nome text not null, tipo tipo_valor not null, preco_centavos bigint not null default 0 check (>= 0), ativo bool default true, ordem int default 0, unique(user_id, nome))`.
  - `propostas(id, user_id, lead_id → leads on delete cascade, titulo text not null default 'Proposta', status status_proposta not null default 'rascunho', aceita_em date, created_at, updated_at)`.
  - `versoes_proposta(id, user_id, proposta_id → propostas on delete cascade, numero int not null, total_unico_centavos bigint not null default 0, total_recorrente_centavos bigint not null default 0, enviada_em timestamptz, created_at, unique(proposta_id, numero))`.
  - `itens_proposta(id, user_id, versao_id → versoes_proposta on delete cascade, ordem int not null, servico_id → catalogo_servicos on delete set null, descricao text not null, tipo tipo_valor not null, valor_centavos bigint not null check (> 0), parcelas int not null default 1 check (1..48), mes_inicio date, desconto_tipo tipo_desconto, desconto_valor bigint, check (tipo = 'unico' or mes_inicio is not null), check ((desconto_tipo is null) = (desconto_valor is null)))`.
  - `contratos(id, user_id, lead_id → leads on delete cascade, proposta_id → propostas on delete set null, descricao text not null, dia_vencimento int not null check (1..28), data_inicio date not null, status status_contrato not null default 'ativo', pausado_em date, cancelado_em date, created_at)`.
  - `contrato_itens(id, user_id, contrato_id → contratos on delete cascade, ordem int, descricao text not null, tipo tipo_valor not null, valor_centavos bigint not null check (> 0) /* líquido */, parcelas int not null default 1, mes_inicio date)`.
  - `reajustes(id, user_id, contrato_item_id → contrato_itens on delete cascade, a_partir_de date not null, valor_centavos bigint not null check (> 0), created_at, unique(contrato_item_id, a_partir_de))`.
  - `cobrancas(id, user_id, contrato_id → contratos on delete cascade, contrato_item_id → contrato_itens on delete cascade, lead_id → leads on delete cascade, tipo tipo_cobranca not null, numero int, total_parcelas int, competencia date, vencimento date not null, valor_centavos bigint not null check (>= 0), status status_cobranca not null default 'aberta', pago_em date, valor_pago_centavos bigint, created_at, unique(contrato_item_id, numero), unique(contrato_item_id, competencia))`.
  - Índices: `propostas(lead_id)`, `versoes_proposta(proposta_id)`, `itens_proposta(versao_id)`, `contratos(lead_id)`, `cobrancas(user_id, status, vencimento)`, `cobrancas(contrato_id)`.
  - Catálogo padrão: função `security definer` `criar_catalogo_padrao()` e trigger próprio `after insert on auth.users` (não mexer em `criar_dados_padrao`), inserindo Site, Plataforma e Sistema interno (`unico`) e Hospedagem e Manutenção (`recorrente`), todos com preço 0 e `ordem` 1–5. A migration também insere esse catálogo para os usuários que já existem (`insert ... select from auth.users ... on conflict do nothing`).

- [ ] **Step 1: Escrever os testes que falham:**
  - `novo usuário recebe 5 serviços no catálogo (3 únicos, 2 recorrentes)`
  - `RLS isola propostas, contratos e cobranças`: A cria lead + proposta (insert direto); B lê `propostas` → 0 linhas.
  - `item de proposta rejeita valor zero e parcelas fora de 1 a 48`: insert direto → erro `23514`.
  - `item recorrente sem mês de início é rejeitado` → `23514`.
  - `não há duas mensalidades da mesma competência para o mesmo item`: 2º insert → `23505`.
- [ ] **Step 2:** `npm run test:int -- comercial-schema`. Esperado: FAIL.
- [ ] **Step 3:** Escrever a migration e os tipos.
- [ ] **Step 4:** `npm run db:reset`, `npm run test:int`. Esperado: PASS (todos).
- [ ] **Step 5:** Commit: `feat: schema de catalogo, propostas, contratos e cobrancas`.

---

### Task 6: Configurações — prazos comerciais e catálogo de serviços

**Files:**
- Create: `src/lib/servicos/catalogo.ts`, `src/components/config/ListaServicos.tsx`, `tests/integracao/catalogo.test.ts`
- Modify: `src/app/(app)/config/page.tsx`, `src/app/(app)/config/actions.ts`, `src/components/config/FormPrazos.tsx`, `tests/integracao/config.test.ts`

**Interfaces:**
- Consumes: `salvarConfig`/`obterConfig` (já tratam `diasRetornoProposta` e `diasLembreteCobranca`), `lerReais`/`formatarReais` (Task 2).
- Produces:
  - `listarServicos(db, o?: { incluirInativos?: boolean }): Promise<ServicoCatalogo[]>` (ordem, nome).
  - `salvarServico(db, { id?: string; nome: string; tipo: TipoValor; precoCentavos: number; ativo: boolean }): Promise<ServicoCatalogo>`. Erros: nome vazio → `'Informe o nome do serviço.'`; preço não inteiro ou negativo → `'Informe um preço válido.'`; `23505` → `'Já existe um serviço com esse nome.'`.
  - `acaoSalvarPrazos(v: { sequencia: string; diasReativacao: string; diasRetornoProposta: string; diasLembreteCobranca: string }): Promise<RespostaAcao>` (substitui a assinatura de 2 strings; mesmas mensagens para número inválido, citando o campo).
  - `acaoSalvarServico(id: string | null, nome: string, tipo: string, preco: string, ativo: boolean): Promise<RespostaAcao>`: preço vazio = 0; `lerReais` nulo → `'Informe um preço válido (ex.: 1.500,00).'`.

Comportamento:
- Seção **Retornos** ganha dois campos: "Retorno após enviar proposta (dias)" e "Lembrete de cobrança (dias antes do vencimento)", com o texto de ajuda "Entre 1 e 365.".
- Nova seção **Catálogo de serviços** (depois de Modelos de mensagem): lista com nome, tipo ("Valor único" / "Mensal"), preço de referência formatado e ativo; adicionar, editar e ativar/desativar, como `ListaOpcoes`. Desativar só esconde das propostas novas.

- [ ] **Step 1: Escrever os testes que falham:**
  - `config.test.ts`: `salvarConfig grava dias de retorno de proposta e de lembrete de cobrança` (5 e 7 → `obterConfig` devolve 5 e 7).
  - `catalogo.test.ts`: `salvarServico cria, edita e desativa`; `listarServicos sem incluirInativos esconde o desativado`; `nome duplicado falha com "Já existe um serviço com esse nome."`; `preço negativo falha`.
- [ ] **Step 2:** Rodar: FAIL. **Step 3:** Implementar serviços, actions e tela. **Step 4:** Rodar: PASS.
- [ ] **Step 5:** Verificar no navegador (viewport 375×812 e PC): salvar os 4 prazos; recarregar e os valores persistem; criar "Landing page" por R$ 900,00; desativar Manutenção.
- [ ] **Step 6:** Commit: `feat: prazos comerciais e catalogo de servicos nas configuracoes`.

---

### Task 7: Serviços de propostas (criar, itens, versões, enviar, recusar)

**Files:**
- Create: `supabase/migrations/20261018030000_rpc_propostas.sql`, `src/lib/servicos/propostas.ts`, `tests/integracao/propostas.test.ts`

**Interfaces:**
- Consumes: `chamarRpc` e `public.mover_etapa` (Task 1), `ItemProposta`/`validarItem`/`totaisProposta` (Task 3), `obterConfig`, `agendarPrazo`.
- Produces (SQL, `security invoker`, transacionais; mensagens exatas):
  - `criar_proposta(p_lead_id uuid, p_titulo text) returns uuid`: cria a proposta e a versão 1; evento `proposta_criada {proposta_id}`. Lead inexistente → `'Lead não encontrado.'`.
  - `salvar_itens_versao(p_proposta_id uuid, p_itens jsonb, p_total_unico bigint, p_total_recorrente bigint) returns void`: só com status `rascunho` (senão `'Esta versão já foi enviada. Crie uma nova versão para alterar.'`; aceita → `'Proposta aceita não pode ser alterada.'`); substitui os itens da última versão e grava os totais.
  - `nova_versao(p_proposta_id uuid) returns int`: só de `enviada` ou `recusada` (rascunho → `'A versão atual ainda é um rascunho.'`; aceita → `'Proposta aceita não pode ser alterada.'`); copia a última versão e seus itens para `numero + 1`; status → `rascunho`; evento `proposta_nova_versao {proposta_id, versao}`.
  - `enviar_proposta(p_proposta_id uuid, p_data_retorno date) returns void`: só de `rascunho` (enviada → `'Esta versão já foi enviada.'`); sem itens → `'Adicione ao menos um item antes de enviar.'`; marca `enviada_em` na versão e status `enviada`; regra P2 de etapa via `public.mover_etapa` (só se a etapa mudar e o lead não for cliente); cancela retornos `proposta` pendentes do lead e cria um novo (`origem 'proposta'`, `p_data_retorno`, ciclo = maior ciclo do lead ou 1); evento `proposta_enviada {proposta_id, versao, total_unico, total_recorrente}`.
  - `recusar_proposta(p_proposta_id uuid) returns void`: só de `enviada` ou `rascunho`; status `recusada`; cancela retornos `proposta` pendentes do lead; evento `proposta_recusada`.
- Produces (TS):
  - `criarProposta(db, leadId: string, titulo?: string): Promise<string>`
  - `salvarItens(db, propostaId: string, itens: ItemProposta[]): Promise<void>`: valida cada item (`ErroNegocio(\`Item ${i + 1}: ${erro}\`)`), normaliza `parcelas = 1` e `mesInicio = null`/desconto conforme o tipo, calcula os totais e chama a RPC.
  - `novaVersao(db, propostaId): Promise<number>`, `enviarProposta(db, propostaId, hoje: DataISO): Promise<void>` (data do retorno = `agendarPrazo(hoje, config.diasRetornoProposta)`), `recusarProposta(db, propostaId): Promise<void>`.
  - `obterProposta(db, id): Promise<PropostaDetalhe>` com `PropostaDetalhe = { proposta: Proposta; lead: Lead; versoes: (VersaoProposta & { itens: ItemProposta[] })[] }` (versões da mais nova para a mais antiga; itens por `ordem`, convertidos para o formato do domínio). Inexistente → `ErroNegocio('Proposta não encontrada.')`.
  - `listarPropostasDoLead(db, leadId): Promise<PropostaResumo[]>` com `PropostaResumo = Proposta & { versaoAtual: number; totalUnicoCentavos: number; totalRecorrenteCentavos: number }` (mais recentes primeiro).
  - `valoresAbertosPorLead(db): Promise<Record<string, { unicoCentavos: number; recorrenteCentavos: number }>>` (P12).

- [ ] **Step 1: Escrever os testes que falham** (cada um com seu usuário; helper local `itemSite` = 150000 em 3x e `itemHospedagem` = 15000 mensal a partir de `2026-11-01`):
  - `criarProposta cria versão 1 em rascunho e registra evento`
  - `salvarItens grava itens e totais da versão`
  - `salvarItens com item inválido falha citando o número do item` (`'Item 2: Informe a descrição do item.'`)
  - `enviar v1 em 19/10 move o lead para proposta_enviada e cria retorno de proposta em 22/10`
  - `enviar cancela retornos de sequência pendentes` (lead com MVP enviado antes)
  - `enviar proposta sem itens falha`
  - `salvarItens em proposta enviada falha com "Crie uma nova versão"`
  - `nova versão copia os itens; enviar v2 move para negociacao e deixa um só retorno de proposta pendente`
  - `proposta para cliente existente não muda a etapa fechado` (lead movido para `fechado` antes)
  - `dias de retorno de proposta configurados são usados`: `salvarConfig({ diasRetornoProposta: 5 })`, enviar em 19/10 → retorno em 26/10 (24/10 é sábado).
  - `recusar mantém a etapa e cancela o retorno de proposta`
  - `valoresAbertosPorLead usa a última versão e ignora recusadas e leads perdidos`
- [ ] **Step 2:** `npm run test:int -- propostas`. Esperado: FAIL.
- [ ] **Step 3:** Implementar migration e serviço.
- [ ] **Step 4:** `npm run db:reset`, `npm run test:int`. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: servicos de propostas com versoes e retorno pos-envio`.

---

### Task 8: Aceite da proposta → contrato e cobranças iniciais

**Files:**
- Create: `supabase/migrations/20261018040000_rpc_contratos.sql`, `tests/integracao/aceite.test.ts`
- Modify: `src/lib/servicos/propostas.ts`, `tests/integracao/helpers.ts`

**Interfaces:**
- Consumes: `planejarCobrancasIniciais`, `horizonteCobrancas`, `diaVencimentoPadrao` (Task 4), `valorLiquido` (Task 3), `obterProposta` (Task 7), `mover_etapa` (Task 1).
- Produces (SQL): `aceitar_proposta(p_proposta_id uuid, p_versao_id uuid, p_descricao text, p_dia_vencimento int, p_data_inicio date, p_itens jsonb, p_cobrancas jsonb) returns uuid` (id do contrato). Trava a proposta. Status `aceita` → `'Esta proposta já foi aceita.'`; `recusada` → `'Proposta recusada: crie uma nova versão antes de aceitar.'`; `p_versao_id` diferente da última versão → `'A proposta mudou. Atualize a página e tente de novo.'`; sem itens → `'A proposta não tem itens.'`. Cria o contrato (`ativo`), os `contrato_itens` na ordem de `p_itens` e as cobranças de `p_cobrancas` (cada uma aponta para o item pelo `itemIndice`); status da proposta `aceita`, `aceita_em = p_data_inicio`; lead → `fechado` via `mover_etapa` se ainda não estiver (o que marca `cliente` e cancela pendentes); se já estiver fechado, só cancela os retornos `proposta` pendentes; evento `proposta_aceita {proposta_id, versao, contrato_id}`.
- Produces (TS): `aceitarProposta(db, propostaId: string, o: { hoje: DataISO; diaVencimento?: number; primeiroVencimento?: DataISO; descricao?: string }): Promise<string>`. Padrões: `diaVencimentoPadrao(hoje)`, `primeiroVencimento = hoje`, `descricao = proposta.titulo`. Dia fora de 1–28 → `ErroNegocio('O dia de vencimento deve ser entre 1 e 28.')`. Os itens do contrato levam o valor líquido.
- Produces (`helpers.ts`): `criarClienteComContrato(cliente: SupabaseClient): Promise<{ leadId: string; propostaId: string; contratoId: string }>`: lead + proposta com site 150000 em 3x e hospedagem 15000 mensal a partir de `2026-11-01`, enviada e aceita em `2026-10-19` (dia 19). Usado nas Tasks 9 e 10.

- [ ] **Step 1: Escrever os testes que falham:**
  - `critério 6 da spec`: v1 (site 1.500 em 3x + hospedagem 150/mês) enviada em 19/10; nova versão com 10% no site, enviada em 19/10; aceita em 19/10 → lead `fechado` e `cliente`; proposta `aceita` com 2 versões; contrato com dia 19 e início 19/10; cobranças `parcela` 1/3, 2/3, 3/3 de 45000 em 19/10, 19/11, 19/12 e `mensalidade` 2026-11 de 15000 em 19/11; nenhum retorno pendente.
  - `aceitar duas vezes falha com "Esta proposta já foi aceita." e cria um só contrato` (Review Focus 3; também com `Promise.allSettled` de duas chamadas simultâneas: exatamente uma resolve).
  - `aceitar proposta recusada falha`
  - `dia de vencimento 29 é rejeitado`
  - `aceite à vista com primeiro vencimento escolhido`: item único de 90000 em 1x, `primeiroVencimento: '2026-10-25'` → uma cobrança `avista` em 25/10.
  - `cliente existente: segundo contrato a partir de nova proposta` (usa `criarClienteComContrato`, cria e aceita outra proposta → 2 contratos no lead, etapa continua `fechado`).
- [ ] **Step 2:** Rodar: FAIL. **Step 3:** Implementar. **Step 4:** `npm run db:reset`, `npm run test:int`. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: aceite de proposta gera contrato e cobrancas previstas`.

---

### Task 9: Serviços de cobranças (mensalidades, painel, pagamento)

**Files:**
- Create: `src/lib/servicos/cobrancas.ts`, `tests/integracao/cobrancas.test.ts`
- Modify: `supabase/migrations/20261018040000_rpc_contratos.sql` (acrescentar no fim)

**Interfaces:**
- Consumes: `competenciasFaltantes`, `valorVigente`, `vencimentoNaCompetencia`, `horizonteCobrancas`, `situacaoCobranca` (Task 4), `obterConfig`, `criarClienteComContrato` (Task 8).
- Produces (SQL): `marcar_pago(p_cobranca_id uuid, p_pago_em date, p_valor_pago bigint) returns void` (paga → `'Esta cobrança já foi paga.'`; suspensa → `'Cobrança suspensa: reative o contrato para receber.'`; evento `cobranca_paga {cobranca_id, valor}` no lead); `desfazer_pagamento(p_cobranca_id uuid) returns void` (só paga → aberta, limpa `pago_em` e valor; senão `'Esta cobrança não está paga.'`; evento `pagamento_desfeito`).
- Produces (TS):
  - `interface CobrancaResumo extends Cobranca { rotulo: string; lead: { id: string; nome_contato: string; empresa: string | null; whatsapp: string }; contratoDescricao: string }`
  - `garantirMensalidades(db, hoje: DataISO): Promise<number>`: para itens recorrentes de contratos `ativo` ou `pausado`, cria as competências faltantes até `horizonteCobrancas(hoje)` com `valorVigente` e status `aberta` (ativo) ou `suspensa` (pausado). Um único `upsert` com `onConflict: 'contrato_item_id,competencia'` e `ignoreDuplicates: true`. Retorna quantas criou.
  - `cobrancasDoPainel(db, hoje): Promise<{ atrasadas: CobrancaResumo[]; vencendo: CobrancaResumo[] }>` (abertas; usa `config.diasLembreteCobranca`; ordenadas por vencimento).
  - `listarCobrancas(db, filtro: { mes: string /* 'YYYY-MM' */ } | { atrasadas: true }, hoje: DataISO): Promise<CobrancaResumo[]>`
  - `marcarPago(db, id, o: { pagoEm: DataISO; valorPagoCentavos?: number }): Promise<void>` (padrão: valor da cobrança), `desfazerPagamento(db, id): Promise<void>`
  - `editarCobranca(db, id, o: { vencimento?: DataISO; valorCentavos?: number }): Promise<void>`: só aberta ou suspensa (senão `ErroNegocio('Só é possível editar cobranças não pagas.')`).

- [ ] **Step 1: Escrever os testes que falham** (todos partem de `criarClienteComContrato`):
  - `garantirMensalidades em 05/12 cria dezembro e janeiro e não duplica` (Review Focus 4): 1ª chamada → 2; 2ª → 0; depois `Promise.all` de duas chamadas em `2027-02-03` → no total há 1 mensalidade por competência de 2026-11 a 2027-03.
  - `painel em 15/11 não mostra nada vencendo; em 16/11 mostra parcela 2 e mensalidade de 19/11`
  - `painel em 20/11 mostra como atrasadas a parcela 1 (não paga) e as de 19/11`
  - `marcarPago grava data e valor; segunda vez falha com "Esta cobrança já foi paga."` (Review Focus 3)
  - `marcarPago com valor diferente guarda o valor recebido e sai do painel`
  - `desfazerPagamento volta a cobrança para aberta`
  - `listarCobrancas do mês 2026-11 traz parcela 2 e mensalidade com rótulos` (`'Site · parcela 2 de 3'`, `'Hospedagem · mensalidade 11/2026'`)
  - `editarCobranca muda o vencimento de uma aberta; numa paga falha`
- [ ] **Step 2:** Rodar: FAIL. **Step 3:** Implementar. **Step 4:** `npm run db:reset`, `npm run test:int`. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: servicos de cobrancas, mensalidades e pagamento`.

---

### Task 10: Ciclo de vida do contrato (pausar, reativar, cancelar, reajustar)

**Files:**
- Create: `src/lib/servicos/contratos.ts`, `tests/integracao/contratos.test.ts`
- Modify: `supabase/migrations/20261018040000_rpc_contratos.sql` (acrescentar no fim)

**Interfaces:**
- Consumes: `valorVigente`, `competenciaDe` (Task 4), `garantirMensalidades` (Task 9).
- Produces (SQL; contrato cancelado → `'Contrato cancelado não pode ser alterado.'` em todas):
  - `pausar_contrato(p_contrato_id uuid, p_hoje date)`: só de `ativo` (senão `'Este contrato não está ativo.'`); regra P9; `pausado_em`; evento `contrato_pausado`.
  - `reativar_contrato(p_contrato_id uuid, p_hoje date)`: só de `pausado` (senão `'Este contrato não está pausado.'`); regra P9; limpa `pausado_em`; evento `contrato_reativado`.
  - `cancelar_contrato(p_contrato_id uuid, p_hoje date)`: de `ativo` ou `pausado`; regra P10; `cancelado_em`; evento `contrato_cancelado`.
  - `reajustar_item(p_item_id uuid, p_a_partir_de date, p_valor bigint)`: só item `recorrente` (senão `'Só mensalidades podem ser reajustadas.'`); upsert em `reajustes`; atualiza o valor das mensalidades `aberta`/`suspensa` do item com competência ≥ `p_a_partir_de`; evento `contrato_reajustado {item, valor, a_partir_de}`.
- Produces (TS):
  - `interface ContratoResumo extends Contrato { lead: { id: string; nome_contato: string; empresa: string | null }; itens: ContratoItem[]; mensalidadeVigenteCentavos: number }` (soma de `valorVigente` dos itens recorrentes na competência de hoje; 0 se não estiver ativo).
  - `listarContratos(db, hoje: DataISO, filtro?: { status?: StatusContrato; leadId?: string }): Promise<ContratoResumo[]>`
  - `mrrAtivo(contratos: ContratoResumo[]): number` (soma de `mensalidadeVigenteCentavos`)
  - `obterContrato(db, id, hoje): Promise<ContratoDetalhe>` com `{ contrato: ContratoResumo; reajustes: Reajuste[]; cobrancas: CobrancaResumo[] }` (inexistente → `ErroNegocio('Contrato não encontrado.')`).
  - `pausarContrato(db, id, hoje)`, `reativarContrato(db, id, hoje)`, `cancelarContrato(db, id, hoje)`: `Promise<void>`.
  - `reajustarMensalidade(db, itemId, o: { valorCentavos: number; aPartirDe: Competencia }): Promise<void>` (valor ≤ 0 → `ErroNegocio('Informe o novo valor da mensalidade.')`).

- [ ] **Step 1: Escrever os testes que falham** (partindo de `criarClienteComContrato`, com `garantirMensalidades` em 05/12 quando indicado):
  - `pausar em 01/11 suspende as cobranças a partir de 01/11 e mantém a parcela de 19/10 aberta`
  - `contrato pausado: mensalidades novas nascem suspensas e o contrato sai do MRR`
  - `reativar em 05/01/2027: parcelas voltam a abertas, mensalidades de nov e dez ficam suspensas, janeiro volta a aberta` (pausado em 01/11; `garantirMensalidades` em 05/12 durante a pausa)
  - `cancelar em 01/12 apaga as não pagas de 01/12 em diante, mantém a paga e a vencida, e o MRR fica 0` (parcela 1 paga antes; `garantirMensalidades` em 01/12; a parcela 2 e a mensalidade de 19/11 são as vencidas que ficam)
  - `reajuste para 180,00 a partir de 2027-01: janeiro aberto recalculado, dezembro continua 150,00, e fevereiro nasce com 180,00` (`garantirMensalidades` em 05/12, reajuste, depois `garantirMensalidades` em 10/01/2027)
  - `reajustar item de valor único falha`
  - `pausar contrato cancelado falha com "Contrato cancelado não pode ser alterado."`
- [ ] **Step 2:** Rodar: FAIL. **Step 3:** Implementar. **Step 4:** `npm run db:reset`, `npm run test:int`. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat: pausar, reativar, cancelar e reajustar contratos`.

---

### Task 11: Telas de propostas

**Files:**
- Create: `src/app/(app)/leads/[id]/propostas/[propostaId]/page.tsx`, `src/app/(app)/leads/[id]/propostas/actions.ts`, `src/components/propostas/ListaPropostasDoLead.tsx`, `src/components/propostas/EditorItens.tsx`, `src/components/propostas/ResumoTotais.tsx`, `src/components/propostas/HistoricoVersoes.tsx`, `src/components/propostas/DialogoAceite.tsx`
- Modify: `src/app/(app)/leads/[id]/page.tsx`, `src/components/leads/LinhaDoTempo.tsx`

**Interfaces:**
- Consumes: serviços das Tasks 7, 8 e 10 (`listarContratos` com `leadId`), `listarServicos`, domínio das Tasks 2–4.
- Server actions (todas devolvem `RespostaAcao` e revalidam `/leads/[id]`, a página da proposta, `/hoje` e `/funil`): `acaoCriarProposta(leadId)` (redireciona para a proposta), `acaoSalvarItens(propostaId, itens: ValoresItem[])` com `ValoresItem = { servicoId: string; descricao: string; tipo: string; valor: string; parcelas: string; mesInicio: string /* 'YYYY-MM' */; descontoTipo: '' | 'percentual' | 'valor'; desconto: string }` (converte com `lerReais`/`lerPercentual`; texto inválido → `'Item N: valor inválido.'`), `acaoNovaVersao`, `acaoEnviarProposta`, `acaoRecusarProposta`, `acaoAceitarProposta(propostaId, { diaVencimento: string; primeiroVencimento: string; descricao: string })` (redireciona para `/clientes/[contratoId]`).

Comportamento:
- **Detalhe do lead:** nova seção "Propostas" (antes da linha do tempo) com cada proposta: título, "v2", selo de status, `formatarValorNegociacao` dos totais, link para abrir; botão "+ Nova proposta". Se o lead tem contratos, seção "Contratos" com descrição, status e link para `/clientes/[id]`. Selo "Cliente" no cabeçalho quando `lead.cliente`.
- **Página da proposta** (celular primeiro):
  - Cabeçalho: título, lead (link), status e versão atual.
  - Em rascunho, `EditorItens`: cada item tem serviço do catálogo (opcional; ao escolher, preenche descrição, tipo e preço, que continuam editáveis), descrição, tipo (Valor único / Mensal), valor (R$), parcelas (só único; 1 = "à vista") ou mês de início (só mensal; padrão P8), desconto (nenhum / % / R$) e "Remover"; "+ Item"; botão "Salvar". Fora de rascunho, os itens aparecem só para leitura.
  - `ResumoTotais` ao vivo: subtotal, desconto, total único (com "em 3x de R$ 450,00" quando houver um único item parcelado) e total mensal.
  - Botões por status: rascunho → "Salvar", "Enviar proposta", "Aceitar"; enviada → "Aceitar", "Recusar", "Nova versão"; recusada → "Nova versão"; aceita → link "Ver contrato".
  - `DialogoAceite`: dia de vencimento (padrão `diaVencimentoPadrao(hoje)`), 1º vencimento (padrão hoje), descrição do contrato (padrão o título) e a prévia das cobranças geradas por `planejarCobrancasIniciais` antes de confirmar.
  - `HistoricoVersoes`: as versões anteriores, recolhidas, com itens e totais e a data de envio.
  - Botões desabilitados enquanto a action roda; `ErroNegocio` aparece como aviso.
- **LinhaDoTempo:** rótulos dos eventos novos: "Proposta criada", "Proposta enviada (v2 · R$ 1.350,00 + R$ 150,00/mês)", "Nova versão da proposta (v2)", "Proposta aceita", "Proposta recusada", "Contrato pausado", "Contrato reativado", "Contrato cancelado", "Mensalidade reajustada para R$ 180,00 a partir de 01/2027", "Pagamento registrado: R$ 450,00", "Pagamento desfeito".

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** Verificar no navegador (375×812 e PC): criar proposta com Site (catálogo) R$ 1.500 em 3x e Hospedagem R$ 150/mês; enviar (lead em "Proposta enviada", retorno em +3 dias aparece no detalhe); nova versão com 10% no site; enviar (lead em "Negociação"); a v1 aparece no histórico; aceitar com a prévia mostrando 3 × R$ 450,00 e a mensalidade; o lead vira cliente com o contrato listado. Digitar `1500.50` no valor mostra R$ 1.500,50 nos totais.
- [ ] **Step 3:** Commit: `feat: telas de propostas com versoes e aceite`.

---

### Task 12: Telas de clientes, contratos e cobranças

**Files:**
- Create: `src/app/(app)/clientes/page.tsx`, `src/app/(app)/clientes/[contratoId]/page.tsx`, `src/app/(app)/clientes/cobrancas/page.tsx`, `src/app/(app)/clientes/actions.ts`, `src/components/cobrancas/CartaoCobranca.tsx`, `src/components/clientes/CartaoContrato.tsx`, `src/components/clientes/AcoesContrato.tsx`, `src/components/clientes/FormReajuste.tsx`
- Modify: `src/components/shell/itens.ts` (item "Clientes", `/clientes`, ícone `Briefcase`, entre Agenda e Config)

**Interfaces:**
- Consumes: serviços das Tasks 9 e 10, `formatarReais`, `rotuloCobranca`, `mensagemCobranca`, `linkWhatsApp`, `resumirMes`.
- Server actions (revalidam `/hoje` e `/clientes` com `'layout'`): `acaoMarcarPago(cobrancaId, pagoEm?: string, valor?: string)` (sem argumentos: hoje e valor cheio), `acaoDesfazerPagamento`, `acaoEditarCobranca(cobrancaId, vencimento: string, valor: string)`, `acaoPausarContrato`, `acaoReativarContrato`, `acaoCancelarContrato`, `acaoReajustar(itemId, valor: string, aPartirDe: string /* 'YYYY-MM' */)`.
- `CartaoCobranca` (usado também em "Hoje"): props `{ cobranca: CobrancaResumo; hoje: DataISO; diasLembrete: number }`. Mostra cliente, `rotulo`, valor, "Vence dd/mm" ou "Venceu dd/mm" (atrasada, borda laranja), selo de situação. Abertas: **"Recebido"** (1 toque: hoje, valor cheio), "Outro valor/data" (expande data e valor), "WhatsApp" (`mensagemCobranca`). Pagas: "Pago em dd/mm · R$ X" e "Desfazer". Botões desabilitados durante a action.

Comportamento:
- **/clientes** chama `garantirMensalidades` antes de listar. Cabeçalho "Clientes" com **MRR ativo** (`mrrAtivo`) e link "Cobranças do mês". Filtro por situação (Ativos, padrão; Pausados; Cancelados; Todos) no query string. Um `CartaoContrato` por contrato: cliente, descrição, itens (único: "R$ 1.350,00 em 3x"; mensal: "R$ 150,00/mês desde 11/2026"), dia de vencimento, início e status.
- **/clientes/[contratoId]:** dados do contrato e do cliente (link para o lead), itens com o valor vigente, `FormReajuste` em cada item mensal, `AcoesContrato` (Pausar / Reativar / Cancelar, cada um com confirmação dizendo o que acontece com as cobranças, conforme P9 e P10), e a lista de cobranças com `CartaoCobranca` e edição de vencimento/valor nas não pagas.
- **/clientes/cobrancas:** navegação "‹ mês anterior / próximo ›" (`?mes=YYYY-MM`, padrão o mês de hoje) e o filtro "Atrasadas" (`?atrasadas=1`); totais do mês com `resumirMes` (previsto, recebido, a receber); lista com `CartaoCobranca`.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** Verificar no navegador (375×812 e PC), com o cliente criado na Task 11: o contrato aparece com o MRR certo; "Recebido" marca a parcela de hoje e o total recebido do mês muda; "Desfazer" volta; reajustar a hospedagem a partir do mês seguinte muda só as mensalidades daquele mês em diante; pausar e reativar seguem P9; a barra inferior com 6 itens cabe em 375px sem cortar rótulos.
- [ ] **Step 3:** Commit: `feat: telas de clientes, contratos e cobrancas`.

---

### Task 13: "Hoje" com cobranças atrasadas e lembretes

**Files:**
- Modify: `src/app/(app)/hoje/page.tsx`

**Interfaces:**
- Consumes: `garantirMensalidades`, `cobrancasDoPainel` (Task 9), `obterConfig`, `CartaoCobranca` (Task 12).

Comportamento:
- A página chama `garantirMensalidades(db, hoje)` antes de carregar o painel.
- Depois das seções de retornos e tarefas, uma seção **Cobranças**: primeiro as atrasadas (borda laranja), depois "Vencem em até N dias" (N = `diasLembreteCobranca`). Seção oculta quando vazia.
- O contador do cabeçalho inclui as cobranças ("3 retornos · 1 tarefa · 2 cobranças"). O estado vazio "Nada para hoje. 🎯" só aparece se não houver retornos, tarefas nem cobranças.
- Ao marcar "Recebido", o cartão some de "Hoje".

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** Verificar no navegador: com um contrato aceito há mais de um mês (ajustar `vencimento` via SQL no Studio local, porta 54423), a mensalidade vencida aparece como atrasada (critério de aceite 7 da spec); uma cobrança que vence em 2 dias aparece em "Vencem em até 3 dias"; "WhatsApp" abre `wa.me` com a mensagem de cobrança; "Recebido" tira o cartão; recarregar a página várias vezes não duplica mensalidades.
- [ ] **Step 3:** Commit: `feat: cobrancas atrasadas e lembretes na tela Hoje`.

---

### Task 14: Funil com valor em negociação por etapa

**Files:**
- Modify: `src/app/(app)/funil/page.tsx`, `src/components/funil/QuadroFunil.tsx`, `src/components/funil/CartaoLeadFunil.tsx`

**Interfaces:**
- Consumes: `valoresAbertosPorLead` (Task 7), `formatarValorNegociacao` (Task 2).
- `QuadroFunil` ganha a prop `valores: Record<string, { unicoCentavos: number; recorrenteCentavos: number }>`.

Comportamento:
- No topo de cada coluna (PC) e na aba ativa (celular), abaixo do contador: a soma dos valores dos leads daquela etapa, com `formatarValorNegociacao`; nada quando a soma for zero. Perdido não soma (P12).
- O cartão do lead mostra o valor dele, quando houver.
- Ao arrastar um cartão, a soma das colunas acompanha a etapa otimista.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** Verificar no navegador: com uma proposta enviada de R$ 1.500 + R$ 150/mês, a coluna "Proposta enviada" mostra "R$ 1.500,00 + R$ 150,00/mês"; arrastar o lead para "Negociação" move a soma; recusar a proposta zera o valor.
- [ ] **Step 3:** Commit: `feat: valor em negociacao por etapa no funil`.

---

### Task 15: Verificação final do Plano 2

**Files:**
- Create: `docs/superpowers/plans/2026-10-18-plano-2-decisoes-e-pendencias.md`
- Modify: `README.md` (seção curta: propostas, clientes e cobranças; como simular vencimentos pelo Studio local)

- [ ] **Step 1:** `npm test`, `npm run db:reset`, `npm run test:int`, `npm run lint` e `npm run build`. Esperado: tudo passa, sem erros.
- [ ] **Step 2:** Verificação de ponta a ponta no navegador, em 375×812 e no PC:
  1. Critério de aceite 6 da spec: proposta com R$ 1.500 em 3x + R$ 150/mês; 2ª versão com desconto; aceitar; o lead vira cliente e as parcelas e mensalidades aparecem como cobranças previstas.
  2. Critério 7: uma mensalidade vencida e não paga aparece como atrasada em "Hoje".
  3. Retorno 3 dias após enviar a proposta aparece em "Hoje" no dia certo (simular a data via SQL).
  4. Os critérios 1–5 do Plano 1 continuam funcionando (regressão rápida: MVP enviado, Hoje, Respondeu, editar datas, três Sem resposta).
- [ ] **Step 3:** Escrever o registro de decisões e pendências no mesmo formato do Plano 1: decisões tomadas na execução que não estão neste plano e pendências encontradas.
- [ ] **Step 4:** Commit: `docs: verificacao final e decisoes do plano 2`.
