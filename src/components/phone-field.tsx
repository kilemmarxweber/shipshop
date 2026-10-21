"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
import {
  COUNTRY_DIALS,
  composePhone,
  countryByDial,
  countryMatches,
  flagEmoji,
  looksLikeEmailInput,
  looksLikeNumericPhoneInput,
  splitPhone,
} from "@/lib/phone";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  label?: string;
  value: string;
  onChange: (e164: string) => void;
  required?: boolean;
  className?: string;
  /** Connexion : e-mail ou numéro (indicatif + longueur pays). */
  emailOrPhone?: boolean;
  autoComplete?: string;
};

export function PhoneField({
  id = "contact-phone",
  label = "Téléphone de contact",
  value,
  onChange,
  required = true,
  className,
  emailOrPhone = false,
  autoComplete,
}: Props) {
  const numericPhoneMode = !emailOrPhone || looksLikeNumericPhoneInput(value);
  const emailMode = emailOrPhone && looksLikeEmailInput(value);
  const showDialSelector = !emailMode && numericPhoneMode;
  const parts = splitPhone(showDialSelector ? value : "");
  const [selectedDial, setSelectedDial] = useState(parts.dial);
  const activeDial = showDialSelector && !value.trim() ? selectedDial : parts.dial;
  const country = countryByDial(activeDial);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => COUNTRY_DIALS.filter((c) => countryMatches(c, query)),
    [query],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!showDialSelector) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const parsed = splitPhone(trimmed);
    if (parsed.dial !== selectedDial) setSelectedDial(parsed.dial);
  }, [showDialSelector, value, selectedDial]);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <div
        ref={boxRef}
        className="relative flex h-11 overflow-visible rounded-lg border border-border bg-surface-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
      >
        {showDialSelector ? (
          <>
            <button
              type="button"
              aria-label="Choisir le pays"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="flex h-11 shrink-0 items-center gap-1 px-2 text-base"
            >
              <span className="text-base leading-none" aria-hidden>
                {flagEmoji(country.iso)}
              </span>
              <span className="font-medium">{country.dial}</span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </button>
            <span className="my-1.5 w-px shrink-0 bg-border" aria-hidden />
          </>
        ) : null}
        <input
          id={id}
          type={emailMode ? "email" : "tel"}
          inputMode={emailMode ? "email" : "numeric"}
          autoComplete={
            autoComplete ??
            (emailOrPhone ? "username" : "tel-national")
          }
          pattern={emailMode || emailOrPhone ? undefined : "[0-9]*"}
          maxLength={showDialSelector ? country.max : undefined}
          value={showDialSelector ? parts.national : value}
          onChange={(e) => {
            const raw = e.target.value;
            if (emailOrPhone && !looksLikeNumericPhoneInput(raw)) {
              onChange(raw);
              return;
            }
            const hasExplicitDial = /^\s*(\+|00)/.test(raw);
            if (showDialSelector && hasExplicitDial) {
              const parsed = splitPhone(raw);
              setSelectedDial(parsed.dial);
              onChange(composePhone(parsed.dial, parsed.national));
              return;
            }
            onChange(composePhone(country.dial, raw));
          }}
          placeholder={
            emailOrPhone
              ? emailMode
                ? "vous@email.com"
                : `${"8".repeat(country.max)} ou e-mail`
              : "8".repeat(country.max)
          }
          className="h-11 min-w-0 flex-1 border-0 bg-transparent px-2.5 text-base outline-none"
        />

        {showDialSelector && open && (
          <div className="absolute top-[calc(100%+4px)] left-0 z-50 w-[min(100%,20rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pays, indicatif, code…"
                className="h-11 w-full bg-transparent text-base outline-none"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">
                  Aucun pays
                </li>
              ) : (
                filtered.map((c) => (
                  <li key={c.iso}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDial(c.dial);
                        onChange(composePhone(c.dial, parts.national));
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60",
                        c.dial === country.dial && "bg-primary/10",
                      )}
                    >
                      <span className="text-base leading-none" aria-hidden>
                        {flagEmoji(c.iso)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.dial}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
      {showDialSelector ? (
        <p className="text-[10px] text-muted-foreground">
          {flagEmoji(country.iso)} {country.label} {country.dial} — {country.max}{" "}
          chiffre{country.max > 1 ? "s" : ""}
          {country.min !== country.max ? ` (min. ${country.min})` : ""}, sans le
          0.
        </p>
      ) : null}
    </div>
  );
}
