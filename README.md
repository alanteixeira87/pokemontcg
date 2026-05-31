# Pokemon TCG Colecao Local

Aplicacao fullstack local para explorar cartas Pokemon TCG, gerenciar colecao, favoritos, cartas para troca, precos manuais e exportacao Excel.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS + Zustand
- Backend: Node.js + Express + TypeScript
- Banco: SQLite + Prisma ORM
- Integracoes: Pokemon TCG API, Axios, Zod, ExcelJS, dotenv

## Como rodar

### Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run db:init
npm run dev
```

API em `http://localhost:3001`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App em `http://localhost:5173`.

Se `prisma migrate dev` falhar por bloqueio do schema engine no Windows, rode `npm run db:init`. O script usa o Prisma Client para criar a tabela e indices de forma idempotente no SQLite local.

## Variaveis de ambiente

O arquivo `backend/.env` ja vem configurado para uso local:

```env
PORT=3001
DATABASE_URL="file:./dev.db"
POKEMON_TCG_API_URL="https://api.pokemontcg.io/v2"
POKEMON_TCG_API_KEY=""
POKEWALLET_API_URL="https://api.pokewallet.io"
POKEWALLET_API_KEY=""
JWT_SECRET="dev-secret-change-me"
```

A chave da Pokemon TCG API e opcional para uso basico, mas pode ser preenchida em `POKEMON_TCG_API_KEY`.

## Funcionalidades

- Explorar cartas com paginacao, busca com debounce e filtro por set
- Colecoes sempre atualizadas a partir de TCGdex + Pokemon TCG API, com equivalencia entre IDs oficiais novos e IDs TCGdex
- Exibir valor estimado da Pokemon TCG API quando disponivel
- Validar preco com PokéWallet quando `POKEWALLET_API_KEY` estiver configurada
- Adicionar cartas sem duplicar registros: se ja existir, soma quantidade
- Usar valor estimado como preco inicial, mantendo edicao manual livre
- Colecao com edicao inline de quantidade, preco manual, favorito e troca
- Pokedex com selecao de visualizacao em grid, lista ou colunas por set, exibindo cartas possuidas e faltantes na mesma jornada, com selecao em massa das faltantes e ajuste de quantidade/repetidas nas possuidas
- Aba Decks com decks competitivos curados de fontes como Limitless TCG, comparando cada lista com as cartas repetidas do usuario para destacar oportunidades de venda/troca e faltantes nas repetidas
- Importar planilha Excel `.xlsx` com colunas `serie`, `numero`, `sequencia` e `status`
- Login e cadastro com colecao separada por usuario
- Quantidade minima igual a 1 e preco minimo igual a 0
- Dashboard com total de cartas, unicas, valor total, favoritas e troca
- Tela exclusiva de trocas
- Filtros e ordenacao persistidos em `localStorage`
- Exportacao Excel completa, por set e por carta individual
- Exportacao visual em PDF de cartas repetidas por set (A4 com capa e grade 5x10)
- UI dark mode, responsiva, com skeleton, empty state, modal/toast base e cards visuais

## Atualizacoes recentes (trocas e negociacao)

- Nova aba reforcada de `Usuarios e trocas` no menu principal.
- Listagem de usuarios com foco em visibilidade de cartas repetidas para negociacao.
- Filtro de cartas do usuario alvo com opcao `Apenas repetidas`.
- Novo botao `Aplicar filtros` no mercado de trocas para aplicar os filtros selecionados manualmente.
- Botao `Limpar filtros` para restaurar a busca de cartas no fluxo de troca.
- Favoritar cartas de outros usuarios diretamente na tela de trocas (integrado com lista de desejos).
- Selecao de intencao por carta solicitada:
  - `Comprar`
  - `Trocar`
- Envio de proposta/negociacao com chat iniciado automaticamente e mensagem inicial de contexto.
- Suporte a negociacao de compra (sem obrigar cartas oferecidas), mantendo validacoes de seguranca no backend.
- Cartoes de proposta atualizados para exibir corretamente negociacoes sem cartas oferecidas.

## Endpoints

- `GET /api/cards?page=1&pageSize=24&search=pikachu&set=base1`
- `GET /api/sets`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/collection`
- `POST /api/collection`
- `PATCH /api/collection/:id`
- `DELETE /api/collection/:id`
- `GET /api/trades`
- `GET /api/dashboard`
- `GET /api/export?type=full`
- `GET /api/export?type=set&set=Base`
- `GET /api/export?type=card&id=base1-4`
- `GET /api/export?type=repeatedPdf&set=Base`
- `POST /api/import/collection`

## Importacao Excel

Na tela `Minha colecao`, use o botao `Importar Excel`.

A planilha deve ter a primeira linha com estes cabecalhos:

```text
serie | numero | sequencia | status
```

Regras:

- Apenas linhas com `status` igual a `ok` sao importadas.
- A coluna `serie` deve bater com o nome do set/colecao na Pokemon TCG API.
- O sistema tenta localizar a carta por `serie` + `numero`; se `numero` estiver vazio, usa `sequencia`.
- Cartas ja existentes nao duplicam registro: a quantidade e somada.
- O preco inicial importado usa o valor estimado da API quando existir; depois voce pode editar manualmente.

## Validacao

```bash
cd backend
npm run build
npm test

cd ../frontend
npm run build
```

## Deploy

Para publicar em hospedagem, veja [DEPLOY.md](./DEPLOY.md).
