import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 3001),
  pokemonApiUrl: process.env.POKEMON_TCG_API_URL ?? "https://api.pokemontcg.io/v2",
  pokemonApiKey: process.env.POKEMON_TCG_API_KEY ?? "",
  pokeWalletApiUrl: process.env.POKEWALLET_API_URL ?? "https://api.pokewallet.io",
  pokeWalletApiKey: process.env.POKEWALLET_API_KEY ?? "",
  frontendUrl: process.env.FRONTEND_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me"
};
