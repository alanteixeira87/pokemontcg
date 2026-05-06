import { Save, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Skeleton } from "../components/ui/Skeleton";
import type { ToastState } from "../components/ui/Toast";
import { apiService } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import type { UserProfile } from "../types";

export function Profile({ onToast }: { onToast: (toast: ToastState) => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [interests, setInterests] = useState("");
  const [saving, setSaving] = useState(false);
  const setAuth = useAppStore((state) => state.setAuth);
  const token = useAppStore((state) => state.token);

  useEffect(() => {
    void apiService.profile().then((data) => {
      setProfile(data);
      setName(data.name);
      setAvatarUrl(data.avatarUrl ?? "");
      setInterests(data.interests ?? "");
    });
  }, []);

  async function save() {
    if (!token) return;
    setSaving(true);
    try {
      const result = await apiService.updateProfile({ name, avatarUrl, interests });
      setAuth(token, result.user);
      const updated = await apiService.profile();
      setProfile(updated);
      onToast({ type: "success", message: "Perfil atualizado." });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel atualizar o perfil." });
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" /> : <UserCircle size={42} className="text-slate-400" />}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Perfil de usuario</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{profile.name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{profile.email}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <ProfileMetric label="Cartas" value={profile._count.collection} />
        <ProfileMetric label="Desejos" value={profile._count.wishlist} />
        <ProfileMetric label="Trocas enviadas" value={profile._count.sentTrades} />
        <ProfileMetric label="Trocas recebidas" value={profile._count.receivedTrades} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Nome
            <Input className="mt-2" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Avatar URL
            <Input className="mt-2" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." />
          </label>
          <label className="md:col-span-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Interesses
            <textarea
              className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={interests}
              onChange={(event) => setInterests(event.target.value)}
              placeholder="Ex: ASC, Charizard, cartas full art, raridades especiais..."
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" disabled={saving} onClick={() => void save()}>
            <Save size={16} />
            {saving ? "Salvando..." : "Salvar perfil"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function ProfileMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-indigo-600 dark:text-indigo-300">{value}</p>
    </div>
  );
}
