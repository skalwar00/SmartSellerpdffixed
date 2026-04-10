import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { 
  BarChart3, 
  Package, 
  TrendingUp, 
  FileSpreadsheet, 
  Zap, 
  Shield,
  ArrowRight,
  CheckCircle2
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold">SmartSeller Suite</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Features
            </Link>
            <Link href="#platforms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Platforms
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                The complete platform for e-commerce sellers
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-muted-foreground text-pretty">
                Manage SKUs, generate picklists, and analyze profits across Flipkart, Myntra & Meesho. 
                All in one powerful dashboard.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild>
                  <Link href="/auth/sign-up">
                    Start free trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="#features">Learn more</Link>
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-xl border bg-card p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between border-b pb-4">
                  <span className="text-sm font-medium">Today&apos;s Performance</span>
                  <span className="text-xs text-muted-foreground">Live</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-2xl font-bold">12,847</p>
                    <p className="text-sm text-muted-foreground">Orders Processed</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-2xl font-bold">23.4%</p>
                    <p className="text-sm text-muted-foreground">Profit Margin</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-2xl font-bold">1,234</p>
                    <p className="text-sm text-muted-foreground">SKUs Mapped</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-2xl font-bold">98.5%</p>
                    <p className="text-sm text-muted-foreground">Accuracy Rate</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div className="text-center">
            <p className="text-3xl font-bold">5hrs</p>
            <p className="mt-1 text-sm text-muted-foreground">saved daily on average</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">99%</p>
            <p className="mt-1 text-sm text-muted-foreground">SKU mapping accuracy</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">3x</p>
            <p className="mt-1 text-sm text-muted-foreground">faster order processing</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">10K+</p>
            <p className="mt-1 text-sm text-muted-foreground">sellers trust us</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to scale your business
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Powerful tools designed specifically for Indian e-commerce sellers
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Package className="h-6 w-6" />}
              title="Smart Picklist Generation"
              description="Upload orders from any platform and get instant 4x6 picklists ready for your warehouse team."
            />
            <FeatureCard
              icon={<FileSpreadsheet className="h-6 w-6" />}
              title="Automated SKU Mapping"
              description="Intelligent fuzzy matching automatically maps portal SKUs to your master inventory."
            />
            <FeatureCard
              icon={<TrendingUp className="h-6 w-6" />}
              title="Profit Analytics"
              description="Track net profit, margins, and category performance across all your sales channels."
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Multi-Platform Support"
              description="Works with Flipkart, Myntra, Meesho order exports. One tool for all platforms."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Costing Management"
              description="Maintain design-level costing to get accurate profit calculations automatically."
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title="Return Analysis"
              description="Deep dive into RTO and customer returns with smart categorization and insights."
            />
          </div>
        </div>
      </section>

      {/* Platforms Section */}
      <section id="platforms" className="border-y bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Works with your favorite platforms
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Seamlessly integrate with the marketplaces you already sell on
            </p>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-card shadow-sm">
                <span className="text-2xl font-bold text-[#F6C915]">F</span>
              </div>
              <span className="text-sm font-medium">Flipkart</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-card shadow-sm">
                <span className="text-2xl font-bold text-[#FF3F6C]">M</span>
              </div>
              <span className="text-sm font-medium">Myntra</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-card shadow-sm">
                <span className="text-2xl font-bold text-[#F43397]">M</span>
              </div>
              <span className="text-sm font-medium">Meesho</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Start with a 14-day free trial. No credit card required.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-md">
            <div className="rounded-2xl border bg-card p-8 shadow-sm">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Pro Plan</h3>
                <div className="mt-4 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">Free</span>
                  <span className="text-muted-foreground">/14 days</span>
                </div>
              </div>
              <ul className="mt-8 space-y-4">
                <PricingFeature>Unlimited order processing</PricingFeature>
                <PricingFeature>Unlimited SKU mappings</PricingFeature>
                <PricingFeature>All platform integrations</PricingFeature>
                <PricingFeature>Profit analytics dashboard</PricingFeature>
                <PricingFeature>4x6 PDF picklist generation</PricingFeature>
                <PricingFeature>Design-level costing</PricingFeature>
              </ul>
              <Button className="mt-8 w-full" size="lg" asChild>
                <Link href="/auth/sign-up">Start free trial</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-primary py-16">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Ready to streamline your operations?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
            Join thousands of sellers who save hours every day with SmartSeller Suite.
          </p>
          <Button size="lg" variant="secondary" className="mt-8" asChild>
            <Link href="/auth/sign-up">
              Get started for free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">SmartSeller Suite</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built for Indian e-commerce sellers
          </p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

function PricingFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-accent" />
      <span className="text-sm">{children}</span>
    </li>
  )
}
