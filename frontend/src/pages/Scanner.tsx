import { AlertTriangle, Camera, CheckCircle2, Heart, ImagePlus, Loader2, RotateCcw, ScanLine, Search, Sparkles, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/ui/Modal";
import { apiService } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import type { CollectionItem, ExploreCard, ScanMatch, ScanResult } from "../types";
import type { ToastState } from "../components/ui/Toast";
import { currency } from "../lib/utils";

type ImageValidation = {
  valid: boolean;
  warnings: string[];
  fatalError?: string;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;

export function Scanner({ onToast }: { onToast: (toast: ToastState) => void }) {
  const setView = useAppStore((state) => state.setView);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [validation, setValidation] = useState<ImageValidation | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<ScanMatch | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | "collection" | "wishlist" | "favorite">(null);
  const [actionLoading, setActionLoading] = useState(false);

  const requiresManual = scanResult?.requiresManualConfirmation ?? false;

  const confidenceTone = useMemo(() => {
    const level = scanResult?.confidence.level;
    if (level === "HIGH") return "bg-emerald-100 text-emerald-700";
    if (level === "MEDIUM") return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
  }, [scanResult?.confidence.level]);

  async function validateImage(nextFile: File): Promise<ImageValidation> {
    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      return { valid: false, warnings: [], fatalError: "Formato inválido. Use JPG, PNG ou WEBP." };
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      return { valid: false, warnings: [], fatalError: "A imagem excede 8MB. Escolha um arquivo menor." };
    }

    const bitmap = await loadImage(nextFile);
    const warnings: string[] = [];

    if (bitmap.width < MIN_WIDTH || bitmap.height < MIN_HEIGHT) {
      return {
        valid: false,
        warnings,
        fatalError: `Resolução mínima recomendada: ${MIN_WIDTH}x${MIN_HEIGHT}.`
      };
    }

    const quality = analyzeQuality(bitmap);
    if (quality.brightness < 35) {
      warnings.push("A imagem parece escura. Tente tirar outra foto em um local mais iluminado.");
    }
    if (quality.sharpness < 16) {
      warnings.push("A imagem parece pouco nítida. Tente tirar outra foto em um local mais iluminado.");
    }

    return {
      valid: true,
      warnings
    };
  }

  async function onSelectImage(nextFile: File | null) {
    if (!nextFile) return;
    setScanResult(null);
    setSelectedMatch(null);

    const result = await validateImage(nextFile);
    setValidation(result);
    if (!result.valid) {
      onToast({ type: "error", message: result.fatalError ?? "Imagem inválida." });
      setFile(null);
      setPreviewUrl("");
      return;
    }

    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    if (result.warnings.length) {
      onToast({ type: "error", message: result.warnings[0] });
    }
  }

  async function analyzeCard() {
    if (!file) return;
    setLoading(true);
    try {
      const result = await apiService.scanCard(file, { language: "PT-BR", variantType: "NORMAL", condition: "Nao informado" });
      setScanResult(result);
      setSelectedMatch(result.bestMatch ?? result.matches[0] ?? null);
      if (result.fallbackMessage) {
        onToast({ type: "error", message: result.fallbackMessage });
      } else {
        onToast({ type: "success", message: "Analise concluida. Confirme o resultado antes de adicionar." });
      }
    } catch {
      setScanResult(null);
      setSelectedMatch(null);
      onToast({ type: "error", message: "Nao foi possivel analisar a imagem agora." });
    } finally {
      setLoading(false);
    }
  }

  function clearScanner() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setValidation(null);
    setScanResult(null);
    setSelectedMatch(null);
  }

  async function executeAction(action: "collection" | "wishlist" | "favorite") {
    if (!selectedMatch) return;
    const card = matchToExploreCard(selectedMatch);

    setActionLoading(true);
    try {
      if (action === "collection") {
        await apiService.addToCollection(card, 1);
      }

      if (action === "wishlist") {
        await apiService.addWishlist(card);
      }

      if (action === "favorite") {
        const created = await apiService.addToCollection(card, 1);
        await apiService.updateCollection(created.id, { favorite: true });
      }

      onToast({ type: "success", message: "Acao concluida com sucesso." });
      setConfirmAction(null);
    } catch {
      onToast({ type: "error", message: "Nao foi possivel concluir esta acao." });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Scanner Inteligente</p>
            <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Escanear carta</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Use camera, galeria ou upload para identificar a carta com score de confianca.</p>
          </div>
          <Button variant="secondary" onClick={clearScanner}>
            <RotateCcw size={16} />
            Tentar novamente
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <Camera size={16} />
              Abrir camera
              <input
                className="hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(event) => void onSelectImage(event.target.files?.[0] ?? null)}
              />
            </label>

            <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <ImagePlus size={16} />
              Upload / galeria
              <input
                className="hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void onSelectImage(event.target.files?.[0] ?? null)}
              />
            </label>

            <Button className="w-full" variant="primary" disabled={!file || loading || !validation?.valid} onClick={() => void analyzeCard()}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
              {loading ? "Analisando..." : "Analisar carta"}
            </Button>

            {validation?.warnings?.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                <p className="font-semibold">Aviso de qualidade</p>
                {validation.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}

            {scanResult?.fallbackMessage && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <p className="font-semibold">Nao conseguimos identificar a carta automaticamente.</p>
                <p>Tente nova foto ou use busca manual.</p>
                <Button className="mt-2" size="sm" variant="secondary" onClick={() => setView("explore")}>
                  <Search size={14} />
                  Ir para busca manual
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            {previewUrl ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Preview</p>
                <img src={previewUrl} alt="Preview da carta" className="mx-auto max-h-[420px] rounded-lg object-contain" />
              </div>
            ) : (
              <EmptyState title="Nenhuma imagem selecionada" description="Envie uma foto para iniciar a analise do scanner." />
            )}
          </div>
        </div>
      </section>

      {scanResult && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Resultado da analise</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Confirme se esta e realmente a carta correta antes de adicionar a colecao.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${confidenceTone}`}>
              Score {scanResult.confidence.score} - {scanResult.confidence.level}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Correspondencias</p>
              {scanResult.matches.length ? (
                <div className="space-y-2">
                  {scanResult.matches.map((match) => (
                    <button
                      key={`${match.cardId}-${match.confidence.score}`}
                      type="button"
                      onClick={() => setSelectedMatch(match)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selectedMatch?.cardId === match.cardId
                          ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/30"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-950 dark:text-white">{match.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{match.set} - {match.number ?? match.cardId}</p>
                        </div>
                        <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white">{match.confidence.score}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{match.confidence.reasons.join(" | ")}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState title="Sem correspondencia" description="Tire outra foto ou use busca manual." />
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
              {selectedMatch ? (
                <>
                  <img src={selectedMatch.image} alt={selectedMatch.name} className="mx-auto max-h-64 rounded-lg object-contain" />
                  <div>
                    <h4 className="text-base font-semibold text-slate-950 dark:text-white">{selectedMatch.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">ID: {selectedMatch.cardId}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Colecao: {selectedMatch.set}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Raridade: {selectedMatch.rarity ?? "Nao informada"}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Variacao: {scanResult.extracted.variantType}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Idioma: {scanResult.extracted.language}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Preco: {selectedMatch.marketPrice === null ? "N/D" : currency(selectedMatch.marketPrice)}</p>
                  </div>

                  {requiresManual && (
                    <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs font-semibold text-amber-700">
                      Score abaixo de 85. Confirmacao manual obrigatoria.
                    </p>
                  )}

                  <div className="grid gap-2">
                    <Button variant="primary" onClick={() => setConfirmAction("collection")}>
                      <CheckCircle2 size={16} />
                      Adicionar a colecao
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmAction("wishlist")}>
                      <Heart size={16} />
                      Adicionar a lista de desejos
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmAction("favorite")}>
                      <Star size={16} />
                      Favoritar
                    </Button>
                    <Button variant="ghost" onClick={clearScanner}>
                      <RotateCcw size={16} />
                      Escanear novamente
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState title="Selecione uma correspondencia" description="Escolha um resultado para liberar as acoes." />
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
            <p className="font-semibold">Dados extraidos:</p>
            <p>Nome: {scanResult.extracted.cardName ?? "Nao identificado"}</p>
            <p>Numero: {scanResult.extracted.cardNumbers.join(", ") || "Nao identificado"}</p>
            <p>Set code: {scanResult.extracted.setCodes.join(", ") || "Nao identificado"}</p>
          </div>
        </section>
      )}

      <Modal title="Confirmacao" open={Boolean(confirmAction)} onClose={() => setConfirmAction(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Confirme se esta e realmente a carta correta antes de adicionar a colecao.
          </p>
          {selectedMatch && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950/40">
              <p className="font-semibold text-slate-950 dark:text-white">{selectedMatch.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{selectedMatch.set} - {selectedMatch.number ?? selectedMatch.cardId}</p>
            </div>
          )}
          {requiresManual && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs font-semibold text-amber-700">
              <AlertTriangle size={14} className="inline-block" /> Confirmacao manual obrigatoria devido a confianca inferior a 85.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            <Button variant="primary" disabled={actionLoading} onClick={() => confirmAction && void executeAction(confirmAction)}>
              {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function matchToExploreCard(match: ScanMatch): ExploreCard {
  return {
    id: match.cardId,
    name: match.name,
    image: match.image,
    set: match.set,
    setId: match.setId ?? undefined,
    number: match.number ?? undefined,
    rarity: match.rarity ?? undefined,
    marketPrice: match.marketPrice
  };
}

function loadImage(file: File): Promise<{ width: number; height: number; image: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight, image });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel carregar a imagem."));
    };
    image.src = url;
  });
}

function analyzeQuality(bitmap: { width: number; height: number; image: HTMLImageElement }): { brightness: number; sharpness: number } {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return { brightness: 100, sharpness: 100 };

  context.drawImage(bitmap.image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

  let brightnessSum = 0;
  const gray = new Array<number>(canvas.width * canvas.height);

  for (let i = 0, idx = 0; i < data.length; i += 4, idx += 1) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[idx] = luma;
    brightnessSum += luma;
  }

  const brightness = brightnessSum / gray.length;

  let diffSum = 0;
  for (let y = 1; y < canvas.height - 1; y += 1) {
    for (let x = 1; x < canvas.width - 1; x += 1) {
      const center = gray[y * canvas.width + x];
      const right = gray[y * canvas.width + (x + 1)];
      const down = gray[(y + 1) * canvas.width + x];
      diffSum += Math.abs(center - right) + Math.abs(center - down);
    }
  }

  const sharpness = diffSum / (canvas.width * canvas.height);
  return { brightness, sharpness };
}
