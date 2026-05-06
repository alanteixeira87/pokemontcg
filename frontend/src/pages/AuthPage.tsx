import { Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles, User } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
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
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050816] bg-cover bg-center bg-no-repeat px-4 py-8 text-slate-50 sm:px-6"
      style={{
        backgroundImage:
          "linear-gradient(rgba(5, 8, 22, 0.70), rgba(5, 8, 22, 0.84)), url('/vlrtcg-auth-bg.png')"
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(56,189,248,0.16),transparent_34%),radial-gradient(circle_at_72%_28%,rgba(139,92,246,0.18),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#050816] to-transparent" />

      <section className="relative z-10 w-full max-w-[460px] animate-[fadeIn_500ms_ease-out]">
        <div className="mb-7 text-center">
          <img
            src="/vlrtcg-logo.png"
            alt="VLRTCG"
            className="mx-auto h-auto w-[min(78vw,330px)] select-none object-contain drop-shadow-[0_18px_50px_rgba(56,189,248,0.28)]"
            draggable={false}
          />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/85">Trade • Collect • Connect</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-[20px] border border-white/14 bg-slate-950/46 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.46)] backdrop-blur-xl sm:p-7"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 shadow-[0_0_30px_rgba(56,189,248,0.16)]">
              <ShieldCheck size={21} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">VLRTCG Access</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {mode === "login" ? "Bem-vindo de volta!" : "Crie sua conta VLRTCG"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {mode === "login" ? "Faça login para continuar sua jornada no VLRTCG." : "Organize sua colecao e conecte-se para trocas."}
            </p>
          </div>

          <div className="space-y-4">
            {mode === "register" && (
              <label className="block text-sm font-medium text-slate-200" htmlFor="name">
                Nome
                <div className="relative mt-2">
                  <User className="pointer-events-none absolute left-4 top-4 text-cyan-200/70" size={17} />
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    placeholder="Seu nome"
                    className="h-12 rounded-xl border-white/12 bg-white/8 pl-11 text-white placeholder:text-slate-400 focus:border-cyan-300/70 focus:ring-cyan-300/20"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    minLength={2}
                  />
                </div>
              </label>
            )}
            <label className="block text-sm font-medium text-slate-200" htmlFor="email">
              E-mail ou usuario
              <div className="relative mt-2">
                <Mail className="pointer-events-none absolute left-4 top-4 text-cyan-200/70" size={17} />
                <Input
                  id="email"
                  name="email"
                  autoComplete="email"
                  className="h-12 rounded-xl border-white/12 bg-white/8 pl-11 text-white placeholder:text-slate-400 focus:border-cyan-300/70 focus:ring-cyan-300/20"
                  type="email"
                  placeholder="voce@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </label>
            <label className="block text-sm font-medium text-slate-200" htmlFor="password">
              Senha
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute left-4 top-4 text-cyan-200/70" size={17} />
                <Input
                  id="password"
                  name="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="h-12 rounded-xl border-white/12 bg-white/8 pl-11 pr-11 text-white placeholder:text-slate-400 focus:border-cyan-300/70 focus:ring-cyan-300/20"
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3.5 rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-slate-300">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/10 text-cyan-400 focus:ring-cyan-300/40"
              />
              Lembrar de mim
            </label>
            <button
              type="button"
              className="font-medium text-cyan-200 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              onClick={() => onToast({ type: "error", message: "Recuperacao de senha ainda nao esta disponivel." })}
            >
              Esqueceu sua senha?
            </button>
          </div>

          <Button
            className="mt-6 h-12 w-full border-0 bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-500 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(99,102,241,0.32)] hover:brightness-110"
            variant="primary"
            disabled={loading}
          >
            <Sparkles size={17} />
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>

          <button
            type="button"
            className="mt-5 w-full text-center text-sm font-medium text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Ainda nao possui conta? Criar conta" : "Ja possui conta? Fazer login"}
          </button>
        </form>
      </section>
    </main>
  );
}



