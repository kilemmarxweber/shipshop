import Link from "next/link";
import type { LegalSection } from "@/lib/shiprewards/legal-copy";

export function LegalArticle({
  title,
  intro,
  sections,
}: {
  title: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <article className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 pb-24">
      <p className="text-xs font-semibold text-muted-foreground">
        <Link href="/profile" className="hover:text-primary">
          Profil
        </Link>
        {" · "}
        <Link href="/help/vendeur" className="hover:text-primary">
          Aide
        </Link>
      </p>
      <h1 className="font-heading text-2xl font-extrabold">{title}</h1>
      {intro ? <p className="text-sm leading-relaxed text-muted-foreground">{intro}</p> : null}
      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="font-heading text-base font-bold">{section.title}</h2>
          {section.body.map((p) => (
            <p key={p.slice(0, 48)} className="text-sm leading-relaxed text-foreground/90">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
