import Image from "next/image";
import Link from "next/link";

export function TenantBrand({ name, logo, href }: { name: string; logo?: string | null; href: string }) {
  return <Link href={href} className="flex min-w-0 items-center gap-2.5 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={name}>
    {logo?.trim() ? <Image src={logo} alt="" width={44} height={44} unoptimized className="h-10 w-10 shrink-0 rounded-xl object-contain sm:h-11 sm:w-11" />
      : <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-bold text-primary">{name.trim().slice(0, 1)}</span>}
    <span className="truncate text-base font-semibold sm:text-lg">{name}</span>
  </Link>;
}
