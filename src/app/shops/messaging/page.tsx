"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ConfigForm = {
  whatsappProvider: string;
  klamboBaseUrl: string;
  klamboDefaultCountry: string;
  klamboConfigured: boolean;
  klamboApiKeyMasked: string | null;
  smsBaseUrl: string;
  smsSender: string;
  smsConfigured: boolean;
  smsApiKeyMasked: string | null;
  waBaseUrl: string;
  waFromNumber: string;
  waConfigured: boolean;
  waApiKeyMasked: string | null;
  notifySms: boolean;
  notifyWhatsapp: boolean;
  brandPrefix: string;
};

type Template = {
  id: string;
  eventKey: string;
  name: string;
  channel: "whatsapp" | "sms";
  body: string;
  isActive: boolean;
  infobipTemplateName: string | null;
  infobipLanguage: string;
};

export default function MessagingSettingsPage() {
  const { data: session } = authClient.useSession();
  const [config, setConfig] = useState<ConfigForm | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [klamboKey, setKlamboKey] = useState("");
  const [smsKey, setSmsKey] = useState("");
  const [waKey, setWaKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [editTpl, setEditTpl] = useState<Template | null>(null);
  const [denied, setDenied] = useState(false);

  async function load() {
    const cfg = await fetchJson<{
      config?: ConfigForm;
      error?: string;
    }>("/api/messaging/config");
    if (!cfg.res.ok) {
      setDenied(true);
      return;
    }
    setConfig(cfg.data?.config ?? null);
    setDenied(false);

    const tpl = await fetchJson<{ templates?: Template[] }>(
      "/api/messaging/templates",
    );
    setTemplates(tpl.data?.templates ?? []);
  }

  useEffect(() => {
    if (session) load();
  }, [session]);

  async function saveConfig() {
    if (!config) return;
    setBusy(true);
    const { res, data } = await fetchJson<{
      config?: ConfigForm;
      error?: string;
    }>("/api/messaging/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whatsappProvider: config.whatsappProvider,
        klamboBaseUrl: config.klamboBaseUrl,
        klamboDefaultCountry: config.klamboDefaultCountry,
        klamboApiKey: klamboKey || null,
        smsBaseUrl: config.smsBaseUrl,
        smsSender: config.smsSender,
        smsApiKey: smsKey || null,
        waBaseUrl: config.waBaseUrl,
        waFromNumber: config.waFromNumber || null,
        waApiKey: waKey || null,
        notifySms: config.notifySms,
        notifyWhatsapp: config.notifyWhatsapp,
        brandPrefix: config.brandPrefix,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    setConfig(data?.config ?? config);
    setKlamboKey("");
    setSmsKey("");
    setWaKey("");
    toast.success("Config messages enregistrée");
  }

  async function saveTemplate() {
    if (!editTpl) return;
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/messaging/templates",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editTpl.id,
          name: editTpl.name,
          body: editTpl.body,
          isActive: editTpl.isActive,
          infobipTemplateName: editTpl.infobipTemplateName,
          infobipLanguage: editTpl.infobipLanguage,
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Échec");
      return;
    }
    toast.success("Template mis à jour");
    setEditTpl(null);
    load();
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <Link href="/auth/login" className="text-primary">
          Connexion
        </Link>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-muted-foreground">
          Réservé au <strong>owner</strong> de l&apos;organisation Chip Shop.
        </p>
      </div>
    );
  }

  if (!config) {
    return (
      <PageLoader className="h-[30dvh]" />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-0">
      <div className="mb-6">
        <h1 className="font-heading text-xl font-bold">Messages & notifs</h1>
        <p className="text-xs text-muted-foreground">
          Config owner · Klambo / Infobip · templates Chip Shop pour tous les
          vendeurs
        </p>
      </div>

      <section className="mb-8 space-y-4 rounded-2xl border border-white/8 bg-[#13131a] p-4">
        <h2 className="font-heading text-sm font-bold">Marque & canaux</h2>
        <div className="space-y-2">
          <Label>Préfixe marque (ex. Chip Shop)</Label>
          <Input
            value={config.brandPrefix}
            onChange={(e) =>
              setConfig({ ...config, brandPrefix: e.target.value })
            }
            className="bg-[#1c1c26]"
          />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.notifyWhatsapp}
              onChange={(e) =>
                setConfig({ ...config, notifyWhatsapp: e.target.checked })
              }
            />
            WhatsApp
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.notifySms}
              onChange={(e) =>
                setConfig({ ...config, notifySms: e.target.checked })
              }
            />
            SMS
          </label>
        </div>
        <div className="space-y-2">
          <Label>Provider WhatsApp</Label>
          <select
            value={config.whatsappProvider}
            onChange={(e) =>
              setConfig({ ...config, whatsappProvider: e.target.value })
            }
            className="h-10 w-full rounded-lg border border-white/10 bg-[#1c1c26] px-3 text-sm"
          >
            <option value="klambo">Klambo</option>
            <option value="infobip">Infobip WhatsApp</option>
          </select>
        </div>
      </section>

      <section className="mb-8 space-y-3 rounded-2xl border border-white/8 bg-[#13131a] p-4">
        <h2 className="font-heading text-sm font-bold">
          Klambo{" "}
          <span className="text-[10px] font-normal text-muted-foreground">
            {config.klamboConfigured
              ? `(OK ${config.klamboApiKeyMasked})`
              : "(non configuré)"}
          </span>
        </h2>
        <Input
          type="password"
          placeholder="Nouvelle clé API Klambo"
          value={klamboKey}
          onChange={(e) => setKlamboKey(e.target.value)}
          className="bg-[#1c1c26]"
        />
        <Input
          value={config.klamboBaseUrl}
          onChange={(e) =>
            setConfig({ ...config, klamboBaseUrl: e.target.value })
          }
          className="bg-[#1c1c26]"
          placeholder="Base URL"
        />
      </section>

      <section className="mb-8 space-y-3 rounded-2xl border border-white/8 bg-[#13131a] p-4">
        <h2 className="font-heading text-sm font-bold">
          Infobip SMS{" "}
          <span className="text-[10px] font-normal text-muted-foreground">
            {config.smsConfigured
              ? `(OK ${config.smsApiKeyMasked})`
              : "(non configuré)"}
          </span>
        </h2>
        <Input
          type="password"
          placeholder="Nouvelle clé API SMS"
          value={smsKey}
          onChange={(e) => setSmsKey(e.target.value)}
          className="bg-[#1c1c26]"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={config.smsBaseUrl}
            onChange={(e) =>
              setConfig({ ...config, smsBaseUrl: e.target.value })
            }
            className="bg-[#1c1c26]"
            placeholder="Base URL"
          />
          <Input
            value={config.smsSender}
            onChange={(e) =>
              setConfig({ ...config, smsSender: e.target.value })
            }
            className="bg-[#1c1c26]"
            placeholder="Sender"
          />
        </div>
      </section>

      <section className="mb-8 space-y-3 rounded-2xl border border-white/8 bg-[#13131a] p-4">
        <h2 className="font-heading text-sm font-bold">
          Infobip WhatsApp{" "}
          <span className="text-[10px] font-normal text-muted-foreground">
            {config.waConfigured
              ? `(OK ${config.waApiKeyMasked})`
              : "(non configuré)"}
          </span>
        </h2>
        <Input
          type="password"
          placeholder="Nouvelle clé API WA"
          value={waKey}
          onChange={(e) => setWaKey(e.target.value)}
          className="bg-[#1c1c26]"
        />
        <Input
          value={config.waFromNumber}
          onChange={(e) =>
            setConfig({ ...config, waFromNumber: e.target.value })
          }
          className="bg-[#1c1c26]"
          placeholder="From number WhatsApp"
        />
        <Input
          value={config.waBaseUrl}
          onChange={(e) =>
            setConfig({ ...config, waBaseUrl: e.target.value })
          }
          className="bg-[#1c1c26]"
          placeholder="Base URL"
        />
      </section>

      <Button
        className="mb-10 h-11 w-full font-bold"
        disabled={busy}
        onClick={saveConfig}
      >
        {busy ? "…" : "Enregistrer la config"}
      </Button>

      <h2 className="mb-3 font-heading text-sm font-bold">
        Templates livraison (tous vendeurs)
      </h2>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Variables : {"{{brand}}"}, {"{{shop_name}}"}, {"{{customer_name}}"},{" "}
        {"{{product_title}}"}, {"{{courier_name}}"}, {"{{courier_phone}}"},{" "}
        {"{{distance_km}}"}, {"{{eta_text}}"}, {"{{pickup_code}}"},{" "}
        {"{{tracking_url}}"}
      </p>
      <ul className="space-y-2">
        {templates.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border border-white/8 bg-[#13131a] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {t.name}{" "}
                  <span className="text-[10px] text-muted-foreground">
                    {t.eventKey} · {t.channel}
                  </span>
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                  {t.body}
                </p>
                <span
                  className={cn(
                    "mt-1 inline-block text-[10px] font-bold",
                    t.isActive ? "text-trust" : "text-muted-foreground",
                  )}
                >
                  {t.isActive ? "Actif" : "Inactif"}
                </span>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setEditTpl(t)}>
                Éditer
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {editTpl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#13131a] p-4">
            <h3 className="mb-3 font-heading font-bold">
              {editTpl.name} · {editTpl.channel}
            </h3>
            <div className="space-y-3">
              <Input
                value={editTpl.name}
                onChange={(e) =>
                  setEditTpl({ ...editTpl, name: e.target.value })
                }
                className="bg-[#1c1c26]"
              />
              <Textarea
                value={editTpl.body}
                onChange={(e) =>
                  setEditTpl({ ...editTpl, body: e.target.value })
                }
                className="min-h-36 bg-[#1c1c26] text-sm"
              />
              {editTpl.channel === "whatsapp" && (
                <Input
                  value={editTpl.infobipTemplateName ?? ""}
                  onChange={(e) =>
                    setEditTpl({
                      ...editTpl,
                      infobipTemplateName: e.target.value || null,
                    })
                  }
                  placeholder="Nom template Infobip (optionnel)"
                  className="bg-[#1c1c26]"
                />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editTpl.isActive}
                  onChange={(e) =>
                    setEditTpl({ ...editTpl, isActive: e.target.checked })
                  }
                />
                Actif
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setEditTpl(null)}
              >
                Annuler
              </Button>
              <Button className="flex-[2]" disabled={busy} onClick={saveTemplate}>
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
