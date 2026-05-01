import { Check, Clock, FilterX, Handshake, Search, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import type { ToastState } from "../components/ui/Toast";
import { useDebounce } from "../hooks/useDebounce";
import { apiService } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import type { TradeCard, TradeCardSnapshot, TradeProposal, TradeStatus, TradeUser } from "../types";

type Selection = {
  requested: number[];
  offered: number[];
};

const statusLabel: Record<TradeStatus, string> = {
  PENDING: "Pendente",
  ACCEPTED: "Aceita",
  DECLINED: "Recusada",
  CANCELED: "Cancelada"
};

const statusClass: Record<TradeStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  DECLINED: "bg-red-100 text-red-800",
  CANCELED: "bg-slate-100 text-slate-700"
};

export function TradeMarket({ onToast }: { onToast: (toast: ToastState) => void }) {
  const currentUser = useAppStore((state) => state.user);
  const [users, setUsers] = useState<TradeUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<TradeUser | null>(null);
  const [targetCards, setTargetCards] = useState<TradeCard[]>([]);
  const [targetSets, setTargetSets] = useState<string[]>([]);
  const [myCards, setMyCards] = useState<TradeCard[]>([]);
  const [mySets, setMySets] = useState<string[]>([]);
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [search, setSearch] = useState("");
  const [interest, setInterest] = useState("");
  const [cardSearch, setCardSearch] = useState("");
  const [targetSet, setTargetSet] = useState("");
  const [mySet, setMySet] = useState("");
  const [selection, setSelection] = useState<Selection>({ requested: [], offered: [] });
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);
  const [sending, setSending] = useState(false);
  const debouncedSearch = useDebounce(search);
  const debouncedInterest = useDebounce(interest);
  const debouncedCardSearch = useDebounce(cardSearch);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await apiService.tradeUsers({
        search: debouncedSearch || undefined,
        interest: debouncedInterest || undefined
      });
      setUsers(data);
      setSelectedUser((current) => current && data.some((user) => user.id === current.id) ? current : data[0] ?? null);
    } catch {
      onToast({ type: "error", message: "Nao foi possivel buscar usuarios para troca." });
    } finally {
      setLoadingUsers(false);
    }
  }, [debouncedInterest, debouncedSearch, onToast]);

  const loadProposals = useCallback(async () => {
    try {
      setProposals(await apiService.tradeProposals());
    } catch {
      onToast({ type: "error", message: "Nao foi possivel carregar propostas." });
    }
  }, [onToast]);

  const loadCards = useCallback(async () => {
    setLoadingCards(true);
    try {
      const [mine, target] = await Promise.all([
        apiService.myTradeCards({ set: mySet || undefined, search: debouncedCardSearch || undefined }),
        selectedUser
          ? apiService.tradeUserCards(selectedUser.id, { set: targetSet || undefined, search: debouncedCardSearch || undefined })
          : Promise.resolve({ sets: [], cards: [] })
      ]);
      setMyCards(mine.cards);
      setMySets(mine.sets);
      setTargetCards(target.cards);
      setTargetSets(target.sets);
    } catch {
      onToast({ type: "error", message: "Nao foi possivel carregar cartas para troca." });
    } finally {
      setLoadingCards(false);
    }
  }, [debouncedCardSearch, mySet, onToast, selectedUser, targetSet]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  useEffect(() => {
    setSelection({ requested: [], offered: [] });
    setTargetSet("");
  }, [selectedUser?.id]);

  const incomingPending = useMemo(
    () => proposals.filter((proposal) => proposal.receiverId === currentUser?.id && proposal.status === "PENDING"),
    [currentUser?.id, proposals]
  );
  const selectedRequestedCards = useMemo(
    () => targetCards.filter((card) => selection.requested.includes(card.id)),
    [selection.requested, targetCards]
  );
  const selectedOfferedCards = useMemo(
    () => myCards.filter((card) => selection.offered.includes(card.id)),
    [myCards, selection.offered]
  );

  function toggle(kind: keyof Selection, id: number) {
    setSelection((current) => {
      const exists = current[kind].includes(id);
      return {
        ...current,
        [kind]: exists ? current[kind].filter((value) => value !== id) : [...current[kind], id]
      };
    });
  }

  async function sendProposal() {
    if (!selectedUser || selection.requested.length === 0 || selection.offered.length === 0) return;

    setSending(true);
    try {
      await apiService.createTradeProposal({
        receiverId: selectedUser.id,
        requestedCardIds: selection.requested,
        offeredCardIds: selection.offered
      });
      setSelection({ requested: [], offered: [] });
      await loadProposals();
      onToast({ type: "success", message: "Proposta de troca enviada." });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel enviar a proposta." });
    } finally {
      setSending(false);
    }
  }

  async function updateStatus(id: number, status: Exclude<TradeStatus, "PENDING">) {
    try {
      await apiService.updateTradeStatus(id, status);
      await loadProposals();
      onToast({ type: "success", message: "Proposta atualizada." });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel atualizar a proposta." });
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-red-800 to-primary p-5 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-yellow-200">Mercado de trocas</p>
              <h2 className="mt-1 text-2xl font-black">Negocie cartas com outros colecionadores</h2>
              <p className="mt-1 text-sm text-red-50">Encontre usuarios, selecione cartas e envie propostas estruturadas.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[320px]">
              <Metric label="Usuarios" value={users.length} />
              <Metric label="Pendentes" value={incomingPending.length} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 lg:grid-cols-[1fr_240px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 text-muted-foreground" size={16} />
            <Input className="pl-9" placeholder="Buscar usuario, carta ou colecao" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Input placeholder="Interesse: raridade, set, tipo..." value={interest} onChange={(event) => setInterest(event.target.value)} />
          <Button
            variant="secondary"
            disabled={!search && !interest}
            onClick={() => {
              setSearch("");
              setInterest("");
            }}
          >
            <FilterX size={16} />
            Limpar
          </Button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <section className="space-y-3">
          <h3 className="text-lg font-black text-slate-900">Usuarios encontrados</h3>
          {loadingUsers ? (
            <Skeleton className="h-80" />
          ) : users.length ? (
            <div className="space-y-3">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUser(user)}
                  className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-primary/50 ${
                    selectedUser?.id === user.id ? "border-primary ring-2 ring-primary/10" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={user.name} avatarUrl={user.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-base font-black text-slate-950">{user.name}</h4>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{user.tradeCardsCount} cartas para troca</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {user.mainCollections.length ? (
                          user.mainCollections.map((set) => (
                            <span key={set} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                              {set}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">Sem colecoes principais</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum usuario encontrado" description="Tente buscar por outro nome, colecao ou interesse." />
          )}
        </section>

        <section className="space-y-5">
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-primary">Cartas para troca</p>
                <h3 className="text-xl font-black text-slate-950">{selectedUser ? selectedUser.name : "Selecione um usuario"}</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[620px]">
                <Input placeholder="Buscar carta selecionavel" value={cardSearch} onChange={(event) => setCardSearch(event.target.value)} />
                <Select value={targetSet} onChange={(event) => setTargetSet(event.target.value)}>
                  <option value="">Sets do usuario</option>
                  {targetSets.map((set) => (
                    <option key={set} value={set}>
                      {set}
                    </option>
                  ))}
                </Select>
                <Select value={mySet} onChange={(event) => setMySet(event.target.value)}>
                  <option value="">Meus sets</option>
                  {mySets.map((set) => (
                    <option key={set} value={set}>
                      {set}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <TradeCardPanel
                title="Quero receber"
                cards={targetCards}
                selected={selection.requested}
                loading={loadingCards}
                emptyTitle="Nenhuma carta disponivel"
                emptyDescription="Esse usuario ainda nao tem cartas nesse filtro."
                onToggle={(id) => toggle("requested", id)}
              />
              <TradeCardPanel
                title="Vou oferecer"
                cards={myCards}
                selected={selection.offered}
                loading={loadingCards}
                emptyTitle="Sem cartas para oferecer"
                emptyDescription="Marque cartas como troca na sua colecao para usa-las em propostas."
                onToggle={(id) => toggle("offered", id)}
              />
            </div>
          </div>

          <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-primary">Proposta atual</p>
                <h3 className="text-lg font-black text-slate-950">
                  {selection.requested.length} solicitadas por {selection.offered.length} oferecidas
                </h3>
              </div>
              <Button
                variant="primary"
                disabled={!selectedUser || selection.requested.length === 0 || selection.offered.length === 0 || sending}
                onClick={sendProposal}
              >
                <Send size={16} />
                {sending ? "Enviando..." : "Enviar proposta"}
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SnapshotPreview title="Solicitadas" cards={selectedRequestedCards} />
              <SnapshotPreview title="Oferecidas" cards={selectedOfferedCards} />
            </div>
          </section>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-primary">Notificacoes e propostas</p>
            <h3 className="text-xl font-black text-slate-950">Historico de negociacoes</h3>
          </div>
          <Button variant="secondary" onClick={() => void loadProposals()}>
            <Clock size={16} />
            Atualizar
          </Button>
        </div>
        {proposals.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {proposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} currentUserId={currentUser?.id ?? 0} onUpdate={updateStatus} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhuma proposta ainda" description="Quando alguem enviar ou voce criar uma proposta, ela aparece aqui." />
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur">
      <p className="text-[11px] font-bold uppercase text-red-50">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-12 w-12 rounded-full object-cover" loading="lazy" />;
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-white">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function TradeCardPanel({
  title,
  cards,
  selected,
  loading,
  emptyTitle,
  emptyDescription,
  onToggle
}: {
  title: string;
  cards: TradeCard[];
  selected: number[];
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  onToggle: (id: number) => void;
}) {
  if (loading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-black text-slate-950">{title}</h4>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{selected.length} selecionadas</span>
      </div>
      {cards.length ? (
        <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onToggle(card.id)}
              className={`grid w-full grid-cols-[72px_1fr_auto] items-center gap-3 rounded-lg border p-2 text-left transition ${
                selected.includes(card.id) ? "border-primary bg-red-50 ring-2 ring-primary/10" : "border-slate-200 bg-white hover:border-primary/40"
              }`}
            >
              <img src={card.image} alt={card.name} loading="lazy" className="h-24 w-[68px] object-contain" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-black text-slate-950">{card.name}</p>
                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{card.set}</p>
                <p className="mt-1 text-xs font-bold text-primary">#{card.number ?? card.cardId.split("-").at(-1) ?? "N/D"}</p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-black text-yellow-800">x{card.quantity}</span>
                <span className={`mt-3 flex h-6 w-6 items-center justify-center rounded-full border ${selected.includes(card.id) ? "border-primary bg-primary text-white" : "border-slate-300"}`}>
                  {selected.includes(card.id) && <Check size={14} />}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </div>
  );
}

function SnapshotPreview({ title, cards }: { title: string; cards: TradeCard[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-black uppercase text-slate-500">{title}</p>
      {cards.length ? (
        <div className="space-y-2">
          {cards.map((card) => (
            <div key={card.id} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="truncate">{card.name}</span>
              <span className="ml-auto text-xs text-slate-500">#{card.number ?? "N/D"}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Nenhuma carta selecionada.</p>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  currentUserId,
  onUpdate
}: {
  proposal: TradeProposal;
  currentUserId: number;
  onUpdate: (id: number, status: Exclude<TradeStatus, "PENDING">) => Promise<void>;
}) {
  const incoming = proposal.receiverId === currentUserId;
  const canAnswer = incoming && proposal.status === "PENDING";
  const canCancel = proposal.requesterId === currentUserId && proposal.status === "PENDING";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-black ${statusClass[proposal.status]}`}>{statusLabel[proposal.status]}</span>
          <h4 className="mt-2 text-base font-black text-slate-950">
            {incoming ? `${proposal.requester.name} quer trocar com voce` : `Proposta para ${proposal.receiver.name}`}
          </h4>
          <p className="text-xs font-semibold text-slate-500">{new Date(proposal.createdAt).toLocaleString("pt-BR")}</p>
        </div>
        <div className="flex gap-2">
          {canAnswer && (
            <>
              <Button size="sm" variant="primary" onClick={() => void onUpdate(proposal.id, "ACCEPTED")}>
                <Handshake size={14} />
                Aceitar
              </Button>
              <Button size="sm" variant="danger" onClick={() => void onUpdate(proposal.id, "DECLINED")}>
                <X size={14} />
                Recusar
              </Button>
            </>
          )}
          {canCancel && (
            <Button size="sm" variant="danger" onClick={() => void onUpdate(proposal.id, "CANCELED")}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ProposalCards title="Cartas oferecidas" cards={proposal.offeredCards} />
        <ProposalCards title="Cartas solicitadas" cards={proposal.requestedCards} />
      </div>
    </article>
  );
}

function ProposalCards({ title, cards }: { title: string; cards: TradeCardSnapshot[] }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="mb-2 text-xs font-black uppercase text-slate-500">{title}</p>
      <div className="space-y-2">
        {cards.map((card) => (
          <div key={`${card.collectionId}-${card.cardId}`} className="flex items-center gap-2">
            <img src={card.image} alt={card.name} loading="lazy" className="h-12 w-9 object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">{card.name}</p>
              <p className="text-xs text-slate-500">
                {card.set} #{card.number ?? "N/D"} x{card.quantity}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
