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
```

A chave da Pokemon TCG API e opcional para uso basico, mas pode ser preenchida em `POKEMON_TCG_API_KEY`.

## Funcionalidades

- Explorar cartas com paginacao, busca com debounce e filtro por set
- Exibir valor estimado da Pokemon TCG API quando disponivel
- Adicionar cartas sem duplicar registros: se ja existir, soma quantidade
- Usar valor estimado como preco inicial, mantendo edicao manual livre
- Colecao com edicao inline de quantidade, preco manual, favorito e troca
- Importar planilha Excel `.xlsx` com colunas `serie`, `numero`, `sequencia` e `status`
- Quantidade minima igual a 1 e preco minimo igual a 0
- Dashboard com total de cartas, unicas, valor total, favoritas e troca
- Tela exclusiva de trocas
- Filtros e ordenacao persistidos em `localStorage`
- Exportacao Excel completa, por set e por carta individual
- UI dark mode, responsiva, com skeleton, empty state, modal/toast base e cards visuais

## Endpoints

- `GET /api/cards?page=1&pageSize=24&search=pikachu&set=base1`
- `GET /api/sets`
- `GET /api/collection`
- `POST /api/collection`
- `PATCH /api/collection/:id`
- `DELETE /api/collection/:id`
- `GET /api/trades`
- `GET /api/dashboard`
- `GET /api/export?type=full`
- `GET /api/export?type=set&set=Base`
- `GET /api/export?type=card&id=base1-4`
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
