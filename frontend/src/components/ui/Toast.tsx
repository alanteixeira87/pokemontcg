import { X } from "lucide-react";
import { Button } from "./Button";

export type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-md border border-border bg-white px-4 py-3 text-sm shadow-glow">
      <span className={toast.type === "success" ? "text-emerald-700" : "text-red-700"}>{toast.message}</span>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar aviso">
        <X size={16} />
      </Button>
    </div>
  );
}
