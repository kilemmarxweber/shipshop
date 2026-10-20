import { z } from "zod";
import {
  looksLikeEmail,
  normalizeAccountPhone,
} from "@/lib/phone";

export const PHONE_EMAIL_DOMAIN = "phone.shipshop.cd";

export function emailFromPhone(phone: string) {
  const e164 = normalizeAccountPhone(phone) ?? phone;
  return `${e164.replace(/\D/g, "")}@${PHONE_EMAIL_DOMAIN}`;
}

export function isPhoneBackedEmail(email?: string | null) {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${PHONE_EMAIL_DOMAIN}`);
}

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z
    .string()
    .trim()
    .transform((value) => value.toLowerCase())
    .refine((value) => value === "" || looksLikeEmail(value), {
      message: "email",
    }),
  phone: z.string().refine((value) => Boolean(normalizeAccountPhone(value)), {
    message: "phone",
  }),
  password: z.string().min(8).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
