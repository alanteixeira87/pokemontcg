import { Bell, Heart, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CardTile } from "../components/CardTile";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { apiService } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import type { ExploreCard, WishlistAvailability, WishlistItem } from "../types";
import type { ToastState } from "../components/ui/Toast";
import { currency } from "../lib/utils";
import { cardDisplayName, cardDisplayNumber } from "../lib/cardDisplay";

export function Wishlist({ onToast }: { onToast: (toast: ToastState) => void }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [notifications, setNotifications] = useState<WishlistAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const setView = useAppStore((state) => state.setView);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wishlistData, notificationData] = await Promise.all([apiService.wishlist(), apiService.wishlistNotifications()]);
      setItems(wishlistData);
      setNotifications(notificationData);
    } catch {
      onToast({ type: "error", message: "Nao foi possivel carregar sua lista de desejos." });
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const wishedIds = useMemo(() => new Set(items.map((item) => item.cardId)), [items]);

  async function remove(card: ExploreCard) {
    const previous = items;
    setItems((current) => current.filter((item) => item.cardId !== card.id));
    try {
      await apiService.removeWishlist(card.id);
      onToast({ type: "success", message: "Carta removida da lista de desejos." });
    } catch {
      setItems(previous);
      onToast({ type: "error", message: "Nao foi possivel remover a carta." });
    }
  }

  async function addToCollection(card: ExploreCard, quantity: number) {
    try {
      await apiService.addToCollection(card, quantity);
      onToast({ type: "success", message: "Carta adicionada a colecao." });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel adicionar esta carta." });
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Minha lista de desejos</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Cartas que estou buscando</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Favoritar aqui nao adiciona a carta na colecao. Ela fica monitorada para disponibilidade.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[280px]">
            <Metric icon={Heart} label="Desejadas" value={items.length} />
            <Metric icon={Bell} label="Disponiveis" value={notifications.length} />
          </div>
        </div>
      </section>

      {notifications.length > 0 && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <div className="mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-200">
            <Bell size={18} />
            <h3 className="text-sm font-semibold">Cartas da sua lista disponiveis na plataforma</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {notifications.map((notification) => (
              <div key={`${notification.cardId}-${notification.owner.id}`} className="rounded-lg border border-white bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex gap-3">
                  <img src={notification.image} alt={notification.name} loading="lazy" className="h-20 w-14 rounded-md object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{cardDisplayName(notification.name, notification.number, notification.cardId)}</p>
                    <p className="text-xs font-medium text-slate-500">{notification.set} - {cardDisplayNumber(notification.number, notification.cardId)}</p>
                    <p className="mt-1 text-xs text-slate-500">{notification.variantType} | {notification.condition}</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{currency(notification.requestedPrice)}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="primary" onClick={() => setView("trades")}>
                    <MessageCircle size={14} />
                    Contato
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setView("trades")}>
                    Visualizar
                  </Button>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-500">Usuario: {notification.owner.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-80" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => {
            const card = wishlistToExploreCard(item);
            return (
              <div key={item.id} className="space-y-2">
                <CardTile mode="explore" card={card} wished={wishedIds.has(card.id)} onToggleWishlist={remove} onAdd={addToCollection} />
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <p>Raridade: {item.rarity ?? "Nao informada"}</p>
                  <p>Variacao: {item.variantType ?? "NORMAL"}</p>
                  <p>Fonte: {item.priceSource}</p>
                  <p>Estado: {item.condition}</p>
                  <p>Disponibilidade: {item.availability ? `Disponivel com ${item.availability.owner.name}` : "Ainda indisponivel"}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Lista de desejos vazia" description="Use o coracao nas cartas do Explorar para monitorar cartas que voce ainda quer encontrar." />
      )}
    </div>
  );
}

function wishlistToExploreCard(item: WishlistItem): ExploreCard {
  return {
    id: item.cardId,
    name: item.name,
    image: item.image,
    set: item.set,
    number: item.number ?? undefined,
    rarity: item.rarity ?? undefined,
    marketPrice: item.marketPrice
  };
}

function Metric({ icon: Icon, label, value }: { icon: typeof Plus; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/35">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
        <Icon size={16} />
      </div>
      <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
