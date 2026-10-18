# CRM Integra Sistemas — Documento de desenho

**Data:** 2026-10-18
**Status:** aguardando aprovação
**Dono:** Integra Sistemas (usuário único — o próprio dono, que faz toda a área comercial)

---

## 1. Intenção e o porquê

A Integra Sistemas vende sites, plataformas e sistemas internos. Hoje o comercial é feito por uma única pessoa, só com **prospecção ativa**, e controlado em **agenda de papel**.

O fluxo real de venda hoje: encontrar um negócio local sem site (atualmente corretores de imóveis), **montar um MVP do site personalizado para ele**, enviar o link pelo **WhatsApp** e depois insistir com retornos até a pessoa responder, negociar e fechar.

**A dor central:** perder o controle dos retornos depois que o link do MVP é enviado. Quem precisa ser chamado hoje? Quem já foi chamado três vezes? Quem pediu para voltar mês que vem?

O CRM existe para que **o sistema lembre os retornos no lugar do dono**, e para dar visão de funil, valores e resultados que a agenda de papel não dá. No futuro entram tráfego pago e outros canais de captação, então a origem do lead precisa ser registrada desde já.

**Sucesso:** toda manhã o dono abre o CRM (no celular ou no PC), vê a lista "Retornos de hoje", chama cada lead pelo WhatsApp com um toque, marca o resultado, e nenhum lead se perde por esquecimento. No fim do mês ele sabe quanto vendeu, quanto entra de mensalidade e qual nicho/origem converte melhor.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Sequência automática de retornos após o envio do link do MVP, com prazos editáveis por lead.
- Tela diária de retornos e tarefas, utilizável no celular com o polegar.
- Funil de vendas com cadastro e histórico completo de cada lead/cliente.
- Propostas com valores flexíveis (único e/ou recorrente), com versões de negociação.
- Controle de clientes ativos e das mensalidades a receber.
- Indicadores e relatórios comerciais.
- Funcionar no PC e no celular com os mesmos dados.
- **Custo mensal zero.**

**Não-objetivos (fora desta versão)**
- Multiusuário / equipe / permissões por papel (só um usuário por enquanto).
- Integração com a API oficial do WhatsApp, envio automático de mensagens ou leitura de conversas. O envio é sempre feito pelo dono, via link `wa.me` com texto pronto.
- Rastrear se o lead abriu o link do MVP.
- Emissão de boleto, Pix, nota fiscal ou integração bancária. Pagamentos são marcados manualmente.
- Integração com Meta Ads/Google Ads (tráfego pago ainda não existe; só a origem é registrada).
- Notificações push (pode vir depois; ver §9).

**Anti-objetivos (seria fracasso mesmo funcionando)**
- Ficar mais trabalhoso que a agenda de papel. Registrar "chamei, não respondeu" tem que levar 1–2 toques.
- Ser ruim de usar no celular.
- Gerar custo mensal.
- Virar um CRM genérico cheio de campos que o dono nunca preenche.

## 3. Restrições

- **Custo zero:** Supabase plano gratuito + Vercel plano Hobby. Observação: o Supabase gratuito pausa o projeto após 7 dias sem acesso; com uso diário isso não ocorre.
- **Idioma:** toda a interface em português (pt-BR); moeda em reais; datas no formato brasileiro; fuso `America/Araguaina` (Palmas-TO, UTC−3).
- **Repositório próprio:** a pasta `C:\Users\PC\Desktop\CRM Integra Sistemas` tem git próprio. Nunca commitar no repositório de `C:\Users\PC` (Integra Solar).
- **Identidade visual:** logo da Integra Sistemas em `docs/assets/logo-integra-sistemas.png`. Cores extraídas da logo: azul-marinho (~`#0B3A63`), laranja (~`#D9782D`) e azul-claro (~`#29ABE2`). O builder deve confirmar os hex exatos a partir do arquivo.
- Valores monetários guardados em **centavos (inteiro)** no banco.
- **Por enquanto, nada em serviços externos (decisão do dono):** não criar repositório no GitHub, não criar/alterar projetos no Supabase na nuvem e não fazer deploy na Vercel até o dono autorizar explicitamente. Todo o desenvolvimento e os testes acontecem só no computador local. O banco de desenvolvimento é o **Supabase local via Docker** (Supabase CLI), autorizado pelo dono; nenhuma conta ou projeto na nuvem é usado.

