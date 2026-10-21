"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PromptOptions = {
  title?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type PromptState = {
  open: boolean;
  title: string;
  description: string;
  placeholder: string;
  value: string;
  confirmLabel: string;
  cancelLabel: string;
};

const DEFAULT_STATE: PromptState = {
  open: false,
  title: "Saisir une valeur",
  description: "",
  placeholder: "",
  value: "",
  confirmLabel: "Valider",
  cancelLabel: "Annuler",
};

export function usePromptDialog() {
  const [state, setState] = useState<PromptState>(DEFAULT_STATE);
  const resolverRef = useRef<((value: string | null) => void) | null>(null);

  const closeWith = useCallback((value: string | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const prompt = useCallback((options?: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      if (resolverRef.current) {
        resolverRef.current(null);
      }
      resolverRef.current = resolve;
      setState({
        open: true,
        title: options?.title ?? DEFAULT_STATE.title,
        description: options?.description ?? DEFAULT_STATE.description,
        placeholder: options?.placeholder ?? DEFAULT_STATE.placeholder,
        value: options?.defaultValue ?? "",
        confirmLabel: options?.confirmLabel ?? DEFAULT_STATE.confirmLabel,
        cancelLabel: options?.cancelLabel ?? DEFAULT_STATE.cancelLabel,
      });
    });
  }, []);

  function PromptDialog() {
    return (
      <Dialog open={state.open} onOpenChange={(open) => !open && closeWith(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{state.title}</DialogTitle>
            {state.description ? (
              <DialogDescription>{state.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <Input
            value={state.value}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                value: e.target.value,
              }))
            }
            placeholder={state.placeholder}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                closeWith(state.value);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => closeWith(null)}>
              {state.cancelLabel}
            </Button>
            <Button onClick={() => closeWith(state.value)}>
              {state.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return { prompt, PromptDialog };
}

