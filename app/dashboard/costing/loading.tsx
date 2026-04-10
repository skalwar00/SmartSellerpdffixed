export default function CostingLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 animate-pulse">
      <div className="h-14 rounded-xl bg-muted/60" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted/60" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted/60" />
    </div>
  )
}