## 4. Como funciona — o que foi decidido

### 4.1 Lead e cadastro
Um lead representa uma empresa/pessoa prospectada. Campos essenciais:
- Nome do contato, nome da empresa, WhatsApp (obrigatório), e-mail (opcional), cidade.
- **Nicho** (corretor de imóveis, clínica, etc. — lista editável).
- **Origem** (prospecção ativa, indicação, tráfego pago, site, outro — lista editável).
- **Link do MVP** enviado (opcional) e data de envio.
- Observações livres.
- Etapa do funil e status.

O lead tem uma **linha do tempo (histórico)** com tudo que aconteceu: criação, link enviado, cada retorno e seu resultado, mudanças de etapa, propostas e versões, tarefas, anotações manuais.

Quando o lead fecha, ele **vira cliente** (o mesmo registro, marcado como cliente), mantendo todo o histórico.

### 4.2 Funil de vendas
Etapas (fixas nesta versão):
1. **Prospect** — cadastrado, ainda não abordado.
2. **MVP enviado** — link enviado; sequência de retornos ativa.
3. **Em conversa** — o lead respondeu.
4. **Proposta enviada**
5. **Negociação**
6. **Fechado (ganho)**
7. **Perdido** — com motivo de perda (lista editável).

Além das etapas, um lead pode estar **Frio**: terminou a sequência de retornos sem responder. Fica fora da lista diária até a data de reativação.

Visualização em **quadro (kanban)** com arrastar entre etapas no PC, e em **lista com filtros** (adequada ao celular).

### 4.3 Sequência de retornos (núcleo do sistema)
- Ao marcar **"MVP enviado"**, o sistema cria automaticamente retornos em **D+2, D+5 e D+10** (padrão configurável nas Configurações).
- **Por lead**, o dono pode editar a sequência: adiar ou antecipar um retorno, mudar as datas, adicionar ou remover retornos, ou trocar a sequência inteira.
- Cada retorno, ao ser feito, recebe um resultado em 1–2 toques:
  - **Respondeu** → a sequência para; o lead vai para "Em conversa".
  - **Pediu mais tempo** → o dono escolhe a nova data (atalhos: +3 dias, +1 semana, +1 mês, data livre).
  - **Sem interesse** → o lead vai para "Perdido" e o sistema pede o motivo.
  - **Sem resposta** → segue para o próximo retorno da sequência.
- Se o último retorno da sequência terminar **sem resposta**, o lead vira **Frio** e o sistema agenda uma **reativação em 30 dias** (configurável). Na reativação, ele volta para a lista diária e, se houver resposta, segue o fluxo normal.

### 4.4 Mensagens prontas e WhatsApp
- **Modelos de mensagem** editáveis nas Configurações, com variáveis (ex.: `{nome}`, `{empresa}`, `{link_mvp}`).
- Cada passo da sequência pode ter um modelo sugerido (1º retorno, 2º retorno, etc.).
- Botão **"WhatsApp"** no retorno: abre `https://wa.me/<numero>?text=<mensagem preenchida>`, no app do WhatsApp no celular ou no WhatsApp Web no PC. Também há **"copiar mensagem"**.

### 4.5 Agenda e tarefas
- Além dos retornos automáticos, o dono cria **tarefas avulsas** (reunião, ligação, entregar MVP, etc.), ligadas a um lead ou não, com data e hora opcional.
- Visão **Hoje** (retornos + tarefas do dia + atrasados) e visão **Semana**.
- Itens atrasados ficam destacados até serem feitos ou reagendados.

### 4.6 Propostas e negociações
- Uma proposta pertence a um lead e tem **itens**, cada um baseado (opcionalmente) no catálogo de serviços, com descrição e valor editáveis.
- Cada item é de um destes tipos:
  - **Valor único** — à vista ou parcelado em N vezes.
  - **Valor recorrente (mensal)** — com mês de início.
