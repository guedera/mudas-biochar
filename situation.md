# Situação do projeto

## Feito

- `description.md` com o escopo do projeto (domínio da medição, páginas, requisito de custo zero).
- `README.md` com visão geral, tabela de campos da medição e estrutura de pastas.
- Pastas `frontend/`, `backend/`, `data/` criadas (cada uma com um README placeholder explicando seu papel).
- `.gitignore` populado (Python, frontend, `.env`, bancos locais, plataformas de deploy, dados/exports em `data/` e `backend/exports/`).
- Stack para custo zero definida em linhas gerais (ver "Decisões" abaixo).
- Backend FastAPI escafoldado em `backend/` (projeto Python movido da raiz): modelo/tabela `medicoes`, validação com Pydantic (enums de espécie/tratamento/injúria, arredondamento de altura/diâmetro), endpoints `POST /medicoes` e `GET /medicoes` (com filtro por bloco+espécie+tratamento = histórico de uma planta), testes automatizados (`uv run pytest`, 5 passando) e testado manualmente rodando o servidor local.
- Frontend React + Vite escafoldado em `frontend/`, com as 3 rotas (Cadastro, Relatório, Dashboard — as duas últimas ainda placeholder) e a **página de Cadastro completa**: todos os campos do domínio, botões toggle (folhas/sobrevivência/daninha), seleção múltipla de injúria, data preenchida automaticamente, e salvamento via `POST /medicoes` com validação e feedback de sucesso/erro. Testado ponta a ponta num browser real (Playwright): cadastro salva, valida no banco via API, formulário reseta, sem erros de console.
- Ajustes de UX/UI na página de Cadastro, pensando em uso principalmente em celular/tablet na vertical: layout em grid fixo de 2 colunas (Bloco+Espécie / Tratamento+Altura / Diâmetro 1+2), texto "(caule quadrado)" removido do Diâmetro 2, e os 3 botões toggle (Folhas/Viva/Daninha) sempre numa única linha (grid de 3 colunas fixas em vez de flex-wrap). Validado com screenshots em viewport de celular (390px) e tablet (768px) retrato.
- Backend: endpoint `GET /medicoes/export` (CSV via pandas), com filtros todos opcionais e combináveis: `blocos`/`especies`/`tratamentos`/`injurias` (todos multi-seleção, ex. `?tratamentos=T1&tratamentos=T2`), `sem_injuria` (medições sem nenhuma injúria), `tem_folhas`, `viva`, `tem_daninha`. `injurias` e `sem_injuria` se combinam por OR (ex. `injurias=AA&sem_injuria=true` traz quem tem AA **ou** não tem nenhuma injúria). Novo endpoint `GET /medicoes/blocos` retorna os blocos distintos já cadastrados, pra popular o filtro. Colunas exportadas com nomes amigáveis (Bloco, Espécie, ..., Data da medição) e folhas/sobrevivência/daninha como 1/0, igual à planilha original. `GET /medicoes` (histórico de planta) continua com bloco/espécie/tratamento de valor único, sem mudança. 14 testes no total (`uv run pytest`).
- Frontend: página de Relatório, seção "Dados" implementada por completo — Bloco (checkboxes dos blocos realmente cadastrados, buscados da API), Tratamento, Espécie e Injúria como grupos de checkboxes, todos **obrigatórios** (pelo menos um marcado em cada, validado antes do download, com erro exibido se faltar). Injúria tem uma opção extra "Sem nenhuma injúria" no mesmo grupo (não mais exclusiva — dá pra combinar com tipos específicos, ex. "AA" + "Sem nenhuma injúria"). Todos os 4 grupos reaproveitam o mesmo componente `GrupoFiltro`, com botões "Marcar todos"/"Desmarcar todos". Folhas/Sobrevivência/Daninha continuam como dropdowns opcionais de 3 estados (Todos válido). Legendas dos grupos estilizadas (branco/itálico/negrito sobre badge verde). Botão "Baixar CSV" aciona o download direto do backend. Testado ponta a ponta com Playwright (validação bloqueando download sem seleção obrigatória em qualquer um dos 4 grupos, combinação "AA" + "sem nenhuma injúria" conferida no CSV baixado, marcar/desmarcar todos) e em viewport de celular.

