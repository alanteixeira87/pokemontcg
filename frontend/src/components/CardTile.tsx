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
    <article className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-red-300 hover:shadow-glow">
      <div className="relative bg-gradient-to-b from-slate-100 via-white to-slate-50 px-4 pt-4">
        <button type="button" className="mx-auto block aspect-[63/88] max-w-[190px]" onClick={() => setZoomOpen(true)}>
        <img
          src={card.image}
          alt={card.name}
          loading="lazy"
          className="h-full w-full object-contain drop-shadow-[0_14px_18px_rgba(15,23,42,0.22)] transition duration-300 group-hover:scale-[1.04]"
        />
        </button>
        <div className="absolute right-3 top-3 rounded-full border border-slate-200 bg-white/95 px-2 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
          {isExplore ? props.card.number ? `#${props.card.number}` : "TCG" : `x${props.card.quantity}`}
        </div>
        {props.mode === "collection" && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {props.card.quantity > 1 && (
              <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-black uppercase text-slate-950 shadow-sm">Dup</span>
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

      <div className="space-y-3 border-t border-slate-100 p-3">
        <div>
          <h3 className="line-clamp-2 min-h-10 text-[15px] font-black leading-5 text-slate-900">{card.name}</h3>
          <p className="mt-1 truncate text-xs font-medium text-slate-500">{card.set}</p>
        </div>

        {props.mode === "explore" ? (
          <div className="space-y-3">
            <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-slate-500">Valor estimado</p>
              <strong className="text-lg font-black text-primary">{props.card.marketPrice === null ? "N/D" : currency(props.card.marketPrice)}</strong>
            </div>
            <Button className="w-full" variant="primary" onClick={() => props.onAdd(props.card)}>
              Adicionar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-500">Quantidade</span>
                <div className="flex items-center overflow-hidden rounded-md border border-slate-200 bg-white">
                  <button
                    className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100"
                    onClick={() => props.onUpdate(props.card.id, { quantity: Math.max(1, props.card.quantity - 1) })}
                    aria-label="Diminuir quantidade"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="flex h-8 min-w-10 items-center justify-center border-x border-slate-200 text-sm font-black text-slate-900">
                    {props.card.quantity}
                  </span>
                  <button
                    className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100"
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

            <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-slate-500">Total no fichario</p>
              <strong className="text-lg font-black text-primary">{currency(props.card.price * props.card.quantity)}</strong>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-4 shadow-glow">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">{card.name}</h2>
                <p className="text-sm font-semibold text-slate-500">{card.set}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setZoomOpen(false)} aria-label="Fechar visualizacao">
                <X size={18} />
              </Button>
            </div>
            <div className="grid gap-5 md:grid-cols-[minmax(240px,420px)_1fr]">
              <div className="rounded-xl bg-slate-100 p-4">
                <img src={card.image} alt={card.name} className="mx-auto max-h-[70vh] object-contain" />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-black uppercase text-primary">Carta ampliada</p>
                <p className="text-3xl font-black text-slate-950">#{isExplore ? props.card.number ?? "N/D" : props.card.number ?? "N/D"}</p>
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                  {isExplore ? "Explorar" : props.card.forTrade ? "Disponivel para troca" : "Minha colecao"}
                </span>
                <p className="text-sm text-slate-600">Use esta visualizacao para conferir imagem, colecao e numeracao da carta.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
