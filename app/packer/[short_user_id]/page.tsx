'use client'

import { useState, useEffect, useCallback, use, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PicklistItem {
  master_sku: string
  total_qty: number
  picked_qty: number
  status: 'pending' | 'picked' | 'updated'
}

type SyncStatus = 'online' | 'syncing' | 'offline'

function haptic(pattern: number | number[] = 40) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern)
  }
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

// ─── PIN Screen ───────────────────────────────────────────────────────────────
function PinScreen({ onSuccess, error }: { onSuccess: (pin: string) => void; error: string }) {
  const [pin, setPin] = useState('')

  const handleDigit = (d: string) => {
    if (pin.length < 4) {
      const newPin = pin + d
      setPin(newPin)
      haptic(30)
      if (newPin.length === 4) {
        onSuccess(newPin)
        setPin('')
      }
    }
  }

  const handleBackspace = () => {
    setPin(p => p.slice(0, -1))
    haptic(20)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
              <span className="text-white text-lg font-black">S</span>
            </div>
            <span className="text-sm font-semibold text-gray-500 tracking-wide">SmartSeller Suite</span>
          </div>
          <div className="text-4xl mb-3">📦</div>
          <h1 className="text-2xl font-bold text-gray-900">Packer View</h1>
          <p className="text-gray-500 mt-1 text-sm">Enter your 4-digit PIN to continue</p>
        </div>

        <div className="flex justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${
                i < pin.length
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300 bg-white'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-red-500 text-sm mb-4 animate-pulse">{error}</p>
        )}

        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="h-16 rounded-2xl bg-white border border-gray-200 text-2xl font-semibold text-gray-800 shadow-sm active:scale-95 active:bg-gray-100 transition-transform"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl bg-white border border-gray-200 text-2xl font-semibold text-gray-800 shadow-sm active:scale-95 active:bg-gray-100 transition-transform"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-16 rounded-2xl bg-white border border-gray-200 text-2xl font-semibold text-gray-800 shadow-sm active:scale-95 active:bg-gray-100 transition-transform flex items-center justify-center"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Qty Edit Modal ───────────────────────────────────────────────────────────
function QtyModal({
  item,
  onClose,
  onSet,
}: {
  item: PicklistItem
  onClose: () => void
  onSet: (qty: number) => void
}) {
  const [val, setVal] = useState(String(item.picked_qty))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.select(), 80)
  }, [])

  const apply = (qty: number) => {
    const clamped = Math.max(0, Math.min(qty, item.total_qty))
    haptic(40)
    onSet(clamped)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl p-6 pb-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Set picked qty
        </p>
        <p className="font-bold text-gray-900 text-base mb-4 break-all">{item.master_sku}</p>

        <div className="flex items-center gap-3 mb-5">
          <input
            ref={inputRef}
            type="number"
            min={0}
            max={item.total_qty}
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') apply(parseInt(val) || 0) }}
            className="flex-1 h-14 rounded-2xl border-2 border-gray-200 bg-gray-50 text-center text-3xl font-bold text-gray-900 focus:border-blue-500 focus:outline-none"
          />
          <span className="text-gray-400 text-lg font-medium">/ {item.total_qty}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={() => apply(0)}
            className="h-12 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm active:bg-gray-100"
          >
            Reset to 0
          </button>
          <button
            onClick={() => apply(item.total_qty)}
            className="h-12 rounded-2xl bg-green-500 text-white font-semibold text-sm active:bg-green-600"
          >
            Mark All Done ✓
          </button>
        </div>

        <button
          onClick={() => apply(parseInt(val) || 0)}
          className="w-full h-13 rounded-2xl bg-blue-500 text-white font-bold text-base py-3 active:bg-blue-600"
        >
          Set {Math.max(0, Math.min(parseInt(val) || 0, item.total_qty))} units
        </button>
      </div>
    </div>
  )
}

