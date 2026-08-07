# Situação do projeto

## Feito

- `description.md` com o escopo do projeto (domínio da medição, páginas, requisito de custo zero).
- `README.md` com visão geral, tabela de campos da medição e estrutura de pastas.
- Pastas `frontend/`, `backend/`, `data/` criadas (cada uma com um README placeholder explicando seu papel).
- `.gitignore` populado (Python, frontend, `.env`, bancos locais, plataformas de deploy, dados/exports em `data/` e `backend/exports/`).
- Stack para custo zero definida em linhas gerais (ver "Decisões" abaixo).
- Backend FastAPI escafoldado em `backend/` (projeto Python movido da raiz): modelo/tabela `medicoes`, validação com Pydantic (enums de espécie/tratamento/injúria, arredondamento de altura/diâmetro), endpoints `POST /medicoes` e `GET /medicoes` (com filtro por bloco+espécie+tratamento = histórico de uma planta), testes automatizados (`uv run pytest`, 5 passando) e testado manualmente rodando o servidor local.
- Frontend React + Vite escafoldado em `frontend/`, com as 3 rotas (Cadastro, Relatório, Dashboard — as duas últimas ainda placeholder) e a **página de Cadastro completa**: todos os campos do domínio, botões toggle (folhas/sobrevivência/daninha), seleção múltipla de injúria, data preenchida automaticamente, e salvamento via `POST /medicoes` com validação e feedback de sucesso/erro. Testado ponta a ponta num browser real (Playwright): cadastro salva, valida no banco via API, formulário reseta, sem erros de console.

## Decisões

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

## Falta fazer

- Criar o projeto no Supabase e apontar o backend pra ele em produção (hoje só roda contra SQLite local).
- Implementar a página de relatório (filtros + export CSV/XLS) — endpoint de export ainda não existe no backend, e a página no frontend é só placeholder.
- Definir e implementar o dashboard (escopo ainda em aberto) — página no frontend é só placeholder.
- Escrever o script/fluxo de importação da planilha original de dados já coletados (arquivo ainda não adicionado em `data/`).
- Configurar deploy gratuito (frontend + backend + banco) e documentar isso no `README.md`.
