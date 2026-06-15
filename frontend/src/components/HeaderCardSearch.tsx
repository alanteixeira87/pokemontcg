import { LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "../hooks/useDebounce";
import { cardThumbnailUrl, handleCardImageError } from "../lib/cardImage";
import { apiService } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import type { ExploreCard } from "../types";

function normalizedNumber(value?: string): string {
  return (value ?? "").split("/")[0]?.replace(/^#/, "").replace(/^0+(\d)/, "$1").trim().toLowerCase();
}

export function HeaderCardSearch() {
  const setView = useAppStore((state) => state.setView);
  const setExploreSearchTarget = useAppStore((state) => state.setExploreSearchTarget);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ExploreCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query.trim(), 250);
  const canSearch = debouncedQuery.length >= 2 || /^\d+$/.test(debouncedQuery);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!canSearch) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    void apiService
      .cards({ page: 1, pageSize: 8, search: debouncedQuery, sort: "name" })
      .then((result) => {
        if (!active) return;
        const searchedNumber = normalizedNumber(debouncedQuery);
        const sorted = [...result.cards].sort((left, right) => {
          const leftExact = normalizedNumber(left.number) === searchedNumber ? 1 : 0;
          const rightExact = normalizedNumber(right.number) === searchedNumber ? 1 : 0;
          return rightExact - leftExact || left.name.localeCompare(right.name);
        });
        setSuggestions(sorted);
        setOpen(true);
        setActiveIndex(-1);
      })
      .catch(() => {
        if (active) setSuggestions([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canSearch, debouncedQuery]);

  const statusText = useMemo(() => {
    if (loading) return "Buscando cartas...";
    if (canSearch && suggestions.length === 0) return "Nenhuma carta encontrada";
    return "";
  }, [canSearch, loading, suggestions.length]);

  function openExplore(search: string, setId = "") {
    setExploreSearchTarget(search, setId);
    setView("explore");
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  }

  function chooseCard(card: ExploreCard) {
    openExplore(card.number || card.name, card.setId);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = suggestions[activeIndex];
      if (selected) {
        chooseCard(selected);
      } else if (query.trim()) {
        openExplore(query.trim());
      }
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar carta por nome ou número"
        aria-label="Buscar carta por nome ou número"
        aria-expanded={open}
        aria-controls="header-card-suggestions"
        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-10 text-sm text-slate-900 outline-none transition hover:bg-white focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      {loading && <LoaderCircle className="pointer-events-none absolute right-3 top-3 animate-spin text-indigo-500" size={17} />}
      {!loading && query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setSuggestions([]);
          }}
          aria-label="Limpar busca"
          className="absolute right-2 top-2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X size={16} />
        </button>
      )}

      {open && (suggestions.length > 0 || statusText) && (
        <div
          id="header-card-suggestions"
          className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          {statusText && suggestions.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-slate-500 dark:text-slate-400">{statusText}</p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto py-1">
              {suggestions.map((card, index) => (
                <li key={card.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => chooseCard(card)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                      activeIndex === index
                        ? "bg-indigo-50 dark:bg-indigo-950/50"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <img
                      src={cardThumbnailUrl(card.image)}
                      alt=""
                      width={42}
                      height={58}
                      loading="lazy"
                      decoding="async"
                      onError={(event) => handleCardImageError(event.currentTarget)}
                      className="h-[58px] w-[42px] shrink-0 rounded object-contain"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">{card.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{card.set}</span>
                    </span>
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-indigo-700 dark:bg-slate-800 dark:text-indigo-300">
                      #{card.number || "N/D"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && (
            <button
              type="button"
              onClick={() => openExplore(query.trim())}
              className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-4 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-slate-800 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
            >
              <Search size={15} />
              Ver todos os resultados para “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
