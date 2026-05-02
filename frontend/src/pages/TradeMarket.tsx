import { Check, Clock, Eye, FilterX, Handshake, MessageCircle, Save, Search, Send, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import type { ToastState } from "../components/ui/Toast";
import { useDebounce } from "../hooks/useDebounce";
import { apiService } from "../services/api";
import { joinTradeChat, onTradeMessage, onTradeNotification, sendRealtimeTradeMessage } from "../services/socket";
import { useAppStore } from "../store/useAppStore";
import type { CardVariant, TradeCard, TradeCardSnapshot, TradeMessage, TradeProposal, TradeSelectionInput, TradeStatus, TradeUser, VariantType } from "../types";

type SelectedLine = TradeSelectionInput;
type VariantDraft = Record<VariantType, { ownedQuantity: number; tradeQuantity: number }>;

const variantOptions: Array<{ value: VariantType; label: string; tone: string }> = [
  { value: "NORMAL", label: "Normal", tone: "bg-slate-100 text-slate-700" },
  { value: "FOIL", label: "Foil", tone: "bg-yellow-100 text-yellow-800" },
  { value: "REVERSE_FOIL", label: "Foil Reverse", tone: "bg-sky-100 text-sky-800" },
  { value: "RARE_ILLUSTRATION", label: "Ilustracao Rara", tone: "bg-fuchsia-100 text-fuchsia-800" }
];

const statusLabel: Record<TradeStatus, string> = {
  PENDING: "Pendente",
  ACCEPTED: "Aceita",
  DECLINED: "Recusada",
  CANCELED: "Cancelada",
  REJECTED: "Recusada",
  CANCELLED: "Cancelada"
};

const statusClass: Record<TradeStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  DECLINED: "bg-red-100 text-red-800",
  CANCELED: "bg-slate-100 text-slate-700",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-100 text-slate-700"
};

function variantLabel(type?: VariantType) {
  return variantOptions.find((item) => item.value === type)?.label ?? "Tipo pendente";
}

function variantTone(type?: VariantType) {
  return variantOptions.find((item) => item.value === type)?.tone ?? "bg-slate-100 text-slate-700";
}

function selectionKey(line: TradeSelectionInput) {
  return `${line.collectionId}:${line.variantType}`;
}

