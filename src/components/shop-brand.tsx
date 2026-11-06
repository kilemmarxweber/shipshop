import { cn } from "@/lib/utils";
import Link from "next/link";

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
        "relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-trust text-xs font-bold text-white ring-2",
        live
          ? "ss-shop-live overflow-visible ring-[#E11D48]"
          : "ss-shop-pulse overflow-visible ring-trust",
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
  /** Sans live : ouvre une preview (sheet) au lieu de la page boutique. */
  onPreview?: (e: React.MouseEvent) => void;
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
  onPreview,
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

  const classNames = cn("flex min-w-0 items-center gap-2", className);

  if (liveId) {
    return (
      <Link href={`/live/${liveId}`} onClick={onClick} className={classNames}>
        {inner}
      </Link>
    );
  }

  if (onPreview) {
    return (
      <button
        type="button"
        onClick={(e) => {
          onClick?.(e);
          onPreview(e);
        }}
        className={cn(
          classNames,
          "cursor-pointer border-0 bg-transparent p-0 text-left",
        )}
      >
        {inner}
      </button>
    );
  }

  if (slug) {
    return (
      <Link
        href={`/shop/${slug}#produits`}
        onClick={onClick}
        className={classNames}
      >
        {inner}
      </Link>
    );
  }

  return <span className={classNames}>{inner}</span>;
}
