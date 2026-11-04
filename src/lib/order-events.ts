export const ORDER_UPDATED_EVENT = "chipshop:order-updated";
export const ORDER_UPDATED_STORAGE_KEY = "chipshop.orderUpdated.v1";

/** Même onglet + les autres onglets du navigateur rechargent les commandes. */
export function notifyOrdersChanged(orderId?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ORDER_UPDATED_EVENT, { detail: { orderId } }),
  );
  try {
    localStorage.setItem(
      ORDER_UPDATED_STORAGE_KEY,
      JSON.stringify({ orderId: orderId ?? null, t: Date.now() }),
    );
  } catch {
    /* quota / navigation privée */
  }
}
