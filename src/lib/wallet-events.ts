export const WALLET_UPDATED_EVENT = "wallet-updated";

/** Header / pages listen and refetch `/api/wallet`. */
export function notifyWalletUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WALLET_UPDATED_EVENT));
}
