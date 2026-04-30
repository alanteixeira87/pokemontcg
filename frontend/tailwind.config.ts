import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 22% 86%)",
        background: "hsl(210 33% 97%)",
        foreground: "hsl(222 47% 13%)",
        muted: "hsl(214 32% 93%)",
        "muted-foreground": "hsl(215 16% 42%)",
        primary: "hsl(356 75% 45%)",
        "primary-foreground": "hsl(0 0% 100%)",
        accent: "hsl(43 96% 56%)",
        card: "hsl(0 0% 100%)"
      },
      boxShadow: {
        glow: "0 16px 38px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
} satisfies Config;
