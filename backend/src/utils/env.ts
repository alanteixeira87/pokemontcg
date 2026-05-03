import dotenv from "dotenv";

dotenv.config();

function cleanEnvValue(value: string | undefined, fallback = ""): string {
  const cleaned = (value ?? fallback).trim();
  return cleaned.replace(/^['"]|['"]$/g, "");
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  pokemonApiUrl: cleanEnvValue(process.env.POKEMON_TCG_API_URL, "https://api.pokemontcg.io/v2"),
  pokemonApiKey: cleanEnvValue(process.env.POKEMON_TCG_API_KEY),
  pokeWalletApiUrl: cleanEnvValue(process.env.POKEWALLET_API_URL, "https://api.pokewallet.io"),
  pokeWalletApiKey: cleanEnvValue(process.env.POKEWALLET_API_KEY),
  usdBrlRate: Number(process.env.USD_BRL_RATE ?? 5.25),
  eurBrlRate: Number(process.env.EUR_BRL_RATE ?? 5.65),
  frontendUrl: cleanEnvValue(process.env.FRONTEND_URL),
  jwtSecret: cleanEnvValue(process.env.JWT_SECRET, "dev-secret-change-me")
};
