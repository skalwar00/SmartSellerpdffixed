'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2, XCircle, Clock, ImageIcon, RefreshCw,
  Loader2, CreditCard, Info, ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { approvePayment, rejectPayment } from '../actions'

type Payment = {
  id: string
  user_id: string
  email: string | null
  amount: number
  screenshot_url: string | null
  status: string
  admin_notes: string | null
  created_at: string
}

const SQL_SETUP = `-- Run this in your Supabase SQL editor:

CREATE TABLE IF NOT EXISTS payment_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email text,
  amount integer DEFAULT 999,
  screenshot_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own payment requests"
  ON payment_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own payment requests"
  ON payment_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
  VALUES ('payment-screenshots', 'payment-screenshots', false)
  ON CONFLICT DO NOTHING;

CREATE POLICY "Auth users upload screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-screenshots');

CREATE POLICY "Auth users view screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-screenshots');`

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <Badge className="bg-green-100 text-green-800 border border-green-200 gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>
  if (status === 'rejected') return <Badge className="bg-red-100 text-red-800 border border-red-200 gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>
  return <Badge className="bg-amber-100 text-amber-800 border border-amber-200 gap-1"><Clock className="h-3 w-3" />Pending</Badge>
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [tableExists, setTableExists] = useState(true)
  const [showSetup, setShowSetup] = useState(false)

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<Payment | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payments')
      if (res.status === 404) {
        setTableExists(false)
      } else {
        setTableExists(true)
        const data = await res.json()
        setPayments(Array.isArray(data) ? data : [])
      }
    } catch {
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const getSignedUrl = async (url: string) => {
    if (!url) return null
    if (url.startsWith('http')) return url
    const supabase = createClient()
    const { data } = await supabase.storage
      .from('payment-screenshots')
      .createSignedUrl(url, 300)
    return data?.signedUrl ?? null
  }

  const openScreenshot = async (url: string) => {
    const signed = await getSignedUrl(url)
    if (signed) setLightboxUrl(signed)
    else toast.error('Could not load screenshot')
  }

  const doApprove = (p: Payment) => {
    setActionId(p.id)
    startTransition(async () => {
      try {
        await approvePayment(p.id, p.user_id)
        await load()
        toast.success(`Payment approved — ${p.email ?? p.user_id} upgraded to Pro`)
      } catch {
        toast.error('Failed to approve payment')
      } finally {
        setActionId(null)
      }
    })
  }

  const doReject = (p: Payment) => {
    setActionId(p.id)
    startTransition(async () => {
      try {
        await rejectPayment(p.id, rejectNote)
        await load()
        toast.success('Payment rejected')
        setRejectModal(null)
        setRejectNote('')
      } catch {
        toast.error('Failed to reject payment')
      } finally {
        setActionId(null)
      }
    })
  }

  const filtered = payments.filter((p) =>
    filter === 'all' ? true : p.status === filter
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review and verify payment submissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSetup(true)}>
            <Info className="h-3.5 w-3.5 mr-1.5" />
            Setup
          </Button>
        </div>
      </div>

      {!tableExists && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold">Database setup required</p>
              <p className="mt-0.5">The <code className="bg-blue-100 px-1 rounded">payment_requests</code> table doesn&apos;t exist yet.
                Click <button className="underline font-medium" onClick={() => setShowSetup(true)}>Setup Guide</button> to get the SQL to run in Supabase.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading payments…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <CreditCard className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No payment requests</p>
          <p className="text-xs mt-1">Payment submissions from users will appear here</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const isActing = actionId === p.id && pending
            return (
              <Card key={p.id} className="overflow-hidden">
                <div className={`h-1.5 w-full ${p.status === 'approved' ? 'bg-green-400' : p.status === 'rejected' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{p.email ?? 'Unknown User'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{p.user_id.slice(0, 16)}…</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-bold">₹{p.amount}</span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Submitted {new Date(p.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>

                  {p.screenshot_url ? (
                    <button
                      onClick={() => openScreenshot(p.screenshot_url!)}
                      className="flex w-full items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 px-3 py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      <ImageIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">View payment screenshot</span>
                      <ExternalLink className="h-3.5 w-3.5 ml-auto shrink-0" />
                    </button>
                  ) : (
                    <div className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-sm text-muted-foreground/60">
                      <ImageIcon className="h-4 w-4 shrink-0" />
                      No screenshot uploaded
                    </div>
                  )}

                  {p.admin_notes && (
                    <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                      <span className="font-medium">Note: </span>{p.admin_notes}
                    </div>
                  )}

                  {p.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => doApprove(p)}
                        disabled={isActing}
                      >
                        {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve</>}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => { setRejectModal(p); setRejectNote('') }}
                        disabled={isActing}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Screenshot</DialogTitle>
            <DialogDescription>Review the payment proof submitted by the user</DialogDescription>
          </DialogHeader>
          {lightboxUrl && (
            <img src={lightboxUrl} alt="Payment screenshot" className="w-full rounded-lg object-contain max-h-[70vh]" />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectModal} onOpenChange={() => setRejectModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
            <DialogDescription>Optionally add a note explaining why the payment was rejected.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)…"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectModal && doReject(rejectModal)}
              disabled={pending}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject Payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSetup} onOpenChange={setShowSetup}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Database Setup</DialogTitle>
            <DialogDescription>Run this SQL in your Supabase project → SQL Editor → New Query</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-gray-950 p-4 overflow-auto max-h-96">
            <pre className="text-xs text-gray-200 whitespace-pre-wrap font-mono">{SQL_SETUP}</pre>
          </div>
          <Button onClick={() => { navigator.clipboard.writeText(SQL_SETUP); toast.success('SQL copied to clipboard') }}>
            Copy SQL
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