## Decisões

- Injúria ganhou um novo tipo: `A`, além dos já existentes `AA, APC, FS, FM, H, P` (atualizado no enum do backend, nas constantes do frontend usadas em Cadastro e Relatório, e na tabela de domínio do `README.md`).
- Requisito: hospedagem/infra com custo zero.
- Altura e Diâmetro são opcionais (podem ser `NA`); Injúria é opcional (uma medição pode não ter nenhuma).
- Diâmetro virou dois campos, Diâmetro 1 e Diâmetro 2 (caule quadrado tem os dois preenchidos; caule normal/redondo deixa Diâmetro 2 como `NA`).
- Confirmado: Bloco + Espécie + Tratamento identifica uma planta de forma única. Data é o que diferencia cada medição repetida dessa mesma planta ao longo do tempo.
- Schema: tabela única `medicoes` (sem tabela separada de "plantas") — cada linha é um evento de medição com `bloco`, `especie`, `tratamento`, `data` e os demais campos. Histórico de uma planta = `WHERE bloco/especie/tratamento = ... ORDER BY data`. Injúria fica em coluna JSON (lista de strings) na própria linha, em vez de tabela separada — funciona igual em SQLite (dev local) e Postgres (prod), sem depender do tipo array específico do Postgres.
- Stack proposta:
  - **Frontend**: React + Vite (confirmado) no Vercel/Netlify/Cloudflare Pages.
  - **Banco**: Postgres gerenciado no Supabase (free tier), para não depender de disco persistente.
  - **Backend**: FastAPI (`pyproject.toml`/`uv` movidos para `backend/`) hospedado grátis (ex. Render free), lendo/escrevendo no Postgres do Supabase.
- Confirmado: backend será custom em FastAPI (não usar a API automática do Supabase direto do frontend) — facilita export/import de XLS com pandas e centraliza validação/regras de negócio.
- Filtro de Bloco no Relatório virou grupo de checkboxes com os blocos realmente cadastrados (buscados via `GET /medicoes/blocos`), substituindo o antigo seletor por faixa (Todos/Específico/A partir de/Até/Entre X e Y).
- **Correção de semântica dos filtros de checkbox no Relatório (Bloco/Tratamento/Espécie/Injúria)**: nesses quatro grupos, "nenhum marcado" NÃO significa "sem filtro" — significa "não quero baixar nada". Marcar pelo menos uma opção em cada um é **obrigatório** pra baixar o CSV (validado no frontend antes do download; usar "Marcar todos" pra incluir todos os valores). Isso é diferente de Folhas/Sobrevivência/Daninha, que continuam opcionais com "Todos" como opção válida nos dropdowns.
- "Sem nenhuma injúria" é só mais uma opção dentro do grupo de checkboxes de Injúria (não é mais mutuamente exclusiva) — dá pra marcar, por exemplo, "AA" + "Sem nenhuma injúria" pra baixar tanto plantas com AA quanto plantas saudáveis numa exportação só.
- Legendas dos grupos de checkbox (Bloco, Tratamento, Espécie, Injúria) estilizadas como badge: texto branco, itálico, negrito, sobre fundo na cor de destaque (`--accent`) — texto branco puro direto no fundo da página ficaria ilegível no tema claro, por isso o badge colorido.

## Falta fazer

- Criar o projeto no Supabase e apontar o backend pra ele em produção (hoje só roda contra SQLite local).
- Segunda seção da página de Relatório: "Diferenças" (comparar medições de uma mesma planta ao longo do tempo) — ainda placeholder, escopo a definir.
- Exportação em XLS (hoje só CSV) — avaliar se é realmente necessário além do CSV.
- Definir e implementar o dashboard (escopo ainda em aberto) — página no frontend é só placeholder.
- Escrever o script/fluxo de importação da planilha original de dados já coletados (arquivo ainda não adicionado em `data/`).
- Configurar deploy gratuito (frontend + backend + banco) e documentar isso no `README.md`.
