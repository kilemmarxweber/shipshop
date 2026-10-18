import { PortableText, type PortableTextComponents } from "@portabletext/react";

const components: PortableTextComponents = {
  block: {
    h2: ({ children }) => (
      <h2 className="mt-6 font-heading text-lg font-bold">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-4 text-base font-semibold">{children}</h3>
    ),
    normal: ({ children }) => (
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    ),
  },
};

export function SanityPortableText({
  value,
}: {
  value: unknown;
}) {
  if (!Array.isArray(value) || value.length === 0) return null;
  return <PortableText value={value} components={components} />;
}
