import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  Database,
  FileBox,
  HeartPulse,
  Layers3,
  Network,
  Plus,
  Search,
  Send,
  ServerCog,
  Sparkles,
  Table2,
  Waypoints,
  X,
} from 'lucide-react'
import { useAskGenie, useGetUniverse, usePopulateLakebase, usePopulateLakehouse } from '../hooks/backend/metadata'
import { Alert, AlertDescription, AlertTitle } from '../lib/shadcn/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../lib/shadcn/alert-dialog'
import { Badge } from '../lib/shadcn/badge'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../lib/shadcn/sheet'
import { Skeleton } from '../lib/shadcn/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../lib/shadcn/tabs'

type Column = { name: string; type: string }
type Asset = { id: string; name: string; fullName: string; domain: string; columns: Column[] }
type GenieSpace = { id: string; name: string; description: string; summary: string; suggestedQuestions: string[]; status: string }
type Universe = {
  generatedAt: string
  stats: { assets: number; warehouseTables: number; lakehouseWritebackReady: boolean; lakebaseTables: number; lakebaseMetadataRecords: number; genieSpaces: number; connectedSources: number }
  sources: { warehouse: Asset[]; lakebase: Asset[]; accountHealth: GenieSpace; dealDesk: GenieSpace }
}
type GenieResponse = { content: { textAttachments?: string[]; suggestedQuestions?: string[] }; conversationId: string; status: string }
type SelectedItem = { kind: 'asset'; asset: Asset } | { kind: 'genie'; agent: 'accountHealth' | 'dealDesk'; space: GenieSpace }

function compactSummary(summary: string | undefined) {
  return (summary ?? 'No semantic summary is available yet.').replace(/\*\*/g, '').split('\n').filter(Boolean).slice(0, 3)
}

function safeColumns(asset: Asset) {
  return Array.isArray(asset.columns) ? asset.columns : []
}

function safeQuestions(space: GenieSpace) {
  return Array.isArray(space.suggestedQuestions) ? space.suggestedQuestions : []
}

function ResourceStatus({ children }: { children: string }) {
  return <Badge variant="outline" className="gap-1.5 bg-background/70"><span className="h-1.5 w-1.5 rounded-full bg-success" />{children}</Badge>
}

