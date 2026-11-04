export function productStock(product: {
  quantity?: number | null;
  status?: string | null;
}) {
  if (product.status && product.status !== "ACTIVE") return 0;
  return Math.max(0, Number(product.quantity) || 0);
}

export function productInStock(product: {
  quantity?: number | null;
  status?: string | null;
}) {
  return productStock(product) > 0;
}

export const inStockWhere = {
  status: "ACTIVE" as const,
  quantity: { gt: 0 },
};
