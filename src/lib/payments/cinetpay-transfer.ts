import { getAppName } from "@/lib/app-name";
import {
  cinetpayCallbackOrigin,
  createCinetPayTransfer,
  sanitizeCinetPayText,
} from "@/lib/payments/cinetpay";
import type { AppCurrency } from "@/lib/money";
import type { RailProvider } from "@/lib/payments/provider";

export async function sendCinetPayPayout(input: {
  withdrawalId: string;
  amountCents: number;
  currency: AppCurrency;
  phone: string;
  provider: RailProvider;
  customerName: string;
}) {
  const origin = cinetpayCallbackOrigin();
  const notifyUrl = `${origin}/api/payments/cinetpay/transfer-notify`;
  const app = sanitizeCinetPayText(getAppName(), 40) || "ShipShop";
  return createCinetPayTransfer({
    transactionId: input.withdrawalId,
    amountCents: input.amountCents,
    currency: input.currency,
    phone: input.phone,
    provider: input.provider,
    description: `Retrait ${app} pour ${input.customerName}`,
    notifyUrl,
  });
}
