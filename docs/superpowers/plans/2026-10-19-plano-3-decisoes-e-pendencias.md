# Plano 3 — decisões tomadas na execução e pendências menores

Este é o registro da execução do Plano 3, feita no branch `plano-3-relatorios`. Ele cobriu relatórios, as propostas aguardando resposta em Hoje, a exportação e a importação por CSV e os reforços no banco.

As decisões D1–D17 você já aprovou, e elas estão no plano. Aqui ficam só as decisões tomadas durante a execução e as pendências menores.

## Decisões tomadas pelo Claude (revise e corrija se discordar)

| # | Decisão | Custo se estiver errada |
|---|---|---|
| E1 | O **tempo médio até fechar** ignora contratos cujo aceite tem data anterior ao cadastro do lead. São clientes antigos cadastrados depois, que não medem o ciclo de venda. Antes disso, o relatório mostrava "-65 dias". | Esses clientes ficam fora da média (continuam contando em vendido, contratos e ticket). |
| E2 | No **histórico exportado**, a coluna "Evento" usa o mesmo texto da linha do tempo do lead (ex.: "Lead cadastrado", "Etapa: Prospect → Proposta enviada"). A coluna "Detalhes" continua com os dados técnicos (JSON). | Só o texto da planilha. |
| E3 | Na **importação**, um link do MVP que não começa com `http://` ou `https://`, ou um e-mail fora do formato, fica em branco com um aviso na linha. O formulário manual já recusava esses valores. Isso impede que uma planilha de terceiros traga um link `javascript:` clicável. | Esse link ou e-mail precisa ser preenchido à mão depois. |
| E4 | O banco passou a recusar **link do MVP** que não comece com `http://` ou `https://` (check `leads_link_mvp_ck`). É uma defesa extra, porque o link aparece como botão clicável. | Nenhum dado legítimo usa outro formato. |
| E5 | Na **prévia da importação**, as linhas recusadas mostram o nome e o WhatsApp como estão na planilha, para você achar a linha. As colunas desconhecidas aparecem como "Colunas ignoradas: …". Se você trocar o nicho ou a origem padrão depois da prévia, ela é apagada e precisa ser gerada de novo. | Nenhum. |
| E6 | Nos **Relatórios**, as datas personalizadas só são aplicadas quando você sai do campo, para não recarregar a página a cada dígito do ano. Uma nota avisa: "Nicho e origem filtram só a conversão." | Nenhum. |
| E7 | Tasks pequenas de mesmo formato (1+2 e 6+8) foram feitas e revisadas juntas. | Nenhum para você. |

## Pendências menores (não bloqueiam)

**Dados e relatórios**
- A lista de contratos (e, por ela, o MRR) não pagina. Acima de 1000 contratos o valor ficaria menor que o real. Isso já era assim antes do Plano 3.
- Um motivo de perda chamado literalmente "Sem motivo" se juntaria ao grupo dos leads sem motivo.
- Um motivo desativado aparece como "Nome (inativo)" no relatório.
- Um contrato ou proposta sem itens não aparece na exportação. Isso não acontece na prática, porque os itens são obrigatórios.
- Uma célula exportada com `'` na frente (proteção contra fórmula) volta com o `'` se o arquivo for importado de novo.

**Importação**
- A leitura do CSV descarta uma linha que tem só `""`.
- Uma aspa no meio de um campo sem aspas faz o resto da linha ser lido como texto.
- Um arquivo "Texto Unicode" (UTF-16) do Excel não é aceito. Use "CSV UTF-8" ou "CSV (separado por vírgulas)".

**Código e testes**
- Faltam testes de integração para:
  - contrato cancelado no vendido;
  - tempo médio;
  - cobranças suspensas no relatório (estão cobertos nos testes unitários);
  - ordem e versão em "propostas aguardando";
  - conteúdo dos CSVs de retornos, tarefas e contratos;
  - checks de valor máximo, parcelas e cobranças.
- Alguns testes de integração usam a data real de hoje e podem falhar se rodarem exatamente na virada da meia-noite.
- Há casts de tipo (`as unknown as`) nas leituras com junção e um `Record<string, any>` na exportação.
- Um tipo de evento desconhecido aparece na linha do tempo com o nome técnico.
- As funções do banco ainda preenchem `updated_at` da proposta à mão, o que é redundante com o novo gatilho.
- Um item de proposta acima de R$ 10.000.000,00 receberia um erro técnico do banco em vez de uma mensagem amigável. A tela já limita a digitação a esse valor.
