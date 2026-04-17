import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight, PackageCheck, AlertTriangle, Archive, Smartphone, RefreshCw, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookDemoButton } from '@/components/book-demo-button'

export default async function LandingPage() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()
    if (!error && data.user) redirect('/dashboard')
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('NEXT_REDIRECT') || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))
    ) {
      throw err
    }
  }

  return (
    <div className="min-h-screen bg-background">

      {/* ── Mobile floating Book Demo button ── */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 sm:hidden">
        <BookDemoButton
          variant="default"
          size="sm"
          label="Book Demo"
          className="rounded-l-xl rounded-r-none shadow-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-5 text-xs font-semibold [writing-mode:vertical-rl] rotate-180 h-auto"
        />
      </div>

      {/* ── Navigation ── */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="SSP Logo" className="h-8 w-8 flex-shrink-0 object-contain sm:h-10 sm:w-10" />
            <span className="truncate text-base font-bold sm:text-lg">
              <span className="hidden sm:inline">SmartSellerPick</span>
              <span className="sm:hidden">SSP</span>
            </span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">How it works</Link>
            <Link href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Features</Link>
            <Link href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Pricing</Link>
          </nav>
          <div className="flex items-center gap-2">
            <BookDemoButton variant="outline" size="sm" className="hidden sm:flex border-blue-500 text-blue-600 hover:bg-blue-50" />
            <Button variant="ghost" size="sm" asChild><Link href="/auth/login">Log in</Link></Button>
            <Button size="sm" asChild>
              <Link href="/auth/sign-up">
                <span className="hidden sm:inline">Get Started</span>
                <span className="sm:hidden">Sign up</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b bg-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.06),transparent_60%)]" />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-7">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700">
                Flipkart · Myntra · Meesho
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-balance text-slate-900 sm:text-5xl">
                One dashboard for all your e-commerce portals
              </h1>
              <ul className="flex flex-col gap-4">
                <li className="flex items-start gap-3">
                  <span className="text-xl leading-tight flex-shrink-0 mt-0.5">⚡</span>
                  <div>
                    <span className="font-bold text-slate-900">Zero-Manual Effort: </span>
                    <span className="text-slate-600">No more downloading 3 different CSVs and merging them.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-xl leading-tight flex-shrink-0 mt-0.5">🔍</span>
                  <div>
                    <span className="font-bold text-slate-900">Shortage Radar: </span>
                    <span className="text-slate-600">See exactly what&apos;s missing before the packing even starts.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-xl leading-tight flex-shrink-0 mt-0.5">🛡️</span>
                  <div>
                    <span className="font-bold text-slate-900">Penalty Shield: </span>
                    <span className="text-slate-600">Eliminate wrong-product dispatches that lead to buyer returns and bad ratings.</span>
                  </div>
                </li>
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="bg-blue-900 hover:bg-blue-800 text-white shadow-lg" asChild>
                  <Link href="/auth/sign-up">Start 14-day free trial <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button size="lg" variant="outline" className="border-blue-900 text-blue-900 hover:bg-blue-50" asChild>
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>
            </div>

            {/* Hero visual — dashboard snapshot */}
            <div className="rounded-2xl border bg-card p-5 shadow-xl">
              <div className="mb-3 flex items-center justify-between border-b pb-3">
                <span className="text-sm font-semibold">Today&apos;s Picklist</span>
                <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                  Live
                </span>
              </div>
              <div className="space-y-2">
                {[
                  { sku: 'KURTA-BLU-M', platform: 'FK', qty: 3, status: 'picked' },
                  { sku: 'PALAZZO-BLK-L', platform: 'MY', qty: 2, status: 'picked' },
                  { sku: 'DUPATTA-RED-FS', platform: 'ME', qty: 5, status: 'pending' },
                  { sku: 'TOP-WHT-S', platform: 'FK', qty: 1, status: 'pending' },
                  { sku: 'LEHENGA-GRN-M', platform: 'MY', qty: 2, status: 'pending' },
                ].map((item) => (
                  <div key={item.sku} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${item.status === 'picked' ? 'border-green-200 bg-green-50' : 'bg-muted/30'}`}>
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                      item.platform === 'FK' ? 'bg-yellow-100 text-yellow-800' :
                      item.platform === 'MY' ? 'bg-pink-100 text-pink-700' : 'bg-fuchsia-100 text-fuchsia-700'
                    }`}>{item.platform}</span>
                    <span className="flex-1 font-medium text-xs truncate">{item.sku}</span>
                    <span className="text-xs text-muted-foreground">×{item.qty}</span>
                    <span className={`text-xs font-semibold ${item.status === 'picked' ? 'text-green-600' : 'text-orange-500'}`}>
                      {item.status === 'picked' ? '✅' : '⏳'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>2/5 picked</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                    <div className="h-2 w-[40%] rounded-full bg-green-500" />
                  </div>
                  <span>40%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform badges ── */}
      <section className="border-b bg-muted/20 py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Works with</span>
            {[
              { name: 'Flipkart', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', letter: 'F' },
              { name: 'Myntra',   color: 'bg-pink-100 text-pink-700 border-pink-200',       letter: 'M' },
              { name: 'Meesho',   color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200', letter: 'M' },
            ].map(p => (
              <div key={p.name} className={`flex items-center gap-2 rounded-full border px-4 py-2 font-semibold text-sm ${p.color}`}>
                <span className="text-base font-black">{p.letter}</span>
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Packer — Grid View ── */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 text-white overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-500/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                </span>
                Live Packer System
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Send orders. Packer picks.<br className="hidden sm:block" />
                <span className="text-blue-300"> No app install needed.</span>
              </h2>
              <p className="text-base leading-relaxed text-blue-100/80 sm:text-lg">
                Push a live picklist to your packer with one click. They open it in a mobile browser — no download, no login required. Every pick syncs instantly to your dashboard in real time.
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  [Smartphone,  'Packer only needs a link — no app installation'],
                  [RefreshCw,   'Real-time sync — updates appear on your dashboard instantly'],
                  [PackageCheck,'Product images visible directly in the picklist'],
                  [Lock,        'PIN-protected — only your team can access'],
                ].map(([Icon, text], i) => (
                  <li key={i} className="flex items-start gap-3">
                    {/* @ts-expect-error Icon is a valid component */}
                    <Icon className="h-5 w-5 text-blue-300 flex-shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed text-blue-100/90">{text as string}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                <Link href="/auth/sign-up" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-blue-900 shadow-lg transition hover:bg-blue-50 active:scale-95">
                  Try it free <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Packer Grid Mockup */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-[300px]">
                {/* Phone frame */}
                <div className="rounded-[2.5rem] border-4 border-white/20 bg-gray-900 p-2 shadow-2xl">
                  <div className="rounded-[2rem] bg-gray-50 overflow-hidden">
                    {/* Status bar */}
                    <div className="flex items-center justify-between bg-white px-4 py-2.5 text-[10px] font-semibold text-gray-500 border-b border-gray-100">
                      <span className="font-bold text-gray-800">Packer View</span>
                      <span className="flex items-center gap-1 text-green-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                        Live
                      </span>
                    </div>
                    {/* Grid layout */}
                    <div className="grid grid-cols-2 gap-1.5 p-2 bg-gray-100">
                      {[
                        { sku: 'KURTA-BLU-M', picked: 3, total: 3, done: true, shortage: false },
                        { sku: 'PALAZZO-BLK', picked: 2, total: 2, done: true, shortage: false },
                        { sku: 'DUPATTA-RED',  picked: 1, total: 5, done: false, shortage: true  },
                        { sku: 'TOP-WHT-S',   picked: 0, total: 1, done: false, shortage: false },
                      ].map(item => (
                        <div
                          key={item.sku}
                          className={`rounded-2xl border-2 p-3 flex flex-col gap-2 ${
                            item.shortage
                              ? 'bg-red-50 border-red-300'
                              : item.done
                              ? 'bg-green-50 border-green-300'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          {item.shortage && (
                            <span className="text-[9px] font-bold text-red-600 bg-red-100 rounded px-1 py-0.5">⚠ Shortage</span>
                          )}
                          <p className="text-[10px] font-bold text-gray-900 leading-tight break-all">{item.sku}</p>
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div
                              className={`h-1 rounded-full ${item.shortage ? 'bg-red-400' : item.done ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.round((item.picked / item.total) * 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-black ${item.done ? 'text-green-600' : item.shortage ? 'text-red-600' : 'text-gray-800'}`}>
                              {item.picked}
                            </span>
                            <span className="text-[10px] text-gray-400">/{item.total}</span>
                            {item.done
                              ? <span className="text-sm">✅</span>
                              : (
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-black ${item.shortage ? 'bg-red-400' : 'bg-blue-500'}`}>
                                  +
                                </span>
                              )
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Footer */}
                    <div className="bg-white border-t border-gray-100 px-3 py-2 text-center text-[9px] text-gray-400">
                      2 of 4 picked · syncing…
                    </div>
                  </div>
                </div>
                {/* Callout badges */}
                <div className="relative mt-0">
                  <div className="absolute -right-4 -top-32 rounded-xl bg-green-500 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-lg">✅ Picked!</div>
                  <div className="absolute -left-4 -top-16 rounded-xl bg-red-500 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-lg">⚠ Shortage!</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">How It Works</h2>
            <p className="mt-4 text-base text-muted-foreground">From order upload to fully packed — just 4 steps</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

            {/* Step 1 */}
            <div className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white shadow">1</div>
              <div className="mb-3 text-3xl">📂</div>
              <h3 className="mb-2 text-base font-bold">Upload Orders</h3>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">Import CSV or Excel files from all three portals at once</p>
              <div className="mt-auto rounded-xl bg-blue-50 p-3 space-y-1.5 text-xs">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0" /><span className="text-gray-600 truncate">flipkart_orders.xlsx</span><span className="ml-auto text-green-600 font-semibold">✓</span></div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-pink-500 flex-shrink-0" /><span className="text-gray-600 truncate">myntra_report.csv</span><span className="ml-auto text-green-600 font-semibold">✓</span></div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-fuchsia-500 flex-shrink-0" /><span className="text-gray-600 truncate">meesho_orders.xlsx</span><span className="ml-auto text-green-600 font-semibold">✓</span></div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-sm font-black text-white shadow">2</div>
              <div className="mb-3 text-3xl">⚡</div>
              <h3 className="mb-2 text-base font-bold">Auto SKU Map & Push</h3>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">Portal SKU auto-maps to your Master SKU. Push live picklist in one click</p>
              <div className="mt-auto rounded-xl bg-violet-50 p-3 text-xs space-y-2">
                <div className="flex justify-between"><span className="text-gray-500">Mapped</span><span className="font-bold text-violet-700">24/24 ✓</span></div>
                <div className="h-2 w-full rounded-full bg-violet-100"><div className="h-2 w-full rounded-full bg-violet-500" /></div>
                <div className="flex justify-center pt-1"><span className="rounded-lg bg-violet-600 px-3 py-1 font-semibold text-white">Push to Packer →</span></div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-sm font-black text-white shadow">3</div>
              <div className="mb-3 text-3xl">📱</div>
              <h3 className="mb-2 text-base font-bold">Packer Mobile View</h3>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">Share a link — no app, no login. Packer picks items and reports stock status</p>
              <div className="mt-auto rounded-xl bg-green-50 p-3 text-xs space-y-1.5">
                {[{sku:'KURTA-BLU-M',p:3,t:3,done:true},{sku:'PALAZZO-BLK',p:1,t:2,done:false}].map(item=>(
                  <div key={item.sku} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${item.done?'border-green-200 bg-green-100':'bg-white border-gray-200'}`}>
                    <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${item.done?'bg-green-500':'bg-gray-300'}`} />
                    <span className="flex-1 truncate text-gray-700">{item.sku}</span>
                    <span className={`font-bold ${item.done?'text-green-700':'text-blue-600'}`}>{item.p}/{item.t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col rounded-2xl border-2 border-orange-200 bg-card p-6 shadow-sm">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-sm font-black text-white shadow">4</div>
              <div className="mb-3 text-3xl">📊</div>
              <h3 className="mb-2 text-base font-bold">Live Status Dashboard</h3>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">See what&apos;s packed and what&apos;s pending in real time — no refresh needed</p>
              <div className="mt-auto rounded-xl bg-orange-50 p-3 text-xs space-y-2">
                <div className="flex justify-between"><span>Picked ✅</span><span className="font-bold text-green-700">18</span></div>
                <div className="flex justify-between"><span>Pending ⏳</span><span className="font-bold text-orange-600">6</span></div>
                <div className="h-2 w-full rounded-full bg-orange-100"><div className="h-2 rounded-full bg-green-500" style={{width:'75%'}} /></div>
                <div className="flex items-center gap-1.5 text-[10px] text-orange-600 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block animate-pulse" />Live updating
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 hidden lg:flex items-center justify-center gap-2 text-sm">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700 font-medium text-xs">Upload</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700 font-medium text-xs">Map & Push</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="rounded-full bg-green-100 px-3 py-1 text-green-700 font-medium text-xs">Pack on Mobile</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700 font-medium text-xs">Track Live</span>
          </div>
        </div>
      </section>

      {/* ── Smart Stock Management (Shortage + Remaining Qty) ── */}
      <section className="border-t border-b bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 border border-orange-200 px-4 py-1.5 text-xs font-semibold text-orange-700 mb-4">
              ✨ New Feature
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">Smart Stock Management</h2>
            <p className="mt-4 text-base text-muted-foreground">
              Your packer now reports actual warehouse stock. Shortages are flagged instantly. Extra stock is tracked automatically.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">

            {/* Shortage reporting */}
            <div className="rounded-2xl border-2 border-red-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Shortage Reporting</h3>
                  <p className="text-xs text-muted-foreground">Packer enters actual available stock</p>
                </div>
              </div>
              <p className="mb-5 text-sm text-muted-foreground leading-relaxed">
                When the packer finds less stock than required, they enter the actual quantity available. The system immediately flags the shortage and notifies the manager — no manual follow-up needed.
              </p>
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Example — Packer flow</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 rounded-lg bg-white border border-gray-200 px-3 py-2 text-xs">
                    <p className="text-gray-500">Needed qty</p>
                    <p className="text-2xl font-black text-gray-900">5</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 rounded-lg bg-white border border-red-200 px-3 py-2 text-xs">
                    <p className="text-red-500">Available stock</p>
                    <p className="text-2xl font-black text-red-600">2</p>
                  </div>
                </div>
                <div className="rounded-lg bg-red-100 px-3 py-2.5 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-red-700">3 units short — manager notified automatically</p>
                </div>
              </div>
            </div>

            {/* Remaining qty tracking */}
            <div className="rounded-2xl border-2 border-green-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
                  <Archive className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Remaining Stock Tracking</h3>
                  <p className="text-xs text-muted-foreground">Extra stock saved to inventory automatically</p>
                </div>
              </div>
              <p className="mb-5 text-sm text-muted-foreground leading-relaxed">
                When the packer has more stock than the order requires, the extra units are automatically logged as remaining inventory. This keeps your stock count accurate without any extra data entry.
              </p>
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Example — Packer flow</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 rounded-lg bg-white border border-gray-200 px-3 py-2 text-xs">
                    <p className="text-gray-500">Needed qty</p>
                    <p className="text-2xl font-black text-gray-900">3</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 rounded-lg bg-white border border-green-200 px-3 py-2 text-xs">
                    <p className="text-green-600">Available stock</p>
                    <p className="text-2xl font-black text-green-700">7</p>
                  </div>
                </div>
                <div className="rounded-lg bg-green-100 px-3 py-2.5 flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-green-700 flex-shrink-0" />
                  <p className="text-xs font-semibold text-green-800">Order fulfilled + 4 units saved to remaining stock</p>
                </div>
              </div>
            </div>
          </div>

          {/* Combined benefit banner */}
          <div className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 px-6 py-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <span className="text-4xl">📦</span>
            <div className="flex-1">
              <p className="font-bold text-gray-900">Zero stock guesswork</p>
              <p className="text-sm text-muted-foreground mt-1">
                Shortage alerts go straight to the manager. Remaining stock is logged. Your team always knows exactly what&apos;s in the warehouse.
              </p>
            </div>
            <Button size="sm" asChild className="flex-shrink-0">
              <Link href="/auth/sign-up">Try for free</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Features deep-dive ── */}
      <section id="features" className="border-t bg-muted/20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">Everything you need</h2>
            <p className="mt-4 text-base text-muted-foreground">Every feature built specifically for Indian e-commerce sellers</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">

            {/* Feature A — SKU Mapping */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-2xl">🔗</span>
                <div>
                  <h3 className="font-bold">Smart SKU Mapping</h3>
                  <p className="text-xs text-muted-foreground">Portal code → your Master SKU</p>
                </div>
              </div>
              <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                Flipkart FSN, Myntra Style ID, or Meesho Sub-SKU — the system automatically matches portal codes to your master inventory.
              </p>
              <div className="rounded-xl bg-muted/50 p-3 text-xs font-mono">
                <div className="mb-1.5 grid grid-cols-3 font-semibold text-muted-foreground not-italic text-[10px] uppercase tracking-wide">
                  <span>Portal SKU</span><span className="text-center">→</span><span>Master SKU</span>
                </div>
                {[
                  ['FK-8839201-BLU', 'KURTA-BLU-M'],
                  ['MY-STY-4421-L',  'PALAZZO-BLK-L'],
                  ['ME-9912-RED',    'DUPATTA-RED-FS'],
                ].map(([portal, master]) => (
                  <div key={portal} className="grid grid-cols-3 items-center gap-1 py-1 border-t border-muted">
                    <span className="text-orange-600 truncate">{portal}</span>
                    <span className="text-center text-green-600 font-bold">✓</span>
                    <span className="text-blue-700 truncate">{master}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature B — Profit Analytics */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-2xl">📈</span>
                <div>
                  <h3 className="font-bold">Profit Analytics</h3>
                  <p className="text-xs text-muted-foreground">Net profit, margin, platform-wise breakdown</p>
                </div>
              </div>
              <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                Net profit is calculated for every order — platform commission, shipping, and return costs all deducted automatically.
              </p>
              <div className="rounded-xl bg-muted/50 p-3 text-xs space-y-2">
                {[
                  { platform: 'Flipkart', revenue: '₹1,24,000', profit: '₹28,400', margin: '22.9%', color: 'bg-yellow-400' },
                  { platform: 'Myntra',   revenue: '₹89,500',   profit: '₹19,200', margin: '21.5%', color: 'bg-pink-400' },
                  { platform: 'Meesho',   revenue: '₹54,200',   profit: '₹8,600',  margin: '15.9%', color: 'bg-fuchsia-400' },
                ].map(row => (
                  <div key={row.platform} className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${row.color}`} />
                    <span className="w-14 font-semibold text-gray-700">{row.platform}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-2 rounded-full ${row.color}`} style={{width: row.platform==='Flipkart'?'75%':row.platform==='Myntra'?'54%':'33%'}} />
                    </div>
                    <span className="text-green-700 font-bold w-12 text-right">{row.margin}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between text-muted-foreground">
                  <span>Total Revenue</span><span className="font-bold text-foreground">₹2,67,700</span>
                </div>
              </div>
            </div>

            {/* Feature C — Costing */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-2xl">🧮</span>
                <div>
                  <h3 className="font-bold">Design-Level Costing</h3>
                  <p className="text-xs text-muted-foreground">Accurate cost breakdown per SKU</p>
                </div>
              </div>
              <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                Enter fabric, stitching, and packaging costs per design. Know your exact profit on each SKU without any spreadsheets.
              </p>
              <div className="rounded-xl bg-muted/50 p-3 text-xs space-y-1.5">
                <div className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-2">KURTA-BLU-M — Cost Breakdown</div>
                {[
                  ['Fabric cost', '₹180'],
                  ['Stitching', '₹60'],
                  ['Packaging', '₹25'],
                  ['Other', '₹15'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between border-t border-muted pt-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">{val}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t-2 border-foreground/20 pt-1.5 font-bold">
                  <span>Total COGS</span><span className="text-orange-600">₹280</span>
                </div>
                <div className="flex justify-between font-bold text-green-700">
                  <span>Net Profit @ ₹549 MRP</span><span>₹183</span>
                </div>
              </div>
            </div>

            {/* Feature D — Return Analysis */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-2xl">↩️</span>
                <div>
                  <h3 className="font-bold">Return & RTO Analysis</h3>
                  <p className="text-xs text-muted-foreground">Understand why returns are happening</p>
                </div>
              </div>
              <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                Track customer returns and RTOs by category. Instantly see which SKUs have the highest return rate.
              </p>
              <div className="rounded-xl bg-muted/50 p-3 text-xs space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Total Returns', val: '47', color: 'text-red-600' },
                    { label: 'RTO', val: '31', color: 'text-orange-600' },
                    { label: 'Customer', val: '16', color: 'text-yellow-600' },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-background border p-2 text-center">
                      <div className={`text-lg font-black ${s.color}`}>{s.val}</div>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mt-1">Top return SKUs</div>
                {[['KURTA-BLU-M','8 returns'],['PALAZZO-BLK-L','5 returns']].map(([sku,count])=>(
                  <div key={sku} className="flex items-center justify-between border-t border-muted pt-1">
                    <span className="text-gray-700">{sku}</span>
                    <span className="font-semibold text-red-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">Simple pricing</h2>
            <p className="mt-4 text-base text-muted-foreground">14-day free trial — no credit card required</p>
          </div>
          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <h3 className="font-semibold">1 Month</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold">₹3,000</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Standard rate</p>
              <ul className="mt-5 space-y-2.5">
                {['Unlimited orders','All 3 platforms','Live picklist','Profit analytics','SKU mapping'].map(f=>(
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <span className="text-green-600 font-bold flex-shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Button className="mt-7 w-full" variant="outline" size="lg" asChild>
                <Link href="/auth/sign-up">Start free trial</Link>
              </Button>
            </div>

            <div className="relative rounded-2xl border-2 border-primary bg-card p-6 shadow-md">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Most Popular</div>
              <h3 className="font-semibold">3 Months</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold">₹7,000</span>
                <span className="text-sm text-muted-foreground">/3 months</span>
              </div>
              <p className="mt-1 text-xs text-green-600 font-medium">Save ₹2,000 vs monthly</p>
              <ul className="mt-5 space-y-2.5">
                {['Unlimited orders','All 3 platforms','Live picklist','Profit analytics','SKU mapping'].map(f=>(
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <span className="text-green-600 font-bold flex-shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Button className="mt-7 w-full" size="lg" asChild>
                <Link href="/auth/sign-up">Start free trial</Link>
              </Button>
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <h3 className="font-semibold">Yearly</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold">₹18,000</span>
                <span className="text-sm text-muted-foreground">/year</span>
              </div>
              <p className="mt-1 text-xs text-green-600 font-medium">Save ₹18,000 vs monthly</p>
              <ul className="mt-5 space-y-2.5">
                {['Unlimited orders','All 3 platforms','Live picklist','Profit analytics','SKU mapping'].map(f=>(
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <span className="text-green-600 font-bold flex-shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Button className="mt-7 w-full" variant="outline" size="lg" asChild>
                <Link href="/auth/sign-up">Start free trial</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t bg-primary py-14">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Streamline your warehouse starting today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-primary-foreground/80 sm:text-lg">
            14-day free trial — no credit card, no commitment.
          </p>
          <Button size="lg" variant="secondary" className="mt-7" asChild>
            <Link href="/auth/sign-up">Get started for free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="SSP Logo" className="h-7 w-7 object-contain" />
            <span className="font-semibold">SmartSellerPick</span>
          </div>
          <p className="text-sm text-muted-foreground">Built for Indian e-commerce sellers</p>
        </div>
      </footer>

    </div>
  )
}
