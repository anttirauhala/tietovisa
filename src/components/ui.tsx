"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

/**
 * Pienet jaetut käyttöliittymäpalat: painike, kortti ja huomiot.
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-b from-fuchsia-500 to-violet-700 text-white shadow-lg shadow-violet-950/40 hover:from-fuchsia-400 hover:to-violet-600",
  secondary: "bg-white/15 text-white border border-white/25 hover:bg-white/25",
  ghost: "bg-transparent text-white/85 hover:bg-white/10",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`tv-card p-5 sm:p-7 ${className}`}>{children}</div>;
}

export function Spinner({ label = "Ladataan…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-white/80">
      <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      <span>{label}</span>
    </div>
  );
}

type NoticeTone = "error" | "info" | "success";

const NOTICE_STYLES: Record<NoticeTone, string> = {
  error: "border-rose-300/40 bg-rose-500/20 text-rose-50",
  info: "border-white/20 bg-white/10 text-white",
  success: "border-emerald-300/40 bg-emerald-500/20 text-emerald-50",
};

const NOTICE_ICONS: Record<NoticeTone, React.ComponentType<{ className?: string }>> = {
  error: XCircle,
  info: Info,
  success: CheckCircle2,
};

export function Notice({
  tone = "info",
  children,
  className = "",
}: {
  tone?: NoticeTone;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = NOTICE_ICONS[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm sm:text-base ${NOTICE_STYLES[tone]} ${className}`}
    >
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function WarningIcon({ className = "size-5" }: { className?: string }) {
  return <AlertTriangle className={className} />;
}
