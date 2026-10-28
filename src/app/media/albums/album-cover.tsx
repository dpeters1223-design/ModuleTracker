import type { AlbumCover } from "@/lib/media";

/**
 * An album's cover: a mosaic of its first few items. One item fills the square, two
 * to four tile it. Empty albums get a hint instead of a blank box.
 */
export function AlbumCoverMosaic({ covers, className = "" }: { covers: AlbumCover[]; className?: string }) {
  if (covers.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-900 ${className}`}
      >
        Empty
      </div>
    );
  }
  return (
    <div
      className={`grid gap-px bg-zinc-200 dark:bg-zinc-800 ${
        covers.length === 1 ? "grid-cols-1" : covers.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2"
      } ${className}`}
    >
      {covers.map((c) => (
        <div key={c.id} className="relative bg-zinc-100 dark:bg-zinc-900">
          {c.isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by our own signed-in route
            <img
              src={`/api/media/${c.id}?thumb=1`}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
              File
            </span>
          )}
        </div>
      ))}
      {/* Three items would leave a ragged hole in the 2×2 grid; this fills it. */}
      {covers.length === 3 && <div className="bg-zinc-100 dark:bg-zinc-900" />}
    </div>
  );
}
