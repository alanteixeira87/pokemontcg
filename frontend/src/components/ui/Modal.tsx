import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

type ModalProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-white p-5 shadow-glow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar modal">
            <X size={18} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
