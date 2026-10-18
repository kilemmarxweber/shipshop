import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  slug?: string;
  logoUrl?: string | null;
  className?: string;
  avatarClassName?: string;
  nameClassName?: string;
  showAt?: boolean;
  onClick?: (e: React.MouseEvent) => void;
};

export function ShopBrand({
  name,
  slug,
  logoUrl,
  className,
  avatarClassName,
  nameClassName,
  showAt = true,
  onClick,
}: Props) {
  const inner = (
    <>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-violet-500 text-xs font-bold text-white ring-2 ring-white/20",
          avatarClassName,
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-full object-cover" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className={cn("truncate font-bold", nameClassName)}>
        {showAt ? `@${name}` : name}
      </span>
    </>
  );

  if (slug) {
    return (
      <Link
        href={`/shop/${slug}`}
        onClick={onClick}
        className={cn("flex min-w-0 items-center gap-2", className)}
      >
        {inner}
      </Link>
    );
  }

  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      {inner}
    </span>
  );
}
