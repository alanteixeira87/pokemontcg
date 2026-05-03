import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({ className, variant = "secondary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border font-medium transition-all duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--app-ring)]",
        variant === "primary" &&
          "border-indigo-600 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700",
        variant === "secondary" &&
          "border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
        variant === "ghost" &&
          "border-transparent bg-transparent text-slate-500 hover:bg-slate-100/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
        variant === "danger" &&
          "border-red-200 bg-red-50 text-red-700 shadow-sm hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "icon" && "h-9 w-9",
        className
      )}
      {...props}
    />
  );
}

