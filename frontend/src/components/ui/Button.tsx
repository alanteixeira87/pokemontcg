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
        "inline-flex items-center justify-center gap-2 rounded-md border transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-red-700",
        variant === "secondary" && "border-border bg-white text-foreground shadow-sm hover:bg-slate-50",
        variant === "ghost" && "border-transparent bg-transparent text-muted-foreground hover:bg-slate-100 hover:text-foreground",
        variant === "danger" && "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "icon" && "h-9 w-9",
        className
      )}
      {...props}
    />
  );
}
