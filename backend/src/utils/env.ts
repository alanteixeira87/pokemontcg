import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 3001),
  pokemonApiUrl: process.env.POKEMON_TCG_API_URL ?? "https://api.pokemontcg.io/v2",
  pokemonApiKey: process.env.POKEMON_TCG_API_KEY ?? "",
  frontendUrl: process.env.FRONTEND_URL ?? ""
};
