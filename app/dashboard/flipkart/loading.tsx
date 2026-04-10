export default function FlipkartLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 animate-pulse">
      <div className="h-14 rounded-xl bg-muted/60" />
      <div className="h-28 rounded-xl bg-muted/60" />
      <div className="h-44 rounded-xl bg-muted/60" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted/60" />
        ))}
      </div>
    </div>
  )
}
