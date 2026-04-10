export default function SubscriptionLoading() {
  return (
    <div className="flex flex-1 flex-col gap-8 p-4 sm:p-6 animate-pulse">
      <div className="h-10 w-48 mx-auto rounded-lg bg-muted/60" />
      <div className="mx-auto grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        <div className="h-80 rounded-xl bg-muted/60" />
        <div className="h-80 rounded-xl bg-muted/60" />
      </div>
    </div>
  )
}
