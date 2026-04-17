import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Building2, Phone, Mail, MapPin, Clock, Inbox, AlertCircle } from 'lucide-react'
import { DemoRequestActions } from '@/components/admin/demo-request-actions'

export default async function DemoRequestsPage() {
  const supabase = createAdminClient()

  // Try fetching with status column; fall back if migration hasn't run yet
  let requests: Record<string, unknown>[] = []
  let hasStatusColumn = true
  let tableError = false

  const { data, error } = await supabase
    .from('demo_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    tableError = true
  } else {
    requests = data ?? []
    // Detect if status column is missing (first row won't have it)
    if (requests.length > 0 && !('status' in requests[0])) {
      hasStatusColumn = false
    }
    // If no rows, try a probe insert to check column existence
    if (requests.length === 0) {
      const { error: probeError } = await supabase
        .from('demo_requests')
        .select('status')
        .limit(0)
      if (probeError?.message?.includes("status")) {
        hasStatusColumn = false
      }
    }
  }

  const pending = requests.filter((r) => r.status !== 'done')
  const done = requests.filter((r) => r.status === 'done')

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demo Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Landing page se aaye hue demo requests —{' '}
            <span className="font-medium text-foreground">{pending.length} pending</span>
            {done.length > 0 && (
              <span className="text-muted-foreground">, {done.length} done</span>
            )}
          </p>
        </div>
      </div>

      {tableError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            <p className="font-semibold">Table setup required</p>
            <p className="mt-1">
              Supabase mein <code className="bg-red-100 px-1 rounded">demo_requests</code> table banana padega.{' '}
              <code className="bg-red-100 px-1 rounded text-xs">scripts/005_demo_requests.sql</code> run karein.
            </p>
          </CardContent>
        </Card>
      )}

      {!hasStatusColumn && !tableError && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Migration required — Demo Done / Delete kaam nahi karega abhi</p>
                <p className="mt-1">
                  Supabase Studio &gt; SQL Editor mein yeh run karein:
                </p>
                <pre className="mt-2 bg-amber-100 rounded p-2 text-xs overflow-x-auto">
                  {`ALTER TABLE demo_requests\n  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';`}
                </pre>
                <p className="mt-1 text-xs">
                  Ya <code className="bg-amber-100 px-1 rounded">scripts/007_demo_requests_status.sql</code> file run karein.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!tableError && requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-10 w-10 mb-3 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">Abhi tak koi demo request nahi</p>
            <p className="text-sm text-muted-foreground mt-1">Jab koi form submit karega, yahan dikhega</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Pending ({pending.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((req) => (
                  <RequestCard key={req.id as string} req={req} hasStatusColumn={hasStatusColumn} />
                ))}
              </div>
            </div>
          )}

          {/* Done */}
          {done.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Done ({done.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {done.map((req) => (
                  <RequestCard key={req.id as string} req={req} hasStatusColumn={hasStatusColumn} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RequestCard({
  req,
  hasStatusColumn,
}: {
  req: Record<string, unknown>
  hasStatusColumn: boolean
}) {
  const isDone = req.status === 'done'

  return (
    <Card className={`transition-shadow ${isDone ? 'opacity-60' : 'hover:shadow-md'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{req.company_name as string}</CardTitle>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isDone
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {isDone ? 'Done' : 'New'}
          </span>
        </div>
        <CardDescription className="flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          {new Date(req.created_at as string).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <a href={`tel:${req.mobile as string}`} className="hover:text-foreground hover:underline">
            {req.mobile as string}
          </a>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <a
            href={`mailto:${req.email as string}`}
            className="hover:text-foreground hover:underline truncate"
          >
            {req.email as string}
          </a>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span>{req.city as string}</span>
        </div>

        {hasStatusColumn && (
          <DemoRequestActions id={req.id as string} status={(req.status as string) ?? 'pending'} />
        )}
      </CardContent>
    </Card>
  )
}
