import { Skeleton } from "@/components/ui/skeleton";

/**
 * What every page of the app shows the moment a link is followed, while the server renders the
 * new one. Every page here is dynamic (the user's own data), and Next doesn't prefetch dynamic
 * routes without a loading.tsx: a click did nothing visible until the whole page arrived. With
 * it, this shell is prefetched and shows at once; the header and tab bar stay as they are.
 */
export default function Loading() {
  const block = "motion-reduce:animate-none";
  return (
    <div role="status" aria-label="Cargando" className="space-y-6">
      <span className="sr-only">Cargando…</span>
      <div className="space-y-2">
        <Skeleton className={`h-8 w-48 ${block}`} />
        <Skeleton className={`h-4 w-72 max-w-full opacity-70 ${block}`} />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          // Card-shaped, like most of what arrives.
          <Skeleton key={i} className={`aspect-[63/88] w-28 shrink-0 ${block}`} />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className={`h-12 rounded-lg opacity-60 ${block}`} />
        ))}
      </div>
    </div>
  );
}
