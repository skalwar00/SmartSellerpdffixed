export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 animate-pulse">
      <div className="h-14 rounded-xl bg-muted/60" />
      <div className="h-36 rounded-xl bg-muted/60" />
      <div className="h-52 rounded-xl bg-muted/60" />
    </div>
  )
}
