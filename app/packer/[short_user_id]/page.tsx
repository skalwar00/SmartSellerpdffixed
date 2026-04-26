'use client'

import { useState, useEffect, useCallback, use, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutGrid, List } from 'lucide-react'

interface PicklistItem {
  master_sku: string
  total_qty: number
  picked_qty: number
  status: 'pending' | 'picked' | 'updated'
  shortage?: boolean
  remaining_stock?: number
  image_url?: string | null
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

function formatPushTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const sameDay = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  if (sameDay) return `today ${time}`
  if (isYesterday) return `yesterday ${time}`
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + time
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
  onShortage,
}: {
  item: PicklistItem
  onClose: () => void
  onSet: (qty: number) => void
  onShortage: (remainingQty: number) => void
}) {
  const [val, setVal] = useState(String(item.picked_qty))
  const [shortageQty, setShortageQty] = useState(String(item.picked_qty))
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

  const reportShortage = () => {
    const availableQty = Math.max(0, parseInt(shortageQty) || 0)
    haptic([40, 30, 60])
    onShortage(availableQty)
    onClose()
  }

  const clearShortage = () => {
    haptic(30)
    onShortage(-1)
    onClose()
  }

  const isDone = item.status === 'picked'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl p-6 pb-10 overflow-y-auto max-h-[90vh]"
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
          className="w-full rounded-2xl bg-blue-500 text-white font-bold text-base py-3 active:bg-blue-600 mb-5"
        >
          Set {Math.max(0, Math.min(parseInt(val) || 0, item.total_qty))} units
        </button>

        {/* ── Actual Stock Section ── */}
        {!isDone && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Actual Stock</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {item.shortage ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3">
                <p className="text-red-600 font-semibold text-sm mb-3">⚠️ Shortage already reported</p>
                <button
                  onClick={clearShortage}
                  className="w-full h-11 rounded-xl border-2 border-red-300 text-red-600 font-semibold text-sm active:bg-red-100"
                >
                  Clear Shortage
                </button>
              </div>
            ) : (
              <div className={`border rounded-2xl p-4 ${
                (() => {
                  const av = parseInt(shortageQty) || 0
                  if (av > item.total_qty) return 'bg-green-50 border-green-200'
                  if (av > 0 && av < item.total_qty) return 'bg-orange-50 border-orange-200'
                  return 'bg-orange-50 border-orange-200'
                })()
              }`}>
                <p className="text-gray-700 text-xs font-medium mb-3">
                  Warehouse mein actual available stock enter karein
                </p>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Available stock</p>
                    <input
                      type="number"
                      min={0}
                      value={shortageQty}
                      onChange={e => setShortageQty(e.target.value)}
                      className="w-full h-12 rounded-xl border-2 border-gray-200 bg-white text-center text-2xl font-bold text-gray-900 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                  <span className="text-gray-400 text-sm font-medium mt-4">needed: {item.total_qty}</span>
                </div>
                {/* Smart message */}
                {(() => {
                  const av = parseInt(shortageQty) || 0
                  if (av > item.total_qty) {
                    const extra = av - item.total_qty
                    return (
                      <p className="text-green-700 text-xs font-semibold mb-3 bg-green-100 rounded-lg px-2 py-1.5">
                        ✅ Order fulfill hoga ({item.total_qty} units) + {extra} units remaining stock save hoga
                      </p>
                    )
                  }
                  if (av > 0 && av < item.total_qty) {
                    const short = item.total_qty - av
                    return (
                      <p className="text-orange-700 text-xs font-semibold mb-3 bg-orange-100 rounded-lg px-2 py-1.5">
                        ⚠️ Shortage! {short} units short — manager ko notify hoga
                      </p>
                    )
                  }
                  if (av === item.total_qty) {
                    return (
                      <p className="text-green-700 text-xs font-semibold mb-3 bg-green-100 rounded-lg px-2 py-1.5">
                        ✅ Order exactly fulfill hoga
                      </p>
                    )
                  }
                  return null
                })()}
                <button
                  onClick={reportShortage}
                  className={`w-full h-12 rounded-xl text-white font-bold text-sm ${
                    (() => {
                      const av = parseInt(shortageQty) || 0
                      return av >= item.total_qty ? 'bg-green-500 active:bg-green-600' : 'bg-red-500 active:bg-red-600'
                    })()
                  }`}
                >
                  {(() => {
                    const av = parseInt(shortageQty) || 0
                    if (av > item.total_qty) return `✅ Fulfill Order + Save ${av - item.total_qty} Remaining`
                    if (av === item.total_qty) return '✅ Fulfill Order'
                    return '⚠️ Report Shortage'
                  })()}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Celebration Overlay ──────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#FFEAA7','#96CEB4','#DDA0DD','#FF9F43','#A29BFE']

function CelebrationOverlay({ onDismiss }: { onDismiss: () => void }) {
  const pieces = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: Math.round(Math.random() * 100),
    delay: parseFloat((Math.random() * 1.8).toFixed(2)),
    duration: parseFloat((2.4 + Math.random() * 1.8).toFixed(2)),
    size: Math.round(6 + Math.random() * 8),
    shape: i % 3, // 0=circle, 1=square, 2=rect
  })), [])

  useEffect(() => {
    const t = setTimeout(onDismiss, 4200)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      <style>{`
        @keyframes ssp-fall {
          0%   { transform: translateY(-16px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(105vh) rotate(600deg); opacity: 0; }
        }
        @keyframes ssp-pop {
          0%   { transform: translate(-50%,-50%) scale(0.4); opacity: 0; }
          55%  { transform: translate(-50%,-50%) scale(1.08); opacity: 1; }
          75%  { transform: translate(-50%,-50%) scale(0.97); }
          100% { transform: translate(-50%,-50%) scale(1);   opacity: 1; }
        }
        @keyframes ssp-fade {
          0%,65% { opacity: 1; }
          100%    { opacity: 0; }
        }
      `}</style>

      {/* Confetti */}
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: -12,
            width: p.shape === 2 ? `${p.size * 1.8}px` : `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.shape === 0 ? '50%' : '3px',
            animation: `ssp-fall ${p.duration}s ${p.delay}s ease-in forwards`,
            willChange: 'transform',
          }}
        />
      ))}

      {/* Achievement card */}
      <div
        className="pointer-events-auto"
        onClick={onDismiss}
        style={{
          position: 'fixed',
          top: '46%',
          left: '50%',
          animation: 'ssp-pop 0.55s cubic-bezier(.34,1.56,.64,1) forwards, ssp-fade 4.2s ease-in-out forwards',
          textAlign: 'center',
          cursor: 'pointer',
        }}
      >
        <div style={{
          background: 'linear-gradient(135deg,#667eea,#764ba2)',
          borderRadius: 24,
          padding: '28px 40px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          color: '#fff',
          minWidth: 260,
          maxWidth: 300,
        }}>
          <div style={{ fontSize: 60, lineHeight: 1, marginBottom: 10 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>All Packed!</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 16, lineHeight: 1.5 }}>
            Excellent work — every item picked!
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.2)', borderRadius: 100,
            padding: '6px 16px', fontSize: 13, fontWeight: 700,
          }}>
            🏆 Picklist Complete
          </div>
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 14 }}>tap to dismiss</div>
        </div>
      </div>
    </div>
  )
}

// ─── URL normalizer ───────────────────────────────────────────────────────────
function normalizeImageUrl(raw: string): string {
  try {
    const u = new URL(raw)
    // imgur.com/XXXXX  →  i.imgur.com/XXXXX.jpg
    if (u.hostname === 'imgur.com') {
      const parts = u.pathname.split('/').filter(Boolean)
      // Skip album/gallery links (e.g. /a/XXXXX, /gallery/XXXXX)
      if (parts.length === 1 && parts[0].length > 0) {
        return `https://i.imgur.com/${parts[0]}.jpg`
      }
    }
    // dropbox.com — force dl=1 for direct download
    if (u.hostname.includes('dropbox.com')) {
      u.searchParams.set('dl', '1')
      return u.toString()
    }
  } catch { /* invalid URL — fall through */ }
  return raw
}

