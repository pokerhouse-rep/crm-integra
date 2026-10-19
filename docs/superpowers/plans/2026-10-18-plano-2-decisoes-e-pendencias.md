# Plano 2 — decisões tomadas na execução e pendências menores

Registro da execução do Plano 2 (branch `plano-2-comercial`: propostas, clientes, contratos e cobranças). As decisões P1–P15 já foram aprovadas por você no início e estão no plano; aqui ficam só as decisões tomadas durante a execução, o que ficou em aberto e as pendências menores. Use como ponto de partida do próximo plano.

## Decisões tomadas pelo Claude (revise e corrija se discordar)

| # | Decisão | Custo se estiver errada |
|---|---|---|
| Q1 | Quem implementa continua proibido de publicar (push, deploy, nuvem). Só o controlador aplica as migrations no Supabase da nuvem e faz push/merge no fim, depois da revisão final. | Nenhum; a `main` continua publicável durante o trabalho. |
| Q2 | A função nova que cria o catálogo padrão de serviços roda com permissões elevadas e, por isso, fica fechada para chamada direta (`revoke`), como já foi feito com a função de dados padrão em produção. | Nenhum. |
| Q3 | Depois de qualquer `db:reset`, o usuário de desenvolvimento é recriado a partir de `DEV_LOGIN_*` do `.env.local`. | Nenhum. |
| Q4 | Toda função nova do banco só pode ser chamada por usuário logado (nunca anônimo). Isso inclui `aplicar_resultado` e `mover_etapa`, ajustadas na mesma linha. | Nenhum. |
| Q5 | Item de valor único cujo valor líquido em centavos é menor que o número de parcelas é rejeitado ("O valor é baixo demais para esse número de parcelas."). Descontos com fração de centavo também são rejeitados. | Limite raro (valores minúsculos). |
| Q6 | Mensagens de erro de proposta recusada: "Proposta recusada. Crie uma nova versão para enviar." / "...para alterar." e "Esta proposta já foi recusada." | Só o texto. |
| Q7 | Ao reativar um contrato, as mensalidades faltantes são geradas antes de reativar (nascem suspensas) e só voltam as que vencem de hoje em diante. Meses em que o contrato ficou pausado não são cobrados, mesmo que você não tenha aberto o app durante a pausa. | Nenhum. |
| Q8 | Reajuste de mensalidade recalcula as mensalidades abertas ou suspensas da data escolhida até o próximo reajuste já existente do mesmo item. A data do reajuste deve ser o dia 1 do mês. | Nenhum. |
| Q9 | Cancelar um contrato que estava pausado: parcelas e valor à vista suspensos e já vencidos voltam a "aberta" (continuam devidas e podem ser recebidas); mensalidades suspensas já vencidas são apagadas (mês pausado não é cobrado). | Nenhum; evita cobrança presa sem saída. |
| Q10 | O MRR (receita mensal recorrente) só conta um item mensal a partir do mês em que ele começa. | O MRR do mês do aceite pode aparecer 0 até a mensalidade começar. |
| Q11 | O botão flutuante "+ Lead" só aparece em Hoje e na lista de Leads (cobria totais e botões em outras telas). | Para criar lead a partir de outras telas, é preciso ir a Leads. |

## Pendências menores (não bloqueiam; avaliar no próximo plano)

**Recomendado antes de usar de verdade / antes de ir para a nuvem**
- Corrida rara na geração de mensalidades: se o app for aberto em duas abas no mesmo instante em que você pausa, cancela ou reajusta um contrato, a mensalidade criada pode sair com status errado (janela de milissegundos). Resolver com trava no banco.
- Alguns limites só são checados na tela e não no banco: desconto em R$ maior que zero, faixa de parcelas e de números de cobrança. Reforçar no banco.
- Como no Plano 1, as ligações entre tabelas não amarram o `user_id` (irrelevante com um usuário, importante se virar multiusuário).
- A data de atualização da proposta (`updated_at`) não tem gatilho no banco; hoje o serviço precisa preencher.
- Os totais de uma proposta enviados pela tela são aceitos pela RPC sem recálculo no banco.
- Ao enviar proposta para lead que já é cliente na mesma etapa, a sequência de retornos antiga não é cancelada nem o status frio limpo.

**Interface**
- Quando outra aba muda a proposta durante o aceite, a tela detecta a diferença, mas não há botão "Atualizar": é preciso recarregar a página. O mesmo vale depois de um erro de regra de negócio.
- A detecção de proposta alterada não pega uma edição que mantém total e quantidade de itens iguais.
- A linha "Desconto" única mistura valor único e mensal.
- "Desfazer" ainda aparece em cobrança paga de contrato cancelado.
- Painel de cobrança aberto não se atualiza se os dados mudarem por baixo; foco do diálogo não é controlado (como já registrado no Plano 1).
- Campo de mês (`type=month`) não é suportado no Safari de desktop.
- O rascunho de preços e prazos pode ficar velho se o serviço mudar em outra aba.
- Funil: sobra um espaço na página; arrastar no PC não foi testado no navegador (usa a mesma função do seletor, que foi testada).
- Um rascunho de proposta recusada que ganha nova versão vai para "Negociação" (regra P2 aplicada literalmente).

**Código**
- Valores digitados como `0.500` são lidos como R$ 500; `formatarPercentual` não trata negativo; `vencimentoNaCompetencia` não protege dia acima de 28 (garantido na entrada).
- `editarCobranca` ignora erro na checagem de existência e aceita valor 0 e sem teto; índice de item não numérico gera erro cru.
- `garantirMensalidades` lê todas as cobranças embutidas (pode pesar com muitos contratos).
- `aplicar_resultado` e `mover_etapa` travam tabelas em ordem diferente (risco teórico de deadlock; trocar para lead primeiro). `updated_at` do retorno é sempre atualizado; `p_frio` sem validação; parâmetro `origens` não usado em `cancelarPendentes`.
- Itens `null` no array da proposta; `somaDaEtapa` calculada duas vezes; linhas longas e uma soma inline sem teste no funil.
- Lacunas de teste: ações de preço/prazos, enviar proposta recusada, recusar rascunho, proposta aceita em valores abertos, teste cross-user que chegue até a RPC, versão desatualizada no aceite.
- O `grant` de `travar_contrato` fica longe do `revoke` na migration (cosmético).
- Usuários de teste continuam se acumulando no banco local (herdado do Plano 1).
