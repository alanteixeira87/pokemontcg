import { Download, Heart, Minus, Plus, Repeat2, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CollectionItem, ExploreCard } from "../types";
import { currency } from "../lib/utils";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

const fallbackCardImage = "https://images.pokemontcg.io/base1/4.png";

type ExploreProps = {
  mode: "explore";
  card: ExploreCard;
  quantity?: number;
  wished?: boolean;
  disabled?: boolean;
  onQuantityChange?: (cardId: string, quantity: number) => void;
  onAdd: (card: ExploreCard, quantity: number) => void;
  onToggleWishlist?: (card: ExploreCard) => void;
};

type CollectionProps = {
  mode: "collection";
  card: CollectionItem;
  onUpdate: (id: number, data: Partial<Pick<CollectionItem, "quantity" | "price" | "favorite" | "forTrade">>) => void;
  onRemove: (id: number) => void;
  onExport: (cardId: string) => void;
};

export function CardTile(props: ExploreProps | CollectionProps) {
  const card = props.card;
  const isExplore = props.mode === "explore";
  const [zoomOpen, setZoomOpen] = useState(false);

  return (
    <article className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-150 ease-out hover:scale-[1.01] hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="relative bg-slate-50 px-4 pb-3 pt-4 dark:bg-slate-950/40">
        <button type="button" className="mx-auto block aspect-[63/88] w-full max-w-[184px]" onClick={() => setZoomOpen(true)} aria-label={`Ampliar ${card.name}`}>
          <img
            src={card.image}
            alt={card.name}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = fallbackCardImage;
            }}
            className="h-full w-full rounded-lg object-contain transition duration-150 group-hover:scale-[1.015]"
          />
        </button>
        <div className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
          {isExplore ? props.card.number ? `#${props.card.number}` : "TCG" : `x${props.card.quantity}`}
        </div>
        {props.mode === "explore" && (
          <button
            type="button"
            onClick={() => props.onToggleWishlist?.(props.card)}
            className={`absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm transition hover:scale-105 dark:bg-slate-900 ${
              props.wished ? "text-rose-500" : "text-slate-400 hover:text-rose-500"
            }`}
            aria-label={props.wished ? "Remover da lista de desejos" : "Adicionar a lista de desejos"}
          >
            <Heart size={17} fill={props.wished ? "currentColor" : "none"} />
          </button>
        )}
        {props.mode === "collection" && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {props.card.quantity > 1 && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-medium uppercase text-amber-700">Dup</span>
            )}
            {props.card.favorite && (
              <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-medium uppercase text-rose-700">Fav</span>
            )}
            {props.card.forTrade && (
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium uppercase text-emerald-700">Troca</span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-100 p-4 dark:border-slate-800">
        <div>
          <h3 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-5 text-slate-950 dark:text-white">{card.name}</h3>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{card.set}</p>
        </div>

        {props.mode === "explore" ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Valor estimado</p>
              <strong className="text-lg font-semibold text-slate-950 dark:text-white">{props.card.marketPrice === null ? "N/D" : currency(props.card.marketPrice)}</strong>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                <button
                  className="flex h-10 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => props.onQuantityChange?.(props.card.id, Math.max(1, (props.quantity ?? 1) - 1))}
                  aria-label="Diminuir quantidade"
                >
                  <Minus size={14} />
                </button>
                <span className="flex h-10 min-w-10 items-center justify-center border-x border-slate-200 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white">
                  {props.quantity ?? 1}
                </span>
                <button
                  className="flex h-10 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => props.onQuantityChange?.(props.card.id, (props.quantity ?? 1) + 1)}
                  aria-label="Aumentar quantidade"
                >
                  <Plus size={14} />
                </button>
              </div>
              <Button className="flex-1" variant="primary" disabled={props.disabled} onClick={() => props.onAdd(props.card, props.quantity ?? 1)}>
                Adicionar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Quantidade</span>
                <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <button
                    className="flex h-8 w-8 items-center justify-center text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={() => props.onUpdate(props.card.id, { quantity: Math.max(1, props.card.quantity - 1) })}
                    aria-label="Diminuir quantidade"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="flex h-8 min-w-10 items-center justify-center border-x border-slate-200 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white">
                    {props.card.quantity}
                  </span>
                  <button
                    className="flex h-8 w-8 items-center justify-center text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={() => props.onUpdate(props.card.id, { quantity: props.card.quantity + 1 })}
                    aria-label="Aumentar quantidade"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <label className="text-xs font-bold uppercase text-slate-500">
                Preco unitario
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  step="0.01"
                  value={props.card.price}
                  onChange={(event) => props.onUpdate(props.card.id, { price: Math.max(0, Number(event.target.value)) })}
                />
              </label>
            </div>

            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total no fichario</p>
              <strong className="text-lg font-semibold text-slate-950 dark:text-white">{currency(props.card.price * props.card.quantity)}</strong>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Button
                title="Favoritar"
                size="icon"
                variant={props.card.favorite ? "primary" : "secondary"}
                onClick={() => props.onUpdate(props.card.id, { favorite: !props.card.favorite })}
              >
                <Star size={16} />
              </Button>
              <Button
                title="Marcar para troca"
                size="icon"
                variant={props.card.forTrade ? "primary" : "secondary"}
                onClick={() => props.onUpdate(props.card.id, { forTrade: !props.card.forTrade })}
              >
                <Repeat2 size={16} />
              </Button>
              <Button title="Exportar carta" size="icon" variant="secondary" onClick={() => props.onExport(props.card.cardId)}>
                <Download size={16} />
              </Button>
              <Button title="Remover" size="icon" variant="danger" onClick={() => props.onRemove(props.card.id)}>
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
      {zoomOpen && (
        <CardZoomModal
          card={card}
          number={isExplore ? props.card.number : props.card.number}
          label={isExplore ? "Explorar" : props.card.forTrade ? "Disponivel para troca" : "Minha colecao"}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </article>
  );
}

function CardZoomModal({ card, number, label, onClose }: { card: ExploreCard | CollectionItem; number?: string | null; label: string; onClose: () => void }) {
  const rarity = "rarity" in card ? card.rarity : undefined;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-2 sm:p-5" role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Fechar visualizacao" onClick={onClose} />
      <div className="relative grid h-[94dvh] w-full max-w-7xl overflow-hidden rounded-xl bg-white shadow-lg dark:bg-slate-900 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 items-center justify-center bg-slate-950 p-3 sm:p-6">
          <img
            src={card.image}
            alt={card.name}
            loading="eager"
            decoding="async"
            draggable={false}
            onError={(event) => {
              event.currentTarget.src = fallbackCardImage;
            }}
            className="h-full max-h-[88dvh] w-full select-none object-contain"
          />
        </div>
        <aside className="flex flex-col gap-4 border-t border-slate-200 p-5 dark:border-slate-800 lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-300">Carta ampliada</p>
              <h2 className="mt-1 text-2xl font-semibold leading-tight text-slate-950 dark:text-white">{card.name}</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar visualizacao">
              <X size={20} />
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.set}</p>
            <p className="text-4xl font-semibold text-slate-950 dark:text-white">#{number ?? "N/D"}</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {label}
              </span>
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${rarityTone(rarity)}`}>
                {rarity ?? "Raridade nao informada"}
              </span>
            </div>
          </div>
          <p className="rounded-lg bg-slate-100 p-3 text-sm font-medium text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
            Conferencia em tamanho grande para numero, nome, colecao e raridade da carta.
          </p>
        </aside>
      </div>
    </div>,
    document.body
  );
}

function rarityTone(rarity?: string | null): string {
  const normalized = (rarity ?? "").toLowerCase();
  if (normalized.includes("special") || normalized.includes("illustration")) return "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-200";
  if (normalized.includes("hyper") || normalized.includes("secret")) return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200";
  if (normalized.includes("ultra") || normalized.includes("double")) return "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200";
  if (normalized.includes("rare")) return "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200";
  if (normalized.includes("uncommon")) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200";
  if (normalized.includes("common")) return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