// ─── Image Lightbox ───────────────────────────────────────────────────────────
function ImageLightbox({ url, sku, onClose }: { url: string; sku: string; onClose: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const resolvedUrl = normalizeImageUrl(url)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div className="relative w-full max-w-sm px-4" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-4 text-white text-3xl leading-none opacity-80 hover:opacity-100"
        >
          ×
        </button>
        <p className="text-white text-xs font-semibold text-center mb-3 opacity-60 uppercase tracking-wide break-all">
          {sku}
        </p>

        <div className="relative min-h-[200px] flex items-center justify-center">
          {/* Loading spinner */}
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="text-center px-4">
              <p className="text-white text-3xl mb-3">🖼️</p>
              <p className="text-white font-semibold text-sm mb-1">Image load nahi hui</p>
              <p className="text-white/50 text-xs mb-4">
                Direct image URL use karein<br/>
                (e.g. i.imgur.com/... ya imgbb.com/...)
              </p>
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 text-xs underline break-all"
              >
                URL dekhen →
              </a>
            </div>
          )}

          {/* The image (hidden while loading) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedUrl}
            alt={sku}
            onLoad={() => setStatus('ok')}
            onError={() => setStatus('error')}
            className={`w-full rounded-2xl object-contain max-h-[70vh] bg-white shadow-2xl transition-opacity duration-300 ${
              status === 'ok' ? 'opacity-100' : 'opacity-0 absolute'
            }`}
          />
        </div>
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
  isSelected,
  onToggleSelect,
  onOpenImage,
}: {
  item: PicklistItem
  shortUserId: string
  onUpdate: (sku: string, newPicked: number, newStatus: string) => void
  onOpenQtyModal: (item: PicklistItem) => void
  isSelected: boolean
  onToggleSelect: (sku: string) => void
  onOpenImage?: (item: PicklistItem) => void
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

  const isShortage = Boolean(item.shortage)

  const cardBg = isSelected
    ? 'bg-green-50 border-green-200'
    : isShortage
    ? 'bg-red-50 border-red-300'
    : isDone
    ? 'bg-green-50 border-green-300'
    : isUpdated
    ? 'bg-orange-50 border-orange-300'
    : 'bg-white border-gray-200'

  const accent = isDone ? 'bg-green-500' : isUpdated ? 'bg-orange-400' : 'bg-blue-500'

  return (
    <div className={`rounded-2xl border-2 p-4 shadow-sm transition-all ${cardBg} ${syncing ? 'opacity-80' : ''}`}>
      {isShortage && (
        <div className="mb-2 flex items-center gap-1.5 text-red-600 text-xs font-semibold bg-red-100 rounded-lg px-2 py-1.5">
          <span>⚠️</span>
          <span>Shortage reported — manager notified!</span>
        </div>
      )}
      {isUpdated && !isShortage && (
        <div className="mb-2 flex items-center gap-1.5 text-orange-600 text-xs font-semibold bg-orange-100 rounded-lg px-2 py-1.5">
          <span>🔔</span>
          <span>Quantity updated — please re-check!</span>
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {/* Multi-select checkbox */}
          <button
            onClick={() => { haptic(25); onToggleSelect(item.master_sku) }}
            className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all active:scale-90 ${
              isSelected
                ? 'bg-green-500 border-green-500'
                : 'bg-white border-gray-300'
            }`}
          >
            {isSelected && (
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <p className="font-bold text-gray-900 text-base leading-tight break-all">{item.master_sku}</p>
        </div>
        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
          {/* Gallery icon — only show if image_url exists */}
          {onOpenImage && (
            <button
              onClick={() => { haptic(20); onOpenImage(item) }}
              disabled={!item.image_url}
              title={item.image_url ? 'View product image' : 'No image available'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 ${
                item.image_url
                  ? 'text-blue-500 bg-blue-50 active:bg-blue-100'
                  : 'text-gray-300 cursor-default'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
              </svg>
            </button>
          )}
          {isDone && <span className="text-2xl">✅</span>}
          {syncing && (
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
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

// ─── Picker List Row ──────────────────────────────────────────────────────────
function PickerListRow({
  item,
  shortUserId,
  onUpdate,
  onOpenQtyModal,
  isSelected,
  onToggleSelect,
}: {
  item: PicklistItem
  shortUserId: string
  onUpdate: (sku: string, newPicked: number, newStatus: string) => void
  onOpenQtyModal: (item: PicklistItem) => void
  isSelected: boolean
  onToggleSelect: (sku: string) => void
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

  const increment = () => { if (item.picked_qty < item.total_qty && !syncing) sendPick(item.picked_qty + 1) }
  const decrement = () => { if (item.picked_qty > 0 && !syncing) sendPick(item.picked_qty - 1) }

  const isShortage = Boolean(item.shortage)

  const rowBg = isSelected
    ? 'bg-green-50 border-green-200'
    : isShortage
    ? 'bg-red-50 border-red-200'
    : isDone
    ? 'bg-green-50 border-green-200'
    : isUpdated
    ? 'bg-orange-50 border-orange-200'
    : 'bg-white border-gray-200'

  const accent = isDone ? 'text-green-600' : isUpdated ? 'text-orange-500' : 'text-gray-900'
  const btnAccent = isDone ? 'bg-green-500' : isUpdated ? 'bg-orange-400' : 'bg-blue-500'

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${rowBg} ${syncing ? 'opacity-70' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={() => { haptic(25); onToggleSelect(item.master_sku) }}
        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all active:scale-90 ${
          isSelected ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'
        }`}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* SKU name */}
      <button
        onClick={() => onOpenQtyModal(item)}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-sm font-semibold text-gray-900 break-all leading-tight">{item.master_sku}</p>
        {isShortage && <p className="text-xs text-red-500 font-medium">⚠️ Shortage reported</p>}
        {isUpdated && !isShortage && <p className="text-xs text-orange-500 font-medium">Qty updated — re-check</p>}
      </button>

      {/* Counter */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={() => onOpenQtyModal(item)} className="min-w-[44px] text-center">
          <span className={`text-base font-black ${accent}`}>{item.picked_qty}</span>
          <span className="text-gray-400 text-sm"> / {item.total_qty}</span>
        </button>

        <button
          onClick={increment}
          disabled={item.picked_qty >= item.total_qty || syncing}
          className={`w-8 h-8 rounded-lg text-white text-xl font-bold flex items-center justify-center disabled:opacity-30 active:scale-95 active:opacity-80 transition-transform ${btnAccent}`}
        >
          +
        </button>

        {isDone && <span className="text-base">✅</span>}
        {syncing && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
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
  const router = useRouter()

  const [authPin, setAuthPin] = useState<string | null>(null)
  const [correctPin, setCorrectPin] = useState<string | null>(null)
  const [items, setItems] = useState<PicklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [pinError, setPinError] = useState('')
  const [search, setSearch] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [lastPushedAt, setLastPushedAt] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [qtyModalItem, setQtyModalItem] = useState<PicklistItem | null>(null)
  const [imageItem, setImageItem] = useState<PicklistItem | null>(null)
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set())
  const [confirmingSku, setConfirmingSku] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCelebration, setShowCelebration] = useState(false)
  const celebratedRef = useRef(false)

  const openImageWithLog = useCallback((item: PicklistItem) => {
    setImageItem(item)
    if (item.image_url) {
      fetch('/api/picklist/image-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ short_user_id, master_sku: item.master_sku }),
      }).catch(() => {})
    }
  }, [short_user_id])

  const toggleSelectSku = (sku: string) => {
    setSelectedSkus(prev => {
      const next = new Set(prev)
      if (next.has(sku)) next.delete(sku)
      else next.add(sku)
      return next
    })
  }

  const selectAllPending = (pendingList: PicklistItem[]) => {
    const pendingSkus = pendingList.map(i => i.master_sku)
    setSelectedSkus(prev => {
      const next = new Set(prev)
      pendingSkus.forEach(s => next.add(s))
      return next
    })
    haptic(30)
  }

  const clearAllSelected = () => {
    setSelectedSkus(new Set())
    haptic(20)
  }

  const confirmSelected = async () => {
    if (selectedSkus.size === 0 || confirmingSku) return
    haptic([30, 20, 60])
    setConfirmingSku(true)
    const skusToConfirm = Array.from(selectedSkus)
    try {
      await Promise.all(
        skusToConfirm.map(async (sku) => {
          const item = items.find(i => i.master_sku === sku)
          if (!item) return
          const res = await fetch('/api/picklist/pick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              short_user_id,
              master_sku: sku,
              picked_qty: item.total_qty,
            }),
          })
          const json = await res.json()
          if (json.success) {
            handleItemUpdate(sku, json.picked_qty, json.status)
          }
        })
      )
      haptic([40, 30, 80])
      setSelectedSkus(new Set())
    } finally {
      setConfirmingSku(false)
    }
  }

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setSyncStatus('syncing')
    setIsSyncing(true)
    try {
      const res = await fetch(`/api/picklist/packer/${short_user_id}`)
      if (!res.ok) {
        if (res.status === 404) {
          router.replace('/')
          return
        }
        setPageError('Invalid packer link. Please ask your manager for the correct link.')
        setSyncStatus('offline')
        return
      }
      const json = await res.json()
      setCorrectPin(json.security_pin)
      setItems(json.items || [])
      setLastPushedAt(json.last_pushed_at ?? null)
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
        // Refresh last_pushed_at (and items as source-of-truth) silently
        loadData(true)
      })
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') setSyncStatus('online')
        else if (state === 'CLOSED' || state === 'CHANNEL_ERROR') setSyncStatus('offline')
      })
    return () => { supabase.removeChannel(channel) }
  }, [authPin, short_user_id])

  // Celebration trigger — fires once when all items are picked
  useEffect(() => {
    if (items.length === 0) return
    const allDone = items.every(i => i.status === 'picked')
    if (allDone && !celebratedRef.current) {
      celebratedRef.current = true
      setShowCelebration(true)
      haptic([40, 30, 40, 30, 100])
    }
    if (!allDone) {
      celebratedRef.current = false
    }
  }, [items])

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

  const handleShortageFromModal = useCallback(async (availableQty: number) => {
    if (!qtyModalItem) return
    const sku = qtyModalItem.master_sku
    const totalQty = qtyModalItem.total_qty
    const clearing = availableQty === -1

    // Optimistic update
    if (clearing) {
      setItems(prev => prev.map(i =>
        i.master_sku === sku ? { ...i, shortage: false, remaining_stock: 0 } : i
      ))
    } else if (availableQty >= totalQty) {
      // Excess stock — fulfill order, track remaining
      setItems(prev => prev.map(i =>
        i.master_sku === sku
          ? { ...i, shortage: false, picked_qty: totalQty, status: 'picked', remaining_stock: availableQty - totalQty }
          : i
      ))
    } else {
      // Genuine shortage
      setItems(prev => prev.map(i =>
        i.master_sku === sku
          ? { ...i, shortage: true, picked_qty: availableQty, status: 'pending', remaining_stock: 0 }
          : i
      ))
    }
    haptic(clearing ? 30 : availableQty >= totalQty ? [40, 30, 80] : [40, 30, 60])

    try {
      const res = await fetch('/api/picklist/shortage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          short_user_id,
          master_sku: sku,
          shortage: !clearing,
          available_qty: clearing ? 0 : availableQty,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setItems(prev => prev.map(i =>
          i.master_sku === sku
            ? {
                ...i,
                shortage: json.shortage ?? false,
                picked_qty: json.picked_qty ?? i.picked_qty,
                status: (json.status ?? i.status) as PicklistItem['status'],
                remaining_stock: json.remaining_stock ?? 0,
              }
            : i
        ))
        setLastUpdated(new Date())
      }
    } catch {
      // Rollback optimistic update
      setItems(prev => prev.map(i =>
        i.master_sku === sku ? { ...i, shortage: clearing, remaining_stock: 0 } : i
      ))
    }
  }, [qtyModalItem, short_user_id])

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

  const effectiveView = viewMode

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Celebration ── */}
      {showCelebration && (
        <CelebrationOverlay onDismiss={() => setShowCelebration(false)} />
      )}

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
                <p className="text-xs text-gray-400">Synced {formatTime(lastUpdated)}</p>
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

        {/* Search bar + Select All */}
        <div className="px-4 pb-3 flex items-center gap-2">
          {pending.length > 0 && (
            <button
              onClick={() =>
                pending.every(i => selectedSkus.has(i.master_sku))
                  ? clearAllSelected()
                  : selectAllPending(pending)
              }
              className={`flex-shrink-0 h-10 px-3 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                pending.every(i => selectedSkus.has(i.master_sku)) && selectedSkus.size > 0
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-gray-100 border-gray-200 text-blue-600'
              }`}
            >
              {pending.every(i => selectedSkus.has(i.master_sku)) && selectedSkus.size > 0
                ? '✓ All'
                : 'All'}
            </button>
          )}
          <div className="relative flex-1">
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

          {/* View toggle */}
          <div className="flex-shrink-0 flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                effectiveView === 'grid'
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                effectiveView === 'list'
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Last Push Time ── */}
      {lastPushedAt && items.length > 0 && (
        <div className="px-4 pt-2 pb-0.5">
          <p className="text-[11px] text-gray-500">
            <span className="text-blue-600">📦</span> Pushed: <span className="font-medium text-gray-700">{formatPushTime(lastPushedAt)}</span>
          </p>
        </div>
      )}

      {/* ── Item List ── */}
      <div className={`px-4 py-4 pb-28 ${effectiveView === 'list' ? 'space-y-1.5' : 'space-y-3'}`}>
        {filtered.length === 0 && search ? (
          <div className="text-center py-12">
            <p className="text-gray-500 font-medium">No SKU found for &ldquo;{search}&rdquo;</p>
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
            {pending.map(item => effectiveView === 'list' ? (
              <PickerListRow
                key={item.master_sku}
                item={item}
                shortUserId={short_user_id}
                onUpdate={handleItemUpdate}
                onOpenQtyModal={setQtyModalItem}
                isSelected={selectedSkus.has(item.master_sku)}
                onToggleSelect={toggleSelectSku}
              />
            ) : (
              <PickerCard
                key={item.master_sku}
                item={item}
                shortUserId={short_user_id}
                onUpdate={handleItemUpdate}
                onOpenQtyModal={setQtyModalItem}
                isSelected={selectedSkus.has(item.master_sku)}
                onToggleSelect={toggleSelectSku}
                onOpenImage={openImageWithLog}
              />
            ))}
            {done.length > 0 && (
              <>
                <div className="pt-2 pb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Completed ({done.length})
                  </p>
                </div>
                {done.map(item => effectiveView === 'list' ? (
                  <PickerListRow
                    key={item.master_sku}
                    item={item}
                    shortUserId={short_user_id}
                    onUpdate={handleItemUpdate}
                    onOpenQtyModal={setQtyModalItem}
                    isSelected={selectedSkus.has(item.master_sku)}
                    onToggleSelect={toggleSelectSku}
                  />
                ) : (
                  <PickerCard
                    key={item.master_sku}
                    item={item}
                    shortUserId={short_user_id}
                    onUpdate={handleItemUpdate}
                    onOpenQtyModal={setQtyModalItem}
                    isSelected={selectedSkus.has(item.master_sku)}
                    onToggleSelect={toggleSelectSku}
                    onOpenImage={openImageWithLog}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Confirm Selected Button ── */}
      {selectedSkus.size > 0 && (
        <div className="fixed bottom-6 left-5 z-30">
          <button
            onClick={confirmSelected}
            disabled={confirmingSku}
            className={`h-10 px-4 rounded-xl shadow-lg flex items-center gap-2 font-semibold text-white text-sm transition-all active:scale-95 ${
              confirmingSku ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 active:bg-green-700'
            }`}
          >
            {confirmingSku ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Confirming…</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Confirm {selectedSkus.size} picked</span>
              </>
            )}
          </button>
        </div>
      )}

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
          onShortage={handleShortageFromModal}
        />
      )}

      {/* ── Image Lightbox ── */}
      {imageItem?.image_url && (
        <ImageLightbox
          url={imageItem.image_url}
          sku={imageItem.master_sku}
          onClose={() => setImageItem(null)}
        />
      )}
    </div>
  )
}