- Uma proposta pode misturar os dois tipos. A forma de cobrança muda de cliente para cliente.
- Desconto opcional na proposta.
- **Versões:** cada contraproposta cria uma nova versão; as anteriores ficam no histórico da negociação.
- Status da proposta: rascunho, enviada, aceita, recusada.
- Ao **enviar** uma proposta, o lead vai para "Proposta enviada" e o sistema cria um retorno em **3 dias** (configurável).
- Ao **aceitar** uma proposta, o lead vai para "Fechado", vira cliente, e a proposta aceita vira o **contrato** dele (o que contratou, valores, parcelas e mensalidade).

### 4.7 Clientes ativos e mensalidades (administração e controle)
- Lista de **clientes ativos**: o que contratou, valor da mensalidade, dia de vencimento, data de início, situação (ativo, pausado, cancelado).
- O sistema gera, para cada mês, as **cobranças previstas**: as mensalidades e as parcelas do valor único.
- O dono marca **"pago"** (com data e valor recebido). O registro é manual.
- Cobranças vencidas e não pagas aparecem como **atrasadas** no painel do dia.
- **Lembrete** alguns dias antes do vencimento (padrão 3 dias, configurável) para o dono cobrar o cliente.

### 4.8 Indicadores e relatórios
- **Painel do dia (tela inicial):** retornos de hoje, atrasados, tarefas, propostas aguardando resposta, cobranças vencendo ou atrasadas.
- **Funil:** quantidade de leads e valor em negociação por etapa.
- **Conversão:** MVPs enviados → respostas → propostas → fechamentos, com filtro por **nicho**, **origem** e período.
- **Financeiro comercial:** vendido no mês (valor único), **receita recorrente mensal (MRR)** ativa, ticket médio, tempo médio até fechar, recebido x a receber no mês.
- **Motivos de perda:** distribuição dos motivos.
- Filtro de período em todos os relatórios.

### 4.9 Configurações
- Sequência padrão de retornos, prazo de reativação de frios, prazo do retorno após proposta, antecedência do lembrete de cobrança.
- Modelos de mensagem.
- Catálogo de serviços com preço de referência e tipo (único/recorrente). Ex.: site, plataforma, sistema interno, hospedagem, manutenção.
- Listas editáveis: nichos, origens, motivos de perda.
- **Exportar** dados para planilha (CSV/Excel) como backup.

### 4.10 Extras sugeridos (aceitos pelo dono)
- **Importar leads** de planilha (CSV/Excel) para prospecção em massa, com detecção de WhatsApp duplicado.
- **Busca rápida** global por nome, empresa ou telefone.
- Aviso de **lead duplicado** (mesmo WhatsApp) no cadastro manual.

### 4.11 Acesso
- Usuário único, login por **e-mail e senha** (Supabase Auth). Sem tela de cadastro pública: a conta é criada uma vez.
- App web instalável no celular (**PWA**: ícone na tela inicial, abre em tela cheia).

## 5. Decisões técnicas (escolha do Claude, não discutidas a fundo com o dono)

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS, banco e autenticação no **Supabase**, hospedagem na **Vercel**. Escolhida por ser a mesma família usada em outros projetos do dono, por ter plano gratuito e por permitir acesso de qualquer lugar.
- **PWA** via manifest + service worker simples (instalável; funcionamento offline não é exigido).
- Segurança: **RLS** no Supabase, com todas as linhas ligadas ao `user_id` dono, mesmo sendo usuário único.
- **Automações sem servidor pago:** as sequências e cobranças são datas gravadas no banco quando o evento acontece (link enviado, proposta enviada, contrato aceito). "Hoje" é uma consulta por data. A virada de lead para Frio e a geração das cobranças do mês podem ser feitas na abertura do app (verificação idempotente) ou num cron gratuito da Vercel/pg_cron. Não é necessário um processo rodando continuamente.
- Datas: armazenar como `date` (para retornos/vencimentos) e `timestamptz` (para histórico), calculando "hoje" no fuso `America/Araguaina`.

## 5.1 Regras definidas na revisão (escolha do Claude — o dono pode corrigir)

