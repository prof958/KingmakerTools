import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared loading state for every tab under (app). All six pages are
 * `force-dynamic` (they read live campaign data), so a route change always
 * waits on a server round-trip; without this, App Router shows nothing at
 * all until that finishes — a click that looks like it did nothing. This
 * fires immediately on navigation and gets swapped for the real page the
 * moment its data arrives.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