function availableVariants(card: TradeCard): CardVariant[] {
  return (card.variantSummary ?? card.variants ?? []).filter((variant) => variant.tradeQuantity > 0);
}

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
  const [requested, setRequested] = useState<SelectedLine[]>([]);
  const [offered, setOffered] = useState<SelectedLine[]>([]);
  const [zoomCard, setZoomCard] = useState<{ card: TradeCard | TradeCardSnapshot; variantType?: VariantType } | null>(null);
  const [variantCard, setVariantCard] = useState<TradeCard | null>(null);
  const [chatTrade, setChatTrade] = useState<TradeProposal | null>(null);
  const [messages, setMessages] = useState<TradeMessage[]>([]);
  const [messageText, setMessageText] = useState("");
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
      setSelectedUser((current) => (current && data.some((user) => user.id === current.id) ? current : data[0] ?? null));
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
    setRequested([]);
    setOffered([]);
    setTargetSet("");
  }, [selectedUser?.id]);

  useEffect(() => {
    const offMessage = onTradeMessage((message) => {
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
      void loadProposals();
    });
    const offNotification = onTradeNotification((payload) => {
      onToast({ type: "success", message: payload.message });
      void loadProposals();
    });
    return () => {
      offMessage();
      offNotification();
    };
  }, [loadProposals, onToast]);

  useEffect(() => {
    if (!chatTrade) return;
    joinTradeChat(chatTrade.id);
    void apiService.tradeMessages(chatTrade.id).then(setMessages).catch(() => onToast({ type: "error", message: "Nao foi possivel carregar o chat." }));
  }, [chatTrade, onToast]);

  const incomingPending = useMemo(
    () => proposals.filter((proposal) => proposal.receiverId === currentUser?.id && proposal.status === "PENDING"),
    [currentUser?.id, proposals]
  );
  const selectedRequestedCards = useMemo(() => expandSelected(targetCards, requested), [requested, targetCards]);
  const selectedOfferedCards = useMemo(() => expandSelected(myCards, offered), [myCards, offered]);

  function upsertSelection(kind: "requested" | "offered", line: SelectedLine) {
    const setter = kind === "requested" ? setRequested : setOffered;
    setter((current) => {
      const exists = current.some((item) => selectionKey(item) === selectionKey(line));
      return exists ? current.filter((item) => selectionKey(item) !== selectionKey(line)) : [...current, line];
    });
  }

  function changeQuantity(kind: "requested" | "offered", line: SelectedLine, quantity: number) {
    const setter = kind === "requested" ? setRequested : setOffered;
    setter((current) => current.map((item) => (selectionKey(item) === selectionKey(line) ? { ...item, quantity } : item)));
  }

  async function sendProposal() {
    if (!selectedUser || requested.length === 0 || offered.length === 0) return;
    setSending(true);
    try {
      await apiService.createTradeProposal({
        receiverId: selectedUser.id,
        requestedCards: requested,
        offeredCards: offered
      });
      setRequested([]);
      setOffered([]);
      await loadProposals();
      onToast({ type: "success", message: "Proposta de troca enviada." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel enviar a proposta.";
      onToast({ type: "error", message: message.includes("400") ? "Selecione tipo e quantidade validos antes de enviar." : "Nao foi possivel enviar a proposta." });
    } finally {
      setSending(false);
    }
  }

  async function updateStatus(id: number, status: "ACCEPTED" | "REJECTED" | "CANCELLED") {
    try {
      await apiService.updateTradeStatus(id, status);
      await loadProposals();
      onToast({ type: "success", message: "Proposta atualizada." });
    } catch {
      onToast({ type: "error", message: "Nao foi possivel atualizar a proposta. Confira o estoque das variantes." });
    }
  }

  async function sendChatMessage() {
    if (!chatTrade || !messageText.trim()) return;
    const text = messageText;
    setMessageText("");
    sendRealtimeTradeMessage(chatTrade.id, text);
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-red-800 to-primary p-5 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-yellow-200">Mercado de trocas</p>
              <h2 className="mt-1 text-2xl font-black">Trocas com variantes e negociacao em tempo real</h2>
              <p className="mt-1 text-sm text-red-50">Escolha tipo, quantidade, confira imagens ampliadas e converse antes de fechar.</p>
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
          <Button variant="secondary" disabled={!search && !interest} onClick={() => { setSearch(""); setInterest(""); }}>
            <FilterX size={16} />
            Limpar
          </Button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <section className="space-y-3">
          <h3 className="text-lg font-black text-slate-900">Usuarios encontrados</h3>
          {loadingUsers ? <Skeleton className="h-80" /> : users.length ? (
            <div className="space-y-3">
              {users.map((user) => (
                <button key={user.id} type="button" onClick={() => setSelectedUser(user)} className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-primary/50 ${selectedUser?.id === user.id ? "border-primary ring-2 ring-primary/10" : "border-slate-200"}`}>
                  <div className="flex items-start gap-3">
                    <Avatar name={user.name} avatarUrl={user.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-base font-black text-slate-950">{user.name}</h4>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{user.tradeCardsCount} cartas para troca</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {user.mainCollections.length ? user.mainCollections.map((set) => <Badge key={set}>{set}</Badge>) : <span className="text-xs text-slate-500">Sem colecoes principais</span>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : <EmptyState title="Nenhum usuario encontrado" description="Tente buscar por outro nome, colecao ou interesse." />}
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
                  {targetSets.map((set) => <option key={set} value={set}>{set}</option>)}
                </Select>
                <Select value={mySet} onChange={(event) => setMySet(event.target.value)}>
                  <option value="">Meus sets</option>
                  {mySets.map((set) => <option key={set} value={set}>{set}</option>)}
                </Select>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <TradeCardPanel
                title="Quero receber"
                cards={targetCards}
                selected={requested}
                loading={loadingCards}
                emptyTitle="Nenhuma carta disponivel"
                emptyDescription="Esse usuario ainda nao definiu tipos para troca nesse filtro."
                onToggle={(line) => upsertSelection("requested", line)}
                onQuantity={(line, quantity) => changeQuantity("requested", line, quantity)}
                onZoom={(card, variantType) => setZoomCard({ card, variantType })}
              />
              <TradeCardPanel
                title="Vou oferecer"
                cards={myCards}
                selected={offered}
                loading={loadingCards}
                emptyTitle="Sem cartas para oferecer"
                emptyDescription="Configure tipos e quantidade para troca nas suas cartas."
                mine
                onConfigure={setVariantCard}
                onToggle={(line) => upsertSelection("offered", line)}
                onQuantity={(line, quantity) => changeQuantity("offered", line, quantity)}
                onZoom={(card, variantType) => setZoomCard({ card, variantType })}
              />
            </div>
          </div>

          <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-primary">Proposta atual</p>
                <h3 className="text-lg font-black text-slate-950">{requested.length} tipos solicitados por {offered.length} tipos oferecidos</h3>
              </div>
              <Button variant="primary" disabled={!selectedUser || requested.length === 0 || offered.length === 0 || sending} onClick={sendProposal}>
                <Send size={16} />
                {sending ? "Enviando..." : "Enviar proposta"}
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SelectionPreview title="Solicitadas" rows={selectedRequestedCards} />
              <SelectionPreview title="Oferecidas" rows={selectedOfferedCards} />
            </div>
          </section>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-primary">Notificacoes, propostas e chat</p>
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
              <ProposalCard key={proposal.id} proposal={proposal} currentUserId={currentUser?.id ?? 0} onUpdate={updateStatus} onChat={setChatTrade} onZoom={(card) => setZoomCard({ card, variantType: card.variantType })} />
            ))}
          </div>
        ) : <EmptyState title="Nenhuma proposta ainda" description="Quando alguem enviar ou voce criar uma proposta, ela aparece aqui." />}
      </section>

      {zoomCard && <CardZoom data={zoomCard} onClose={() => setZoomCard(null)} />}
      {variantCard && <VariantModal card={variantCard} onClose={() => setVariantCard(null)} onSaved={() => { setVariantCard(null); void loadCards(); void loadUsers(); }} onToast={onToast} />}
      {chatTrade && (
        <ChatModal
          trade={chatTrade}
          currentUserId={currentUser?.id ?? 0}
          messages={messages}
          value={messageText}
          onChange={setMessageText}
          onSend={sendChatMessage}
          onClose={() => setChatTrade(null)}
        />
      )}
    </div>
  );
}

function expandSelected(cards: TradeCard[], selection: SelectedLine[]) {
  return selection.map((line) => ({ card: cards.find((card) => card.id === line.collectionId), line })).filter((item): item is { card: TradeCard; line: SelectedLine } => Boolean(item.card));
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur"><p className="text-[11px] font-bold uppercase text-red-50">{label}</p><p className="text-2xl font-black text-white">{value}</p></div>;
}

function Badge({ children }: { children: string }) {
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{children}</span>;
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) return <img src={avatarUrl} alt={name} className="h-12 w-12 rounded-full object-cover" loading="lazy" />;
  return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-white">{name.slice(0, 1).toUpperCase()}</div>;
}

function TradeCardPanel(props: {
  title: string;
  cards: TradeCard[];
  selected: SelectedLine[];
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  mine?: boolean;
  onConfigure?: (card: TradeCard) => void;
  onToggle: (line: SelectedLine) => void;
  onQuantity: (line: SelectedLine, quantity: number) => void;
  onZoom: (card: TradeCard, variantType?: VariantType) => void;
}) {
  if (props.loading) return <Skeleton className="h-96" />;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-black text-slate-950">{props.title}</h4>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{props.selected.length} tipos</span>
      </div>
      {props.cards.length ? (
        <div className="max-h-[650px] space-y-3 overflow-y-auto pr-1">
          {props.cards.map((card) => (
            <div key={card.id} className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="grid grid-cols-[72px_1fr_auto] gap-3">
                <button type="button" onClick={() => props.onZoom(card)} className="relative">
                  <img src={card.image} alt={card.name} loading="lazy" className="h-24 w-[68px] object-contain" />
                  <span className="absolute bottom-1 right-1 rounded-full bg-white p-1 shadow"><Eye size={13} /></span>
                </button>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-black text-slate-950">{card.name}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">{card.set}</p>
                  <p className="mt-1 text-xs font-bold text-primary">#{card.number ?? card.cardId.split("-").at(-1) ?? "N/D"}</p>
                </div>
                {props.mine && (
                  <Button title="Configurar variantes" size="icon" variant="secondary" onClick={() => props.onConfigure?.(card)}>
                    <Settings2 size={15} />
                  </Button>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {availableVariants(card).length ? availableVariants(card).map((variant) => {
                  const line = { collectionId: card.id, variantType: variant.variantType, quantity: 1 };
                  const selected = props.selected.find((item) => selectionKey(item) === selectionKey(line));
                  return (
                    <div key={variant.variantType} className={`rounded-md border p-2 ${selected ? "border-primary bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => props.onToggle(line)} className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"}`}>
                          {selected && <Check size={14} />}
                        </button>
                        <button type="button" onClick={() => props.onZoom(card, variant.variantType)} className={`rounded-full px-2 py-1 text-xs font-black ${variantTone(variant.variantType)}`}>
                          {variantLabel(variant.variantType)}
                        </button>
                        <span className="text-xs font-bold text-slate-500">troca {variant.tradeQuantity} / possui {variant.ownedQuantity}</span>
                        {selected && (
                          <Select className="ml-auto h-8 w-20" value={String(selected.quantity)} onChange={(event) => props.onQuantity(selected, Number(event.target.value))}>
                            {Array.from({ length: variant.tradeQuantity }).map((_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                          </Select>
                        )}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-800">
                    Selecione o tipo da carta antes de disponibilizar para troca.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState title={props.emptyTitle} description={props.emptyDescription} />}
    </div>
  );
}

function SelectionPreview({ title, rows }: { title: string; rows: Array<{ card: TradeCard; line: SelectedLine }> }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-black uppercase text-slate-500">{title}</p>
      {rows.length ? <div className="space-y-2">{rows.map(({ card, line }) => <div key={selectionKey(line)} className="flex items-center gap-2 text-sm font-semibold text-slate-700"><span className="h-2 w-2 rounded-full bg-primary" /><span className="truncate">{card.name}</span><span className={`rounded-full px-2 py-1 text-[11px] ${variantTone(line.variantType)}`}>{variantLabel(line.variantType)}</span><span className="ml-auto text-xs text-slate-500">x{line.quantity}</span></div>)}</div> : <p className="text-sm text-slate-500">Nenhuma carta selecionada.</p>}
    </div>
  );
}

function ProposalCard({ proposal, currentUserId, onUpdate, onChat, onZoom }: { proposal: TradeProposal; currentUserId: number; onUpdate: (id: number, status: "ACCEPTED" | "REJECTED" | "CANCELLED") => Promise<void>; onChat: (proposal: TradeProposal) => void; onZoom: (card: TradeCardSnapshot) => void }) {
  const incoming = proposal.receiverId === currentUserId;
  const canAnswer = incoming && proposal.status === "PENDING";
  const canCancel = proposal.requesterId === currentUserId && proposal.status === "PENDING";
  const offered = proposal.cards?.filter((card) => card.side === "OFFERED") ?? proposal.offeredCards;
  const requested = proposal.cards?.filter((card) => card.side === "REQUESTED") ?? proposal.requestedCards;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-black ${statusClass[proposal.status]}`}>{statusLabel[proposal.status]}</span>
          <h4 className="mt-2 text-base font-black text-slate-950">{incoming ? `${proposal.requester.name} quer trocar com voce` : `Proposta para ${proposal.receiver.name}`}</h4>
          <p className="text-xs font-semibold text-slate-500">{new Date(proposal.createdAt).toLocaleString("pt-BR")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onChat(proposal)}><MessageCircle size={14} />Chat</Button>
          {canAnswer && <><Button size="sm" variant="primary" onClick={() => void onUpdate(proposal.id, "ACCEPTED")}><Handshake size={14} />Aceitar</Button><Button size="sm" variant="danger" onClick={() => void onUpdate(proposal.id, "REJECTED")}><X size={14} />Recusar</Button></>}
          {canCancel && <Button size="sm" variant="danger" onClick={() => void onUpdate(proposal.id, "CANCELLED")}>Cancelar</Button>}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ProposalCards title="Cartas oferecidas" cards={offered} onZoom={onZoom} />
        <ProposalCards title="Cartas solicitadas" cards={requested} onZoom={onZoom} />
      </div>
    </article>
  );
}

function ProposalCards({ title, cards, onZoom }: { title: string; cards: TradeCardSnapshot[]; onZoom: (card: TradeCardSnapshot) => void }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="mb-2 text-xs font-black uppercase text-slate-500">{title}</p><div className="space-y-2">{cards.map((card) => <button type="button" key={`${card.collectionId}-${card.cardId}-${card.variantType ?? "legacy"}`} onClick={() => onZoom(card)} className="grid w-full grid-cols-[38px_1fr] items-center gap-2 text-left"><img src={card.image} alt={card.name} loading="lazy" className="h-12 w-9 object-contain" /><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{card.name}</p><p className="text-xs text-slate-500">{card.set} #{card.number ?? "N/D"} · {variantLabel(card.variantType)} · x{card.quantity}</p></div></button>)}</div></div>;
}

function CardZoom({ data, onClose }: { data: { card: TradeCard | TradeCardSnapshot; variantType?: VariantType }; onClose: () => void }) {
  const card = data.card;
  const snapshotVariant = "variantType" in card ? card.variantType : undefined;
  const currentVariant = data.variantType ?? snapshotVariant;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-2 sm:p-5">
      <div className="grid h-[94vh] w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-glow lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 items-center justify-center bg-slate-950 p-3 sm:p-6">
          <img src={card.image} alt={card.name} className="h-full max-h-[88vh] w-full object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,0.45)]" />
        </div>
        <aside className="flex flex-col gap-4 border-t border-slate-200 p-5 lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-primary">Visualizacao ampliada</p>
              <h2 className="mt-1 text-2xl font-black leading-tight text-slate-950">{card.name}</h2>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar visualizacao">
              <X size={20} />
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-500">{card.set}</p>
            <p className="text-4xl font-black text-slate-950">#{card.number ?? "N/D"}</p>
            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-black ${variantTone(currentVariant)}`}>{variantLabel(currentVariant)}</span>
          </div>
          <p className="rounded-lg bg-slate-100 p-3 text-sm font-medium text-slate-600">
            Confira a arte em alta, numeracao, colecao e tipo antes de selecionar ou aceitar a troca.
          </p>
        </aside>
      </div>
    </div>
  );
}

function VariantModal({ card, onClose, onSaved, onToast }: { card: TradeCard; onClose: () => void; onSaved: () => void; onToast: (toast: ToastState) => void }) {
  const initial = variantOptions.reduce<VariantDraft>((draft, option) => {
    const current = (card.variantSummary ?? card.variants ?? []).find((variant) => variant.variantType === option.value);
    draft[option.value] = { ownedQuantity: current?.ownedQuantity ?? (option.value === "NORMAL" ? card.quantity : 0), tradeQuantity: current?.tradeQuantity ?? 0 };
    return draft;
  }, {} as VariantDraft);
  const [draft, setDraft] = useState<VariantDraft>(initial);
  async function save() {
    try {
      await apiService.updateCardVariants(card.id, variantOptions.map((option) => ({ variantType: option.value, ...draft[option.value] })));
      onToast({ type: "success", message: "Variantes atualizadas." });
      onSaved();
    } catch {
      onToast({ type: "error", message: "Quantidade para troca nao pode superar a quantidade possuida." });
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3">
      <div className="grid max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-glow lg:grid-cols-[280px_1fr]">
        <div className="flex items-center justify-center bg-slate-950 p-4">
          <img src={card.image} alt={card.name} className="max-h-[72vh] w-full object-contain drop-shadow-[0_20px_34px_rgba(0,0,0,0.45)]" />
        </div>
        <div className="overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-primary">Variantes da carta</p>
              <h2 className="text-xl font-black text-slate-950">{card.name}</h2>
              <p className="text-sm font-semibold text-slate-500">{card.set} #{card.number ?? "N/D"}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar variantes">
              <X size={18} />
            </Button>
          </div>
          <div className="space-y-3">
            {variantOptions.map((option) => (
              <div key={option.value} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_120px_120px] sm:items-center">
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${option.tone}`}>{option.label}</span>
                <label className="text-xs font-bold uppercase text-slate-500">
                  Possui
                  <Input type="number" min={0} value={draft[option.value].ownedQuantity} onChange={(event) => setDraft((current) => ({ ...current, [option.value]: { ...current[option.value], ownedQuantity: Math.max(0, Number(event.target.value)) } }))} />
                </label>
                <label className="text-xs font-bold uppercase text-slate-500">
                  Troca
                  <Input type="number" min={0} value={draft[option.value].tradeQuantity} onChange={(event) => setDraft((current) => ({ ...current, [option.value]: { ...current[option.value], tradeQuantity: Math.max(0, Number(event.target.value)) } }))} />
                </label>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={save}><Save size={16} />Salvar variantes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatModal({ trade, currentUserId, messages, value, onChange, onSend, onClose }: { trade: TradeProposal; currentUserId: number; messages: TradeMessage[]; value: string; onChange: (value: string) => void; onSend: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"><div className="flex h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-glow"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><p className="text-xs font-black uppercase text-primary">MiniChat da troca #{trade.id}</p><h2 className="text-lg font-black text-slate-950">{trade.requester.name} ↔ {trade.receiver.name}</h2></div><Button size="icon" variant="ghost" onClick={onClose}><X size={18} /></Button></div><div className="flex-1 space-y-3 overflow-y-auto bg-slate-100 p-4">{messages.length ? messages.map((message) => { const mine = message.senderId === currentUserId; return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-2xl px-3 py-2 shadow-sm ${mine ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-white text-slate-800"}`}><p className="text-sm font-medium">{message.message}</p><p className={`mt-1 text-[10px] ${mine ? "text-red-100" : "text-slate-400"}`}>{new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{message.isRead ? " · lida" : ""}</p></div></div>; }) : <EmptyState title="Comece a negociacao" description="Envie uma mensagem para combinar detalhes da troca." />}</div><div className="grid grid-cols-[1fr_auto] gap-2 border-t border-slate-200 p-3"><Input placeholder={trade.status === "CANCELLED" || trade.status === "CANCELED" ? "Troca cancelada" : "Digite sua mensagem"} value={value} disabled={trade.status === "CANCELLED" || trade.status === "CANCELED"} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSend(); }} /><Button variant="primary" disabled={!value.trim() || trade.status === "CANCELLED" || trade.status === "CANCELED"} onClick={onSend}><Send size={16} /></Button></div></div></div>;
}