function LakebaseCard({ asset, onSelect }: { asset: Asset; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="group w-full rounded-xl border bg-card/90 p-4 text-left shadow-retool-sm transition-all hover:-translate-y-0.5 hover:border-chart-2/60 hover:shadow-retool-md">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-chart-2/10 p-2.5"><Table2 className="h-5 w-5 text-chart-2" /></div>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-semibold">{asset.name}</p><Check className="h-3.5 w-3.5 text-success" /></div><p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{asset.fullName}</p><div className="mt-3 flex items-center gap-2"><Badge variant="secondary">{safeColumns(asset).length} fields</Badge><Badge variant="outline">Operational</Badge></div></div>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

function LakehouseCard({ asset, onSelect }: { asset: Asset; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="group w-full rounded-xl border bg-card/90 p-3 text-left shadow-retool-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-retool-md">
      <div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2"><Table2 className="h-4 w-4 text-primary" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{asset.name}</p><Check className="h-3.5 w-3.5 text-success" /></div><p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{asset.fullName}</p><p className="mt-2 text-[11px] text-muted-foreground">{asset.domain} · {safeColumns(asset).length} fields</p></div><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
    </button>
  )
}

function GenieCard({ space, agent, onSelect, onQuestion }: { space: GenieSpace; agent: 'accountHealth' | 'dealDesk'; onSelect: () => void; onQuestion: (question: string) => void }) {
  const isHealth = agent === 'accountHealth'
  const Icon = isHealth ? HeartPulse : BrainCircuit
  return (
    <article className="rounded-2xl border bg-card/90 p-4 shadow-retool-sm backdrop-blur transition-shadow hover:shadow-retool-md">
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-3 ${isHealth ? 'bg-chart-3/10 text-chart-3' : 'bg-primary/10 text-primary'}`}><Icon className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-semibold">{space.name}</h3><span className="h-2 w-2 rounded-full bg-success" /></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{space.description}</p></div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>
      <div className="mt-4 space-y-2 border-t pt-3">
        {safeQuestions(space).slice(0, 2).map((question) => (
          <button key={question} type="button" onClick={() => onQuestion(question)} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="line-clamp-2">{question}</span></button>
        ))}
      </div>
    </article>
  )
}

function Inspector({ selected, open, onOpenChange }: { selected: SelectedItem | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!selected) return null
  const title = selected.kind === 'asset' ? selected.asset.name : selected.space.name
  const description = selected.kind === 'asset' ? selected.asset.fullName : selected.space.description
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[94vw] overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b pb-5 pr-8"><div className="mb-2 flex gap-2"><Badge>{selected.kind === 'asset' ? 'Lakebase' : 'Genie space'}</Badge><Badge variant="outline">Verified</Badge></div><SheetTitle className="text-2xl">{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>
        {selected.kind === 'asset' ? (
          <div className="mt-6"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Fields</p><p className="mt-1 text-2xl font-semibold">{safeColumns(selected.asset).length}</p></div><div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Status</p><p className="mt-2 font-semibold text-success">Connected</p></div></div><h3 className="mb-3 mt-6 font-semibold">Schema</h3><div className="space-y-2">{safeColumns(selected.asset).map((column) => <div key={column.name} className="flex items-center justify-between rounded-lg border px-3 py-3"><div className="flex items-center gap-2"><FileBox className="h-4 w-4 text-muted-foreground" /><code className="text-xs">{column.name}</code></div><Badge variant="outline" className="font-mono text-[10px]">{column.type}</Badge></div>)}</div></div>
        ) : (
          <Tabs defaultValue="concepts" className="mt-6"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="concepts">Concepts</TabsTrigger><TabsTrigger value="questions">Questions</TabsTrigger></TabsList><TabsContent value="concepts" className="mt-4 space-y-3">{compactSummary(selected.space.summary).map((paragraph) => <p key={paragraph} className="rounded-xl border bg-card p-4 text-sm leading-6 text-muted-foreground">{paragraph}</p>)}</TabsContent><TabsContent value="questions" className="mt-4 space-y-2">{safeQuestions(selected.space).map((question) => <div key={question} className="flex gap-3 rounded-xl border bg-card p-4 text-sm"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{question}</span></div>)}</TabsContent></Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default function UniversePage() {
  const universeQuery = useGetUniverse({ cachePolicy: 'stale-while-revalidate' })
  const genieQuery = useAskGenie()
  const populateLakebase = usePopulateLakebase()
  const populateLakehouse = usePopulateLakehouse()
  const [search, setSearch] = useState('')
  const [showAllWarehouse, setShowAllWarehouse] = useState(false)
  const [confirmPopulate, setConfirmPopulate] = useState(false)
  const [confirmLakehouseWrite, setConfirmLakehouseWrite] = useState(false)
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [activeAgent, setActiveAgent] = useState<'accountHealth' | 'dealDesk'>('accountHealth')
  const [question, setQuestion] = useState('')
  const [conversationIds, setConversationIds] = useState<Partial<Record<'accountHealth' | 'dealDesk', string>>>({})
  const [answer, setAnswer] = useState('Ask either Genie space about the metadata, relationships, or business questions it can answer.')
  const rawUniverse = universeQuery.data as Partial<Universe> | null
  const rawSources = rawUniverse?.sources
  const universe: Universe | null = rawSources?.accountHealth && rawSources.dealDesk
    ? {
        generatedAt: rawUniverse?.generatedAt ?? new Date().toISOString(),
        stats: {
          assets: rawUniverse?.stats?.assets ?? 0,
          warehouseTables: rawUniverse?.stats?.warehouseTables ?? 0,
          lakehouseWritebackReady: rawUniverse?.stats?.lakehouseWritebackReady ?? false,
          lakebaseTables: rawUniverse?.stats?.lakebaseTables ?? 0,
          lakebaseMetadataRecords: rawUniverse?.stats?.lakebaseMetadataRecords ?? 0,
          genieSpaces: rawUniverse?.stats?.genieSpaces ?? 2,
          connectedSources: rawUniverse?.stats?.connectedSources ?? 4,
        },
        sources: {
          warehouse: Array.isArray(rawSources.warehouse) ? rawSources.warehouse : [],
          lakebase: Array.isArray(rawSources.lakebase) ? rawSources.lakebase : [],
          accountHealth: { ...rawSources.accountHealth, suggestedQuestions: safeQuestions(rawSources.accountHealth) },
          dealDesk: { ...rawSources.dealDesk, suggestedQuestions: safeQuestions(rawSources.dealDesk) },
        },
      }
    : null
  const genieResponse = genieQuery.data as GenieResponse | null

  useEffect(() => { void universeQuery.trigger({}, { skipCache: true }) }, [universeQuery.trigger])
  useEffect(() => {
    if (!genieResponse) return
    const text = genieResponse.content?.textAttachments?.join('\n\n')
    if (text) setAnswer(text)
    setConversationIds((current) => ({ ...current, [activeAgent]: genieResponse.conversationId }))
  }, [genieResponse, activeAgent])

  const warehouseAssets = useMemo(() => {
    const assets = Array.isArray(universe?.sources.warehouse) ? universe.sources.warehouse : []
    const needle = search.trim().toLowerCase()
    const filtered = needle ? assets.filter((asset) => `${asset.name} ${asset.fullName} ${asset.domain}`.toLowerCase().includes(needle)) : assets
    return [...filtered].sort((left, right) => Number(right.fullName.includes('metadata_explorer_writeback_test')) - Number(left.fullName.includes('metadata_explorer_writeback_test')))
  }, [universe, search])

  const lakebaseAssets = useMemo(() => {
    const assets = Array.isArray(universe?.sources.lakebase) ? universe.sources.lakebase : []
    const needle = search.trim().toLowerCase()
    return needle ? assets.filter((asset) => `${asset.name} ${asset.fullName} ${safeColumns(asset).map((column) => column.name).join(' ')}`.toLowerCase().includes(needle)) : assets
  }, [universe, search])

  const askQuestion = (prompt: string, agent = activeAgent) => {
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt) return
    setActiveAgent(agent)
    setQuestion(cleanPrompt)
    void genieQuery.trigger({ agent, question: cleanPrompt, ...(conversationIds[agent] ? { conversationId: conversationIds[agent] } : {}) }, { skipCache: true })
  }

  const populateOperationalMetadata = async () => {
    try {
      await populateLakebase.trigger({ confirmed: true }, { skipCache: true })
      setConfirmPopulate(false)
      await universeQuery.trigger({}, { skipCache: true })
    } catch {
      setConfirmPopulate(false)
    }
  }

  const createLakehouseTestTable = async () => {
    try {
      await populateLakehouse.trigger({ confirmed: true }, { skipCache: true })
      setConfirmLakehouseWrite(false)
      await universeQuery.trigger({}, { skipCache: true })
    } catch {
      setConfirmLakehouseWrite(false)
    }
  }

  const accessErrors = Array.isArray(universeQuery.dataAccessErrors) ? universeQuery.dataAccessErrors : []
  const accessMessage = !universeQuery.error && accessErrors.length ? accessErrors.map((item) => item.message).join('; ') : null

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Layers3 className="h-5 w-5" /></div><div><p className="font-semibold tracking-tight">Metadata Intelligence Explorer</p><p className="text-[11px] text-muted-foreground">Northstar Industries · operational knowledge graph</p></div></div>
        <div className="flex items-center gap-2"><ResourceStatus>4 resources live</ResourceStatus><Badge variant="secondary" className="hidden sm:inline-flex">Production</Badge></div>
      </header>

      <main className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,hsl(var(--primary)/0.09),transparent_35%)]" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative mx-auto max-w-[1500px] p-4 md:p-6">
          <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><Badge variant="outline" className="mb-3 gap-1.5"><Network className="h-3.5 w-3.5" />Four connected metadata resources</Badge><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Unified data and intelligence landscape</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Explore Lakehouse analytics, Lakebase operations, and two specialized Genie spaces in one connected view.</p></div><div className="relative w-full lg:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search metadata across systems" className="bg-background pl-9 pr-9" />{search ? <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-3 top-2.5"><X className="h-4 w-4 text-muted-foreground" /></button> : null}</div></div>

          {(!universe && !universeQuery.error) || universeQuery.loading ? <div className="grid gap-5 lg:grid-cols-4"><Skeleton className="h-[460px] rounded-2xl" /><Skeleton className="h-[460px] rounded-2xl" /><Skeleton className="h-[460px] rounded-2xl" /><Skeleton className="h-[460px] rounded-2xl" /></div> : universeQuery.error || accessMessage ? <Alert variant="destructive" className="mx-auto mt-20 max-w-xl"><Activity className="h-4 w-4" /><AlertTitle>Resources unavailable</AlertTitle><AlertDescription>{universeQuery.error ?? accessMessage}<Button variant="outline" size="sm" className="mt-4 block" onClick={() => void universeQuery.trigger({}, { skipCache: true })}>Try again</Button></AlertDescription></Alert> : universe ? (
            <>
              <div className="grid items-stretch gap-4 xl:grid-cols-4">
                <section className="rounded-2xl border bg-card/55 p-4 shadow-retool-sm backdrop-blur">
                  <div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Analytical system</p><h2 className="mt-1 text-lg font-semibold">Lakehouse</h2></div><div className="rounded-xl bg-primary/10 p-3"><Database className="h-6 w-6 text-primary" /></div></div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Governed analytical metadata from the Databricks SQL Warehouse.</p>
                  <div className="mt-4 rounded-lg border bg-background/70 p-3"><p className="text-[10px] text-muted-foreground">Company tables</p><p className="mt-1 font-mono text-xl font-semibold">{universe.stats.warehouseTables}</p></div>
                  <div className="mt-4 max-h-[310px] space-y-2 overflow-y-auto pr-1">{warehouseAssets.slice(0, showAllWarehouse ? warehouseAssets.length : 5).map((asset) => <LakehouseCard key={asset.id} asset={asset} onSelect={() => setSelected({ kind: 'asset', asset })} />)}</div>
                  {warehouseAssets.length > 5 ? <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setShowAllWarehouse((value) => !value)}>{showAllWarehouse ? 'Show less' : `Browse all ${warehouseAssets.length} tables`}</Button> : null}
                  <div className="mt-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs leading-5 text-muted-foreground">Test Lakehouse write access with an idempotent Delta table in the sandbox schema.</p>{universe.stats.lakehouseWritebackReady ? <Badge variant="success">Created</Badge> : null}</div><Button size="sm" variant="outline" className="mt-3 w-full gap-2" onClick={() => setConfirmLakehouseWrite(true)} disabled={populateLakehouse.loading}><Plus className="h-4 w-4" />{populateLakehouse.loading ? 'Creating…' : universe.stats.lakehouseWritebackReady ? 'Run write test again' : 'Test Lakehouse write'}</Button>{populateLakehouse.error ? <p className="mt-2 text-xs text-destructive">{populateLakehouse.error}</p> : null}</div>
                </section>

                <section className="rounded-2xl border bg-card/55 p-4 shadow-retool-sm backdrop-blur">
                  <div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-chart-2">Operational system</p><h2 className="mt-1 text-lg font-semibold">Lakebase</h2></div><div className="rounded-xl bg-chart-2/10 p-3"><ServerCog className="h-6 w-6 text-chart-2" /></div></div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Low-latency PostgreSQL metadata for applications, workflows, and operational state.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg border bg-background/70 p-3"><p className="text-[10px] text-muted-foreground">Tables</p><p className="mt-1 font-mono text-xl font-semibold">{universe.stats.lakebaseTables}</p></div><div className="rounded-lg border bg-background/70 p-3"><p className="text-[10px] text-muted-foreground">Connection</p><p className="mt-2 text-sm font-semibold text-success">Healthy</p></div></div>
                  <div className="mt-4 max-h-[390px] space-y-2 overflow-y-auto pr-1">{lakebaseAssets.length ? lakebaseAssets.map((asset) => <LakebaseCard key={asset.id} asset={asset} onSelect={() => setSelected({ kind: 'asset', asset })} />) : <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No matching Lakebase metadata.</div>}</div>
                  {universe.stats.lakebaseMetadataRecords === 0 ? <div className="mt-4 rounded-xl border border-dashed border-chart-2/50 bg-chart-2/5 p-3"><p className="text-xs leading-5 text-muted-foreground">This source has limited metadata. Seed five operational metadata records to demonstrate cross-system relationships.</p><Button size="sm" variant="outline" className="mt-3 w-full gap-2" onClick={() => setConfirmPopulate(true)} disabled={populateLakebase.loading}><Plus className="h-4 w-4" />{populateLakebase.loading ? 'Populating…' : 'Populate Lakebase'}</Button>{populateLakebase.error ? <p className="mt-2 text-xs text-destructive">{populateLakebase.error}</p> : null}</div> : null}
                </section>

                <section className="relative flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-primary/20 bg-card/75 p-5 text-center shadow-retool-md backdrop-blur">
                  <div className="absolute left-0 top-1/2 hidden w-full border-t border-dashed border-primary/30 xl:block" />
                  <div className="relative z-10 grid h-28 w-28 place-items-center rounded-full border border-primary/30 bg-background shadow-[0_0_50px_hsl(var(--primary)/0.18)]"><div className="grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/25"><Waypoints className="h-9 w-9" /></div><span className="absolute inset-0 animate-ping rounded-full border border-primary/20 [animation-duration:3s]" /></div>
                  <div className="relative z-10 mt-6 rounded-xl bg-background/90 px-3 py-2"><h2 className="font-semibold">Metadata context</h2><p className="mt-1 text-xs text-muted-foreground">Schema · semantics · questions</p></div>
                  <div className="relative z-10 mt-6 grid w-full grid-cols-3 gap-1 text-center text-[10px]"><div className="rounded-lg border bg-background p-2">Store</div><div className="rounded-lg border bg-background p-2">Relate</div><div className="rounded-lg border bg-background p-2">Ask</div></div>
                </section>

                <section className="rounded-2xl border bg-card/55 p-4 shadow-retool-sm backdrop-blur">
                  <div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Semantic intelligence</p><h2 className="mt-1 text-lg font-semibold">Genie spaces</h2></div><div className="rounded-xl bg-primary/10 p-3"><Bot className="h-6 w-6 text-primary" /></div></div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Specialized business agents expose concepts, relationships, and governed natural-language analysis.</p>
                  <div className="mt-4 grid gap-3"><GenieCard space={universe.sources.accountHealth} agent="accountHealth" onSelect={() => setSelected({ kind: 'genie', agent: 'accountHealth', space: universe.sources.accountHealth })} onQuestion={(prompt) => askQuestion(prompt, 'accountHealth')} /><GenieCard space={universe.sources.dealDesk} agent="dealDesk" onSelect={() => setSelected({ kind: 'genie', agent: 'dealDesk', space: universe.sources.dealDesk })} onQuestion={(prompt) => askQuestion(prompt, 'dealDesk')} /></div>
                </section>
              </div>

              <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.45fr]">
                <div className="rounded-2xl border bg-card/70 p-5 shadow-retool-sm backdrop-blur"><div className="flex items-center gap-2"><Network className="h-5 w-5 text-primary" /><h2 className="font-semibold">Cross-resource relationships</h2></div><div className="mt-5 space-y-3"><div className="flex items-center gap-3 rounded-xl border bg-background/70 p-3"><Database className="h-4 w-4 text-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">Lakehouse analytical entities</p><p className="text-xs text-muted-foreground">Accounts, pipeline, support and consumption history</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /><ServerCog className="h-4 w-4 text-chart-2" /></div><div className="flex items-center gap-3 rounded-xl border bg-background/70 p-3"><ServerCog className="h-4 w-4 text-chart-2" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">Lakebase operational context</p><p className="text-xs text-muted-foreground">Workflow state and metadata catalog</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /><HeartPulse className="h-4 w-4 text-chart-3" /></div><div className="flex items-center gap-3 rounded-xl border bg-background/70 p-3"><HeartPulse className="h-4 w-4 text-chart-3" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">Genie semantic intelligence</p><p className="text-xs text-muted-foreground">Health, territory, quota and deal decisions</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /><BrainCircuit className="h-4 w-4 text-primary" /></div><p className="text-xs leading-5 text-muted-foreground">Suggested bridge: account identifiers connect Lakehouse history and Lakebase workflow context to Account Health and Deal Desk semantics.</p></div></div>

                <div className="rounded-2xl border bg-card/80 p-5 shadow-retool-md backdrop-blur"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><Sparkles className="h-5 w-5 text-primary" /></div><div><h2 className="font-semibold">Ask the metadata universe</h2><p className="text-xs text-muted-foreground">Responses come from the selected Genie space.</p></div></div><div className="flex rounded-lg border bg-background p-1"><Button size="sm" variant={activeAgent === 'accountHealth' ? 'default' : 'ghost'} onClick={() => setActiveAgent('accountHealth')}>Account Health</Button><Button size="sm" variant={activeAgent === 'dealDesk' ? 'default' : 'ghost'} onClick={() => setActiveAgent('dealDesk')}>Deal Desk</Button></div></div>
                  <div className="mt-4 min-h-28 rounded-xl border bg-background/70 p-4 text-sm leading-6 text-muted-foreground">{genieQuery.loading ? <div className="flex items-center gap-2 text-foreground"><Sparkles className="h-4 w-4 animate-pulse text-primary" />Genie is reasoning across governed metadata…</div> : genieQuery.error ? <span className="text-destructive">{genieQuery.error}</span> : <p className="whitespace-pre-line">{answer}</p>}</div>
                  <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); askQuestion(question) }}><Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={`Ask ${activeAgent === 'accountHealth' ? 'Account Health' : 'Deal Desk'}…`} maxLength={800} /><Button type="submit" disabled={!question.trim() || genieQuery.loading} className="gap-2"><Send className="h-4 w-4" /><span className="hidden sm:inline">Ask</span></Button></form>
                </div>
              </section>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />4 verified production resources</span><span>{universe.stats.assets} metadata surfaces</span><span>Updated {new Date(universe.generatedAt).toLocaleTimeString()}</span></div>
            </>
          ) : null}
        </div>
      </main>
      <Inspector selected={selected} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }} />
      <AlertDialog open={confirmLakehouseWrite} onOpenChange={setConfirmLakehouseWrite}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Create a Lakehouse test table?</AlertDialogTitle><AlertDialogDescription>This creates or updates <code>retool_hackathon.sandbox.metadata_explorer_writeback_test</code> and inserts one demonstration metadata row. Running it again updates the same row rather than creating duplicates.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void createLakehouseTestTable()}>Create test table</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmPopulate} onOpenChange={setConfirmPopulate}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Populate Lakebase metadata?</AlertDialogTitle><AlertDialogDescription>This writes five demonstration metadata markers into the permitted <code>test.playing_with_lakebase</code> table using reserved IDs 10001–10005. Existing rows are not modified.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void populateOperationalMetadata()}>Create metadata catalog</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
