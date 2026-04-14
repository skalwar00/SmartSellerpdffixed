'use client'

import { useEffect, useRef, useState } from 'react'
import { DashboardHeader } from '@/components/dashboard/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { toast } from 'sonner'
import { AlertTriangle, Download, Loader2, PackageCheck, Scissors, Send, UploadCloud } from 'lucide-react'
import Link from 'next/link'

type PortalKey = 'flipkart' | 'meesho'

type LabelInfo = {
  page: number
  sku: string
  shortSku: string
  qty: number
  portal: string
}

type SummaryRow = {
  shortSku: string
  qty: number
  pages: number[]
}

type CropResult = {
  portal: string
  fileName: string
  pdfBase64: string
  labels: LabelInfo[]
  summary: SummaryRow[]
  totalLabels: number
  totalSkuItems?: number
  dimensions: string
}

const PORTAL_CONFIG: Record<PortalKey, { label: string; description: string }> = {
  flipkart: { label: 'Flipkart', description: 'Red-line shipping label crop' },
  meesho: { label: 'Meesho', description: 'Auto-detect label area per page' },
}

function base64ToBlob(base64: string, type: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function LabelCropperPage() {
  const [files, setFiles] = useState<File[]>([])
  const [selectedPortal, setSelectedPortal] = useState<PortalKey>('flipkart')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isPushed, setIsPushed] = useState(false)
  const [result, setResult] = useState<CropResult | null>(null)
  const [unmappedSkus, setUnmappedSkus] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const PROGRESS_STAGES = [
    { label: 'Uploading PDF…', target: 15 },
    { label: 'Parsing pages…', target: 40 },
    { label: 'Cropping labels…', target: 70 },
    { label: 'Sorting by SKU…', target: 90 },
  ]

  const startProgress = () => {
    setProgress(0)
    let current = 0
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        // slow down as it approaches 92 — never auto-complete
        const increment = prev < 30 ? 2 : prev < 60 ? 1.2 : prev < 85 ? 0.6 : 0.2
        current = Math.min(92, prev + increment)
        return current
      })
    }, 300)
  }

  const finishProgress = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    setProgress(100)
    setTimeout(() => setProgress(0), 800)
  }

  useEffect(() => () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current) }, [])

  const handlePortalSelect = (portal: PortalKey) => {
    setSelectedPortal(portal)
    setResult(null)
    setIsPushed(false)
    setUnmappedSkus([])
  }

  const handleProcess = async () => {
    const file = files[0]
    if (!file) {
      toast.error('Please upload a label PDF first')
      return
    }

    setIsProcessing(true)
    setResult(null)
    setIsPushed(false)
    startProgress()

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('portal', selectedPortal)

      const response = await fetch('/api/label-crop', { method: 'POST', body: formData })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Label crop failed')

      finishProgress()
      setResult(data)
      toast.success(`${data.totalLabels} labels cropped — ${data.totalSkuItems ?? data.labels?.length ?? 0} SKU items found`)
    } catch (error) {
      finishProgress()
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Failed to crop labels')
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadPdf = () => {
    if (!result) return
    downloadBlob(base64ToBlob(result.pdfBase64, 'application/pdf'), result.fileName)
  }

  const pushToPicklist = async () => {
    if (!result || result.labels.length === 0) {
      toast.error('Please crop labels before pushing to picklist')
      return
    }

    setIsPushing(true)
    try {
      const response = await fetch('/api/picklist/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalItems: result.labels.map((label) => ({
            portal_sku: label.sku,
            qty: label.qty ?? 1,
          })),
        }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Picklist push failed')
      setIsPushed(true)
      const newUnmapped: string[] = data.unmappedSkus || []
      setUnmappedSkus(newUnmapped)
      if (newUnmapped.length > 0) {
        toast.warning(`${data.pushed} SKUs pushed — ${newUnmapped.length} SKU${newUnmapped.length > 1 ? 's' : ''} unmapped`)
      } else {
        toast.success(`${data.pushed} SKUs pushed to live picklist`)
      }
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Failed to push to picklist')
    } finally {
      setIsPushing(false)
    }
  }

  const totalQty = result
    ? result.labels.reduce((sum, label) => sum + (label.qty ?? 1), 0)
    : 0

  const portalConfig = PORTAL_CONFIG[selectedPortal]

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <DashboardHeader
        title="Label Cropper"
        description="Upload a label PDF to crop shipping labels and push SKUs to the live picklist."
      />

      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

          {/* Upload Card */}
          <Card className="overflow-hidden border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Upload Label PDF</CardTitle>
                  <CardDescription>Select a portal, then upload the label PDF to crop and sort.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Portal Selector */}
              <div className="grid gap-3 sm:grid-cols-3">
                {(Object.entries(PORTAL_CONFIG) as [PortalKey, { label: string; description: string }][]).map(([key, cfg]) => {
                  const isActive = selectedPortal === key
                  return (
                    <button
                      key={key}
                      onClick={() => handlePortalSelect(key)}
                      className={`rounded-xl border p-4 text-left transition-all focus:outline-none ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">{cfg.label}</p>
                        {isActive && (
                          <Badge className="bg-blue-600 text-white hover:bg-blue-600">Active</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{cfg.description}</p>
                    </button>
                  )
                })}

                {/* Myntra — coming soon */}
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-left opacity-50">
                  <p className="font-semibold text-gray-600">Myntra</p>
                  <p className="mt-1 text-xs text-gray-400">Coming soon</p>
                </div>
              </div>

              <FileDropzone
                accept="application/pdf,.pdf"
                files={files}
                onFilesChange={(newFiles) => {
                  setFiles(newFiles)
                  setResult(null)
                  setIsPushed(false)
                  setUnmappedSkus([])
                }}
                disabled={isProcessing}
                label={`Drop ${portalConfig.label} label PDF here or click to browse`}
                hint="Shipping labels will be cropped from each page and sorted by SKU"
              />

              <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-900">{portalConfig.label} — {portalConfig.description}</p>
                  <p className="text-xs text-blue-700">
                    {selectedPortal === 'flipkart'
                      ? 'Invoice pages removed. Labels sorted by SKU in the output PDF.'
                      : 'Each page cropped to extract the shipping label. Labels sorted by SKU.'}
                  </p>
                </div>
                <Button
                  onClick={handleProcess}
                  disabled={!files[0] || isProcessing}
                  className="shrink-0 bg-blue-600 hover:bg-blue-700"
                >
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scissors className="mr-2 h-4 w-4" />}
                  Crop Labels
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Output Card */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageCheck className="h-5 w-5 text-green-600" />
                Output
              </CardTitle>
              <CardDescription>Download the cropped PDF or push SKUs to the live picklist.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Labels Cropped</p>
                      <p className="text-2xl font-bold text-gray-900">{result.totalLabels}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Total Qty</p>
                      <p className="text-2xl font-bold text-gray-900">{totalQty}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-white p-3 text-sm">
                    <p className="font-medium text-gray-900">{result.portal}</p>
                    <p className="text-gray-500">Crop size: {result.dimensions}</p>
                  </div>

                  <div className="space-y-2">
                    <Button onClick={downloadPdf} className="w-full bg-green-600 hover:bg-green-700">
                      <Download className="mr-2 h-4 w-4" />
                      Download Cropped PDF
                    </Button>
                    <Button
                      onClick={pushToPicklist}
                      disabled={isPushing || isPushed}
                      className={`w-full ${isPushed ? 'cursor-not-allowed bg-green-600 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {isPushing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : isPushed ? (
                        <PackageCheck className="mr-2 h-4 w-4" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {isPushed ? 'Pushed to Picklist ✓' : 'Push to Live Picklist'}
                    </Button>
                  </div>

                  {isPushed && unmappedSkus.length === 0 && (
                    <p className="text-center text-xs text-gray-500">
                      To push again, re-process the PDF.
                    </p>
                  )}

                  {isPushed && unmappedSkus.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <div className="flex-1 text-sm">
                          <p className="font-semibold text-amber-800">
                            {unmappedSkus.length} SKU{unmappedSkus.length > 1 ? 's' : ''} unmapped
                          </p>
                          <p className="mt-0.5 text-xs text-amber-700">
                            Inhe Dashboard pe map karo taaki agle baar automatically match ho.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {unmappedSkus.map(sku => (
                              <span key={sku} className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs text-amber-900">
                                {sku}
                              </span>
                            ))}
                          </div>
                          <Link
                            href="/dashboard"
                            className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                          >
                            Dashboard pe Map Karo →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : isProcessing ? (
                <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/60 p-5">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">
                        {progress < 15
                          ? 'Uploading PDF…'
                          : progress < 45
                          ? 'Parsing pages…'
                          : progress < 75
                          ? 'Cropping labels…'
                          : progress < 100
                          ? 'Sorting by SKU…'
                          : 'Done!'}
                      </p>
                      <p className="text-xs text-blue-700">This may take 10–30 seconds for large files</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-blue-700">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-blue-200">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-blue-400">
                    {['Upload', 'Parse', 'Crop', 'Sort'].map((stage, i) => (
                      <span key={stage} className={progress >= i * 25 + 1 ? 'font-semibold text-blue-600' : ''}>
                        {stage}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed py-10 text-center text-sm text-gray-400">
                  Output will appear here after processing.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* How it works guide */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-gray-700">How it works</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { step: '1', icon: '🗂️', title: 'Select Portal', desc: 'Choose Flipkart or Meesho based on your label PDF.' },
              { step: '2', icon: '📤', title: 'Upload PDF', desc: 'Drop your label PDF (any number of pages).' },
              { step: '3', icon: '✂️', title: 'Crop & Sort', desc: 'Click "Crop Labels" — labels are cropped and sorted by SKU automatically.' },
              { step: '4', icon: '📥', title: 'Download / Push', desc: 'Download the sorted PDF or push SKUs directly to your live picklist.' },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                  {step}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{icon} {title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
            💡 <strong>Tip:</strong> Flipkart labels remove invoice pages automatically. Meesho labels are detected per-page. Output PDF is sorted by SKU so picking is faster.
          </p>
        </div>

      </div>
    </div>
  )
}
