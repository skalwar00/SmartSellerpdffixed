import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Building2, Phone, Mail, MapPin, Clock, Inbox } from 'lucide-react'

export default async function DemoRequestsPage() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('demo_requests')
    .select('*')
    .order('created_at', { ascending: false })

  const requests = data ?? []

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demo Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Landing page se aaye hue demo requests — {requests.length} total
          </p>
        </div>
      </div>

      {error && (
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

      {!error && requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-10 w-10 mb-3 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">Abhi tak koi demo request nahi</p>
            <p className="text-sm text-muted-foreground mt-1">Jab koi form submit karega, yahan dikhega</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((req) => (
            <Card key={req.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{req.company_name}</CardTitle>
                  <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    New
                  </span>
                </div>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {new Date(req.created_at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <a href={`tel:${req.mobile}`} className="hover:text-foreground hover:underline">{req.mobile}</a>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <a href={`mailto:${req.email}`} className="hover:text-foreground hover:underline truncate">{req.email}</a>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{req.city}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