- **Dias corridos** em todos os prazos (D+2, D+5, D+10, 30 dias, 3 dias). Se a data cair em **sábado ou domingo, ela passa para a segunda-feira seguinte**.
- **Datas de cobrança:** no aceite da proposta, o contrato recebe um **dia de vencimento** (padrão: o dia do aceite; editável, de 1 a 28). O **à vista** e a **1ª parcela** vencem na data do aceite (editável). As demais parcelas vencem mês a mês, no dia de vencimento. A **mensalidade** começa no mês de início informado, também no dia de vencimento.
- **Desconto:** aplicado **por item**, em **% ou R$**. O total da proposta mostra separadamente o valor único e o recorrente já com os descontos. O MRR usa o valor recorrente com desconto.
- **Contratos:** entidade própria. **Um cliente pode ter vários contratos** (ex.: site agora, hospedagem depois). Um novo contrato pode nascer de uma nova proposta para um cliente existente. Um reajuste é feito editando o valor do contrato a partir de um mês; as cobranças futuras ainda não pagas são recalculadas.
- **Pausar/cancelar contrato:** as cobranças futuras ainda não pagas são removidas (cancelar) ou suspensas (pausar), e o contrato sai do MRR. As cobranças já pagas ou vencidas permanecem.
- **Conversão por período:** conta **eventos ocorridos no período** (MVPs enviados, respostas, propostas enviadas, fechamentos). Para isso, o histórico registra eventos **estruturados** (tipo + data + lead), não só texto.
- **Reativação de frios (decisão do dono):** na reativação, o lead recebe uma **nova sequência completa** de retornos. Se de novo não responder, volta a **Frio** e é reativado mais uma vez após 30 dias, **sem limite de ciclos**. O sistema **nunca** move um lead para "Perdido" sozinho: isso é sempre manual. "Frio" é um status por cima da etapa "MVP enviado".
- **Conta do Supabase (decisão do dono):** a definir pelo dono antes da etapa de configuração do banco. O plano de implementação deve deixar isso como um passo que depende dele (o código pode ser construído e testado localmente antes).
- **Hospedagem:** caso os termos do Vercel Hobby (uso não comercial) sejam um problema, a alternativa gratuita equivalente é o **Cloudflare Pages**. Isso não muda o restante do desenho.

## 6. O que fica a cargo de quem for construir

- Modelo de dados exato (tabelas, colunas, índices), desde que cubra o descrito acima.
- Biblioteca de componentes, gráficos e kanban.
- Layout das telas, respeitando: **celular primeiro** para Hoje/retornos/leads; quadro kanban e relatórios podem ser mais ricos no PC.
- Formato do export e do import (CSV e/ou XLSX).
- Mensagens padrão iniciais (o dono edita depois).
- Ordem de construção (sugestão: núcleo de leads + retornos + Hoje primeiro, depois propostas, depois clientes/cobranças, depois relatórios).

## 7. Identidade visual

- Logo: `docs/assets/logo-integra-sistemas.png`.
- Paleta base da logo: azul-marinho como cor principal, laranja como cor de destaque/ação, azul-claro como apoio.
- Visual limpo e profissional, botões grandes no celular.

## 8. Critérios de aceite (resumo)

1. Cadastro um lead pelo celular, marco "MVP enviado" e aparecem três retornos (D+2, D+5, D+10) na agenda.
2. No dia do retorno, ele aparece em "Hoje"; o botão WhatsApp abre a conversa com a mensagem preenchida.
3. Marcar "Respondeu" para a sequência e move o lead para "Em conversa".
4. Consigo alterar as datas da sequência de um lead específico.
5. Três "Sem resposta" seguidos deixam o lead Frio, e ele volta à lista 30 dias depois.
6. Crio uma proposta com R$ 1.500 em 3x + R$ 150/mês; faço uma 2ª versão com desconto; aceito; o lead vira cliente e as parcelas e mensalidades aparecem como cobranças previstas.
7. Uma mensalidade vencida e não paga aparece como atrasada no painel.
8. O relatório mostra a conversão por nicho e o MRR correto.
9. Os mesmos dados aparecem no PC e no celular.
10. Custo mensal: R$ 0.

## 9. Possíveis próximas versões (não construir agora)
- Notificações push dos retornos do dia.
- Captura automática de leads de formulário de site / tráfego pago (webhook).
- Gerar PDF da proposta com a marca da Integra Sistemas.
- Multiusuário (vendedores) com permissões.
