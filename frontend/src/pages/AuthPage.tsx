import { Lock, Mail, User } from "lucide-react";
import { useState } from "react";
import { apiService } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import type { ToastState } from "../components/ui/Toast";

type Mode = "login" | "register";

export function AuthPage({ onToast }: { onToast: (toast: ToastState) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAppStore((state) => state.setAuth);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const result =
        mode === "register"
          ? await apiService.register({ name, email, password })
          : await apiService.login({ email, password });
      setAuth(result.token, result.user);
      onToast({ type: "success", message: mode === "register" ? "Conta criada com sucesso." : "Login realizado." });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel autenticar. Confira seus dados." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.12),transparent_30rem),linear-gradient(180deg,#fbfcfe_0%,#f6f8fb_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.16),transparent_30rem),#0b1020]">
      <header className="border-b border-white/70 bg-white/82 shadow-[0_10px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-300">Pokemon TCG</p>
          <h1 className="text-2xl font-black text-slate-950 dark:text-white">Colecao Local</h1>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-82px)] max-w-5xl items-center gap-6 px-4 py-8 lg:grid-cols-[1fr_420px]">
        <section>
          <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-black uppercase text-slate-900">Colecao privada</span>
          <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-950 dark:text-white">Entre para salvar suas cartas na sua propria conta.</h2>
          <p className="mt-3 max-w-xl text-base font-medium leading-7 text-slate-600 dark:text-slate-300">
            Cada usuario tem colecao, favoritos, trocas, importacoes e exportacoes separados.
          </p>
        </section>

        <form onSubmit={submit} className="rounded-3xl border border-slate-200/80 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/82">
          <div className="mb-5">
            <h3 className="text-xl font-black text-slate-950 dark:text-white">{mode === "login" ? "Entrar" : "Criar conta"}</h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Use e-mail e senha para acessar sua colecao.</p>
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                Nome
                <div className="relative mt-1">
                  <User className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    className="pl-9"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    minLength={2}
                  />
                </div>
              </label>
            )}
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
              E-mail
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
                <Input
                  id="email"
                  name="email"
                  autoComplete="email"
                  className="pl-9"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </label>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
              Senha
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
                <Input
                  id="password"
                  name="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="pl-9"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </label>
          </div>

          <Button className="mt-5 w-full" variant="primary" disabled={loading}>
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>

          <button
            type="button"
            className="mt-4 w-full text-center text-sm font-bold text-red-600 transition hover:text-red-700 dark:text-red-300"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Ainda nao tenho conta" : "Ja tenho conta"}
          </button>
        </form>
      </main>
    </div>
  );
}
