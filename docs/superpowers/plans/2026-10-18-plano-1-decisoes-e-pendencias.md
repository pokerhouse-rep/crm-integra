# Plano 1 — decisões tomadas na execução e pendências menores

Registro da execução do Plano 1 (branch `plano-1-nucleo`). Use como ponto de partida do Plano 2.

## Decisões tomadas pelo Claude (revise e corrija se discordar)

| # | Decisão | Custo se estiver errada |
|---|---|---|
| R1 | "Respondeu" só leva o lead para "Em conversa" se ele estiver em Prospect ou MVP enviado; leads mais avançados não regridem. | Em caso raro, a etapa não muda sozinha. |
| R2 | "Retorno X de Y" conta só retornos da sequência/reativação do mesmo ciclo (cancelados não contam). Retornos adiados/manuais aparecem como "Retorno avulso" e usam o modelo avulso. | Mensagem sugerida menos específica em retornos adiados. |
| R4 | O Supabase local do CRM usa portas próprias (API **54421**, banco 54422, Studio 54423) porque o CaseView ocupa as portas padrão. | Nenhum; só a URL difere do plano. |
| R5 | "Trocar sequência" mantém o ciclo atual e tira o lead do status frio. | O lead deixa de aparecer como frio ao trocar a sequência à mão. |
| R6 | Botão "Copiar texto" em vez de "Copiar mensagem" (cabe em 375px). | Só o texto. |
| R7/R9 | "Marcar MVP enviado" aparece só para Prospect/MVP enviado sem retornos pendentes; reenviar abre um ciclo novo, limpa frio e não regride a etapa. O selo "Frio · reativação" vem de o lead estar frio ou de o retorno ser de reativação. | Para reenviar MVP a um lead avançado, mover a etapa antes. |
| R8 | O funil reaproveita a ação de mover etapa da tela de leads. | Nenhum. |
| R10 | Mudar a etapa à mão para Em conversa ou adiante tira o lead do frio e cancela os retornos automáticos (sequência/reativação), mantendo os manuais/adiados. Fechado/Perdido cancelam todos. Sair de Perdido limpa o motivo. | A automação para ao mover à mão (intenção). |
| R11 | O "próximo retorno" da lista vem de um embed do PostgREST, sem lista de ids na URL. | Nenhum. |
| — | O serviço `marcarMvpEnviado` não checa a etapa; só a tela esconde o botão para Fechado/Perdido. | Uma chamada direta criaria um ciclo num lead fechado. |
| — | No login, qualquer erro que não seja "senha inválida" mostra "Não foi possível conectar ao servidor". | Mensagem imprecisa se houver excesso de tentativas. |

## Pendências menores (não bloqueiam; avaliar no Plano 2)

**Recomendado antes do Plano 2 / antes de ir para a nuvem**
- Tornar `registrarResultado` e `moverEtapa` transacionais (RPC no Postgres): hoje são várias escritas em sequência; uma falha no meio pode deixar o lead sem próximo passo.
- FKs entre tabelas não amarram o `user_id` (ex.: lead de um usuário apontando para nicho de outro). Irrelevante com um usuário, importante se virar multiusuário.
- Índices em `lead_id` das tabelas `retornos`, `tarefas`, `eventos`.
- Índice único parcial para garantir um só modelo avulso e um modelo por passo.

**Interface**
- Busca não mantém o texto pesquisado no campo; barra inferior sem `safe-area-inset-bottom` (iPhone).
- Diálogo de motivo sem focus trap; no funil, wrapper do cartão com `role=button` sem teclado; layouts mobile/desktop do funil ambos montados no DOM; coluna "Perdido" fora da tela no desktop; possível "pulo" do cartão após arrastar.
- Agenda: 4 colunas em telas médias (7 só em telas grandes); seletor de lead oferece leads perdidos.
- Configurações: aviso "Modelo salvo" some após salvar; sem aviso ao excluir o último modelo; texto com variável vazia gera "para a :".
- Ícone maskable reaproveita a imagem comum; README não cita que o gerador de ícones precisa do Pillow.

**Código**
- Detecção de WhatsApp duplicado depende do texto da mensagem de erro; evento "dados editados" lista todos os campos; fuso fixo duplicado em `LinhaDoTempo`; consulta de ciclos sem limite (teto de 1000 linhas do PostgREST); usuários de teste acumulam no banco local; 2 comentários com acentuação quebrada em `supabase/config.toml`.
