import { Download, Minus, Plus, Repeat2, Star, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { CollectionItem, ExploreCard } from "../types";
import { currency } from "../lib/utils";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

type ExploreProps = {
  mode: "explore";
  card: ExploreCard;
  onAdd: (card: ExploreCard) => void;
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
    <article className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white/92 shadow-[0_14px_40px_rgba(15,23,42,0.07)] ring-1 ring-white/70 transition-all duration-200 hover:-translate-y-1 hover:border-red-200 hover:shadow-[0_24px_60px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-900/82 dark:ring-white/5">
      <div className="relative bg-[radial-gradient(circle_at_50%_12%,rgba(248,113,113,0.18),transparent_36%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 pb-3 pt-5 dark:bg-[radial-gradient(circle_at_50%_12%,rgba(248,113,113,0.16),transparent_36%),linear-gradient(180deg,#111827_0%,#0f172a_100%)]">
        <button type="button" className="mx-auto block aspect-[63/88] w-full max-w-[198px]" onClick={() => setZoomOpen(true)} aria-label={`Ampliar ${card.name}`}>
          <img
            src={card.image}
            alt={card.name}
            loading="lazy"
            className="h-full w-full object-contain drop-shadow-[0_18px_26px_rgba(15,23,42,0.24)] transition duration-300 group-hover:scale-[1.045]"
          />
        </button>
        <div className="absolute right-3 top-3 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-200">
          {isExplore ? props.card.number ? `#${props.card.number}` : "TCG" : `x${props.card.quantity}`}
        </div>
        {props.mode === "collection" && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {props.card.quantity > 1 && (
              <span className="rounded-full bg-amber-300 px-2 py-1 text-[10px] font-black uppercase text-slate-950 shadow-sm">Dup</span>
            )}
            {props.card.favorite && (
              <span className="rounded-full bg-red-600 px-2 py-1 text-[10px] font-black uppercase text-white shadow-sm">Fav</span>
            )}
            {props.card.forTrade && (
              <span className="rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-black uppercase text-white shadow-sm">Troca</span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-100 p-4 dark:border-slate-800">
        <div>
          <h3 className="line-clamp-2 min-h-10 text-[15px] font-black leading-5 text-slate-950 dark:text-white">{card.name}</h3>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{card.set}</p>
        </div>

        {props.mode === "explore" ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Valor estimado</p>
              <strong className="text-lg font-black text-red-600 dark:text-red-300">{props.card.marketPrice === null ? "N/D" : currency(props.card.marketPrice)}</strong>
            </div>
            <Button className="w-full" variant="primary" onClick={() => props.onAdd(props.card)}>
              Adicionar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Quantidade</span>
                <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <button
                    className="flex h-8 w-8 items-center justify-center text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={() => props.onUpdate(props.card.id, { quantity: Math.max(1, props.card.quantity - 1) })}
                    aria-label="Diminuir quantidade"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="flex h-8 min-w-10 items-center justify-center border-x border-slate-200 text-sm font-black text-slate-900 dark:border-slate-700 dark:text-white">
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

            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Total no fichario</p>
              <strong className="text-lg font-black text-red-600 dark:text-red-300">{currency(props.card.price * props.card.quantity)}</strong>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-2 sm:p-5">
          <div className="grid h-[94vh] w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-glow lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-h-0 items-center justify-center bg-slate-950 p-3 sm:p-6">
              <img src={card.image} alt={card.name} className="h-full max-h-[88vh] w-full object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,0.45)]" />
            </div>
            <aside className="flex flex-col gap-4 border-t border-slate-200 p-5 lg:border-l lg:border-t-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-primary">Carta ampliada</p>
                  <h2 className="mt-1 text-2xl font-black leading-tight text-slate-950">{card.name}</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setZoomOpen(false)} aria-label="Fechar visualizacao">
                  <X size={20} />
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-500">{card.set}</p>
                <p className="text-4xl font-black text-slate-950">#{isExplore ? props.card.number ?? "N/D" : props.card.number ?? "N/D"}</p>
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                  {isExplore ? "Explorar" : props.card.forTrade ? "Disponivel para troca" : "Minha colecao"}
                </span>
              </div>
              <p className="rounded-lg bg-slate-100 p-3 text-sm font-medium text-slate-600">
                Conferencia em tamanho grande para imagem, colecao e numeracao da carta.
              </p>
            </aside>
          </div>
        </div>
      )}
    </article>
  );
}
