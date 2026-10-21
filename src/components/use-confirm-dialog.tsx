"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type ConfirmState = Required<ConfirmOptions> & { open: boolean };

const DEFAULT_STATE: ConfirmState = {
  open: false,
  title: "Confirmation",
  description: "",
  confirmLabel: "Confirmer",
  cancelLabel: "Annuler",
};

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>(DEFAULT_STATE);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const closeWith = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const confirm = useCallback((options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      if (resolverRef.current) {
        resolverRef.current(false);
      }
      resolverRef.current = resolve;
      setState({
        open: true,
        title: options?.title ?? DEFAULT_STATE.title,
        description: options?.description ?? DEFAULT_STATE.description,
        confirmLabel: options?.confirmLabel ?? DEFAULT_STATE.confirmLabel,
        cancelLabel: options?.cancelLabel ?? DEFAULT_STATE.cancelLabel,
      });
    });
  }, []);

  function ConfirmDialog() {
    return (
      <Dialog open={state.open} onOpenChange={(open) => !open && closeWith(false)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{state.title}</DialogTitle>
            {state.description ? (
              <DialogDescription>{state.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeWith(false)}>
              {state.cancelLabel}
            </Button>
            <Button onClick={() => closeWith(true)}>{state.confirmLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return { confirm, ConfirmDialog };
}

