import dotenv from "dotenv";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-change-me";
if (process.env.NODE_ENV === "production" && jwtSecret === "dev-secret-change-me") {
  throw new Error("JWT_SECRET seguro e obrigatorio em producao.");
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  pokemonApiUrl: process.env.POKEMON_TCG_API_URL ?? "https://api.pokemontcg.io/v2",
  pokemonApiKey: process.env.POKEMON_TCG_API_KEY ?? "",
  pokeWalletApiUrl: process.env.POKEWALLET_API_URL ?? "https://api.pokewallet.io",
  pokeWalletApiKey: process.env.POKEWALLET_API_KEY ?? "",
  usdBrlRate: Number(process.env.USD_BRL_RATE ?? 5.25),
  eurBrlRate: Number(process.env.EUR_BRL_RATE ?? 5.65),
  frontendUrl: process.env.FRONTEND_URL ?? "",
  jwtSecret
};
