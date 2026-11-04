import Link from "next/link";
import { cn } from "@/lib/utils";

export function ShopLiveAvatar({
  name,
  logoUrl,
  live = false,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-trust text-xs font-bold text-white ring-2 ring-white/20",
        live && "ss-shop-live overflow-visible ring-[#E11D48]",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-full place-items-center overflow-hidden rounded-full",
          live && "ss-shop-live-face absolute inset-0",
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-full object-cover" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </span>
      {live ? (
        <span className="ss-shop-live-label pointer-events-none absolute inset-0 grid place-items-center rounded-full bg-[#E11D48] text-[8px] font-extrabold tracking-[0.12em] text-white">
          LIVE
        </span>
      ) : null}
    </span>
  );
}

type Props = {
  name: string;
  slug?: string;
  logoUrl?: string | null;
  liveId?: string | null;
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
  liveId,
  className,
  avatarClassName,
  nameClassName,
  showAt = true,
  onClick,
}: Props) {
  const live = Boolean(liveId);
  const inner = (
    <>
      <ShopLiveAvatar
        name={name}
        logoUrl={logoUrl}
        live={live}
        className={avatarClassName}
      />
      <span className={cn("truncate font-bold", nameClassName)}>
        {showAt ? `@${name}` : name}
      </span>
    </>
  );

  const href = liveId ? `/live/${liveId}` : slug ? `/shop/${slug}#produits` : null;

  if (href) {
    return (
      <Link
        href={href}
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
