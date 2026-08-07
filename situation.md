# Situação do projeto

## Feito

- `description.md` com o escopo do projeto (domínio da medição, páginas, requisito de custo zero).
- `README.md` com visão geral, tabela de campos da medição e estrutura de pastas.
- Pastas `frontend/`, `backend/`, `data/` criadas (cada uma com um README placeholder explicando seu papel).
- `.gitignore` populado (Python, frontend, `.env`, bancos locais, plataformas de deploy, dados/exports em `data/` e `backend/exports/`).
- Stack para custo zero definida em linhas gerais (ver "Decisões" abaixo).

## Decisões

- Requisito: hospedagem/infra com custo zero.
- Altura e Diâmetro são opcionais (podem ser `NA`); Injúria é opcional (uma medição pode não ter nenhuma).
- Diâmetro virou dois campos, Diâmetro 1 e Diâmetro 2 (caule quadrado tem os dois preenchidos; caule normal/redondo deixa Diâmetro 2 como `NA`).
- Confirmado: Bloco + Espécie + Tratamento identifica uma planta de forma única. Data é o que diferencia cada medição repetida dessa mesma planta ao longo do tempo.
- Schema: tabela única `medicoes` (sem tabela separada de "plantas") — cada linha é um evento de medição com `bloco`, `especie`, `tratamento`, `data` e os demais campos. Histórico de uma planta = `WHERE bloco/especie/tratamento = ... ORDER BY data`. Injúria fica como array nativo do Postgres (`text[]`) na própria linha, em vez de tabela separada.
- Stack proposta:
  - **Frontend**: site estático (React/Vite ou HTML puro) no Vercel/Netlify/Cloudflare Pages.
  - **Banco**: Postgres gerenciado no Supabase (free tier), para não depender de disco persistente.
  - **Backend**: FastAPI (já há `pyproject.toml`/`uv` no repo) hospedado grátis (ex. Render free), lendo/escrevendo no Postgres do Supabase — ou, alternativa mais simples, usar a API REST automática do próprio Supabase e reduzir a necessidade de backend custom.

## Falta fazer

- Confirmar a stack definitiva (frontend, backend/API, banco) e decidir entre backend custom (FastAPI) vs. API automática do Supabase.
- Criar de fato a tabela `medicoes` no banco escolhido, seguindo o schema decidido acima.
- Implementar a página de cadastro (formulário principal).
- Implementar a página de relatório (filtros + export CSV/XLS).
- Definir e implementar o dashboard (escopo ainda em aberto).
- Escrever o script/fluxo de importação da planilha original de dados já coletados (arquivo ainda não adicionado em `data/`).
- Configurar deploy gratuito (frontend + backend + banco) e documentar como rodar localmente no `README.md`.