// ─── Picker Card ──────────────────────────────────────────────────────────────
function PickerCard({
  item,
  shortUserId,
  onUpdate,
  onOpenQtyModal,
}: {
  item: PicklistItem
  shortUserId: string
  onUpdate: (sku: string, newPicked: number, newStatus: string) => void
  onOpenQtyModal: (item: PicklistItem) => void
}) {
  const [syncing, setSyncing] = useState(false)
  const isDone = item.status === 'picked'
  const isUpdated = item.status === 'updated'

  const sendPick = useCallback(async (newPicked: number) => {
    setSyncing(true)
    try {
      const res = await fetch('/api/picklist/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          short_user_id: shortUserId,
          master_sku: item.master_sku,
          picked_qty: newPicked,
        }),
      })
      const json = await res.json()
      if (json.success) {
        haptic(newPicked >= item.total_qty ? [40, 30, 80] : 40)
        onUpdate(item.master_sku, json.picked_qty, json.status)
      }
    } finally {
      setSyncing(false)
    }
  }, [shortUserId, item.master_sku, item.total_qty, onUpdate])

  const increment = () => {
    if (item.picked_qty >= item.total_qty || syncing) return
    sendPick(item.picked_qty + 1)
  }

  const decrement = () => {
    if (item.picked_qty <= 0 || syncing) return
    sendPick(item.picked_qty - 1)
  }

  const progressPct = item.total_qty > 0
    ? Math.round((item.picked_qty / item.total_qty) * 100)
    : 0

  const cardBg = isDone
    ? 'bg-green-50 border-green-300'
    : isUpdated
    ? 'bg-orange-50 border-orange-300'
    : 'bg-white border-gray-200'

  const accent = isDone ? 'bg-green-500' : isUpdated ? 'bg-orange-400' : 'bg-blue-500'

  return (
    <div className={`rounded-2xl border-2 p-4 shadow-sm transition-all ${cardBg} ${syncing ? 'opacity-80' : ''}`}>
      {isUpdated && (
        <div className="mb-2 flex items-center gap-1.5 text-orange-600 text-xs font-semibold bg-orange-100 rounded-lg px-2 py-1.5">
          <span>🔔</span>
          <span>Quantity updated — please re-check!</span>
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base leading-tight break-all">{item.master_sku}</p>
        </div>
        {isDone && <span className="ml-2 text-2xl">✅</span>}
        {syncing && (
          <div className="ml-2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mt-1" />
        )}
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${accent}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={decrement}
          disabled={item.picked_qty <= 0 || syncing}
          className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-700 text-3xl font-bold flex items-center justify-center disabled:opacity-30 active:scale-95 active:bg-gray-200 transition-transform"
        >
          −
        </button>

        <button
          onClick={() => onOpenQtyModal(item)}
          className="flex-1 text-center py-2 rounded-xl active:bg-gray-100 transition-colors"
        >
          <span className={`text-4xl font-black ${isDone ? 'text-green-600' : isUpdated ? 'text-orange-500' : 'text-gray-900'}`}>
            {item.picked_qty}
          </span>
          <span className="text-gray-400 text-xl"> / {item.total_qty}</span>
          <p className="text-xs text-gray-400 mt-0.5">tap to set</p>
        </button>

        <button
          onClick={increment}
          disabled={item.picked_qty >= item.total_qty || syncing}
          className={`w-14 h-14 rounded-2xl text-white text-3xl font-bold flex items-center justify-center disabled:opacity-30 active:scale-95 active:opacity-80 transition-transform ${accent}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

// ─── Sync Status Dot ──────────────────────────────────────────────────────────
function SyncDot({ status }: { status: SyncStatus }) {
  const colors: Record<SyncStatus, string> = {
    online: 'bg-green-500',
    syncing: 'bg-yellow-400 animate-pulse',
    offline: 'bg-red-500',
  }
  const labels: Record<SyncStatus, string> = {
    online: 'Live',
    syncing: 'Syncing',
    offline: 'Offline',
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${colors[status]}`} />
      <span className="text-xs text-gray-500">{labels[status]}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PackerPage({
  params,
}: {
  params: Promise<{ short_user_id: string }>
}) {
  const { short_user_id } = use(params)

  const [authPin, setAuthPin] = useState<string | null>(null)
  const [correctPin, setCorrectPin] = useState<string | null>(null)
  const [items, setItems] = useState<PicklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [pinError, setPinError] = useState('')
  const [search, setSearch] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [qtyModalItem, setQtyModalItem] = useState<PicklistItem | null>(null)

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setSyncStatus('syncing')
    setIsSyncing(true)
    try {
      const res = await fetch(`/api/picklist/packer/${short_user_id}`)
      if (!res.ok) {
        setPageError('Invalid packer link. Please ask your manager for the correct link.')
        setSyncStatus('offline')
        return
      }
      const json = await res.json()
      setCorrectPin(json.security_pin)
      setItems(json.items || [])
      setLastUpdated(new Date())
      setSyncStatus('online')
    } catch {
      setSyncStatus('offline')
      if (!quiet) setPageError('Failed to load picklist. Please check your connection.')
    } finally {
      setLoading(false)
      setIsSyncing(false)
    }
  }, [short_user_id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Online/offline detection
  useEffect(() => {
    const setOnline = () => setSyncStatus(prev => prev === 'syncing' ? 'syncing' : 'online')
    const setOffline = () => setSyncStatus('offline')
    window.addEventListener('online', setOnline)
    window.addEventListener('offline', setOffline)
    return () => {
      window.removeEventListener('online', setOnline)
      window.removeEventListener('offline', setOffline)
    }
  }, [])

  // Supabase Realtime after auth
  useEffect(() => {
    if (!authPin) return
    const supabase = createClient()
    setSyncStatus('syncing')
    const channel = supabase
      .channel(`picklist:${short_user_id}`)
      .on('broadcast', { event: 'picklist_update' }, ({ payload }) => {
        if (payload?.items) {
          setItems(payload.items)
          setLastUpdated(new Date())
          haptic([30, 20, 60])
        }
      })
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') setSyncStatus('online')
        else if (state === 'CLOSED' || state === 'CHANNEL_ERROR') setSyncStatus('offline')
      })
    return () => { supabase.removeChannel(channel) }
  }, [authPin, short_user_id])

  const handlePinAttempt = (pin: string) => {
    if (pin === correctPin) {
      haptic([30, 20, 80])
      setAuthPin(pin)
      setPinError('')
    } else {
      haptic([80, 40, 80])
      setPinError('Wrong PIN. Try again.')
    }
  }

  const handleItemUpdate = (sku: string, newPicked: number, newStatus: string) => {
    setItems(prev =>
      prev.map(item =>
        item.master_sku === sku
          ? { ...item, picked_qty: newPicked, status: newStatus as PicklistItem['status'] }
          : item
      )
    )
    setLastUpdated(new Date())
  }

  const handleQtySet = async (qty: number) => {
    if (!qtyModalItem) return
    const item = qtyModalItem
    setIsSyncing(true)
    try {
      const res = await fetch('/api/picklist/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          short_user_id,
          master_sku: item.master_sku,
          picked_qty: qty,
        }),
      })
      const json = await res.json()
      if (json.success) {
        handleItemUpdate(item.master_sku, json.picked_qty, json.status)
      }
    } finally {
      setIsSyncing(false)
    }
  }

  // ── Screens: loading / error / PIN ─────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading picklist…</p>
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-4xl mb-3">❌</div>
          <p className="text-gray-700 font-medium">{pageError}</p>
        </div>
      </div>
    )
  }

  if (!authPin && false) {
    return <PinScreen onSuccess={handlePinAttempt} error={pinError} />
  }

  // ── Stats ───────────────────────────────────────────────────────────
  const totalItems = items.length
  const pickedItems = items.filter(i => i.status === 'picked').length
  const totalQty = items.reduce((s, i) => s + i.total_qty, 0)
  const pickedQty = items.reduce((s, i) => s + i.picked_qty, 0)
  const overallPct = totalQty > 0 ? Math.round((pickedQty / totalQty) * 100) : 0

  // ── Filter by search ────────────────────────────────────────────────
  const searchLower = search.toLowerCase()
  const filtered = items.filter(i =>
    i.master_sku.toLowerCase().includes(searchLower)
  )
  const pending = filtered.filter(i => i.status !== 'picked')
  const done = filtered.filter(i => i.status === 'picked')

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        {/* Top row */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
                  <span className="text-white text-xs font-black">S</span>
                </div>
                <h1 className="text-sm font-bold text-gray-900">Picklist</h1>
              </div>
              <SyncDot status={syncStatus} />
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold text-gray-700">{pickedItems}/{totalItems} SKUs</span>
              {lastUpdated && (
                <p className="text-xs text-gray-400">Updated {formatTime(lastUpdated)}</p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${overallPct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {pickedQty} / {totalQty} units picked
            <span className="font-semibold text-gray-700 ml-1">({overallPct}%)</span>
          </p>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">🔍</span>
            <input
              type="text"
              placeholder="Search SKU…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-10 rounded-xl bg-gray-100 border border-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Item List ── */}
      <div className="px-4 py-4 space-y-3 pb-28">
        {filtered.length === 0 && search ? (
          <div className="text-center py-12">
            <p className="text-gray-500 font-medium">No SKU found for "{search}"</p>
            <button onClick={() => setSearch('')} className="text-blue-500 text-sm mt-2">Clear search</button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-gray-500 font-medium">No items in picklist yet.</p>
            <p className="text-gray-400 text-sm mt-1">Ask your manager to push the orders.</p>
          </div>
        ) : (
          <>
            {pending.map(item => (
              <PickerCard
                key={item.master_sku}
                item={item}
                shortUserId={short_user_id}
                onUpdate={handleItemUpdate}
                onOpenQtyModal={setQtyModalItem}
              />
            ))}
            {done.length > 0 && (
              <>
                <div className="pt-2 pb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Completed ({done.length})
                  </p>
                </div>
                {done.map(item => (
                  <PickerCard
                    key={item.master_sku}
                    item={item}
                    shortUserId={short_user_id}
                    onUpdate={handleItemUpdate}
                    onOpenQtyModal={setQtyModalItem}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Floating Sync Button (bottom-right) ── */}
      <div className="fixed bottom-6 right-5 z-30">
        <button
          onClick={() => { haptic(30); loadData(true) }}
          disabled={isSyncing}
          title={isSyncing ? 'Syncing…' : 'Sync latest data'}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-90 ${
            isSyncing
              ? 'bg-gray-400 cursor-not-allowed'
              : syncStatus === 'offline'
              ? 'bg-red-500'
              : 'bg-gray-900'
          }`}
        >
          <span className={`text-xl ${isSyncing ? 'animate-spin inline-block' : ''}`}>
            {isSyncing ? '⟳' : syncStatus === 'offline' ? '⚠️' : '🔄'}
          </span>
        </button>
      </div>

      {/* ── Qty Modal ── */}
      {qtyModalItem && (
        <QtyModal
          item={qtyModalItem}
          onClose={() => setQtyModalItem(null)}
          onSet={handleQtySet}
        />
      )}
    </div>
  )
}
