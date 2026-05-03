import { X } from "lucide-react";
import { Button } from "./Button";

export type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm animate-[fadeIn_180ms_ease-out] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <span className={toast.type === "success" ? "font-semibold text-emerald-700 dark:text-emerald-300" : "font-semibold text-red-700 dark:text-red-300"}>{toast.message}</span>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar aviso">
        <X size={16} />
      </Button>
    </div>
  );
}

