export const CART_UPDATED_EVENT = "cart-updated";

type CartUpdatedDetail = { count?: number };

export function notifyCartUpdated(count?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CartUpdatedDetail>(CART_UPDATED_EVENT, {
      detail: { count },
    }),
  );
}

export function cartCountFromEvent(event: Event): number | undefined {
  const count = (event as CustomEvent<CartUpdatedDetail>).detail?.count;
  return typeof count === "number" ? count : undefined;
}
