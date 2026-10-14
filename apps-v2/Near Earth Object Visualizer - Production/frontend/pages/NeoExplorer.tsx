import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Info,
  LoaderCircle,
  PanelRightClose,
  PanelRightOpen,
  Target,
} from 'lucide-react'
import { NeoScene, type Neo } from '../components/NeoScene'
import { useGetNearEarthObjects } from '../hooks/backend/nasa'
import { Badge } from '../lib/shadcn/badge'
import { Button } from '../lib/shadcn/button'
import './neo-explorer.css'

const today = new Date()
const formatDate = (date: Date) => date.toISOString().slice(0, 10)
const defaultStart = formatDate(today)
const defaultEnd = formatDate(new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000))

function formatDistance(distance: number) {
  return distance >= 1 ? `${distance.toFixed(2)} AU` : `${distance.toFixed(3)} AU`
}

function formatDiameter(min: number, max: number) {
  return max >= 1000
    ? `${(min / 1000).toFixed(1)}–${(max / 1000).toFixed(1)} km`
    : `${Math.round(min)}–${Math.round(max)} m`
}

function formatVelocity(value: number) {
  return `${Math.round(value).toLocaleString()} km/h`
}

export default function NeoExplorer() {
  const { data, loading, error, dataAccessErrors, trigger } = useGetNearEarthObjects({ cachePolicy: 'stale-while-revalidate' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(true)

  useEffect(() => {
    trigger({ startDate: defaultStart, endDate: defaultEnd })
  }, [trigger])

  const objects = (data?.objects ?? []) as Neo[]
  const selectedObject = objects.find((object) => object.id === selectedId) ?? objects[0] ?? null
  const loadFeed = () => trigger({ startDate: defaultStart, endDate: defaultEnd }, { skipCache: true })

  return (
    <main className="neo-immersive">
      <div className="scene-layer">
        {loading && objects.length === 0 ? (
          <div className="immersive-loading">
            <LoaderCircle className="h-8 w-8 animate-spin" />
            <span>CALIBRATING ORBITAL DATA</span>
          </div>
        ) : (
          <NeoScene
            objects={objects}
            selectedId={selectedObject?.id ?? null}
            onSelect={(object) => {
              setSelectedId(object.id)
              setDetailsOpen(true)
            }}
          />
        )}
      </div>

      {error ? (
        <div className="floating-error glass-panel"><AlertTriangle className="h-4 w-4" /><span>NASA feed unavailable: {error}</span><Button size="sm" variant="outline" onClick={loadFeed}>Retry</Button></div>
      ) : null}
      {!error && dataAccessErrors.length > 0 ? (
        <div className="floating-error glass-panel"><Info className="h-4 w-4" /><span>{dataAccessErrors.map((item) => item.message).join('; ')}</span></div>
      ) : null}

      <Button
        className={`details-toggle ${detailsOpen ? 'details-toggle-open' : 'details-toggle-closed'}`}
        variant="secondary"
        size="icon"
        aria-label={detailsOpen ? 'Hide object details' : 'Show object details'}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        {detailsOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
      </Button>

      <aside className={`telemetry-overlay ${detailsOpen ? 'telemetry-open' : 'telemetry-closed'}`}>
        {selectedObject ? (
          <>
            <div className="telemetry-header compact-telemetry-header">
              <div>
                <div className="panel-kicker">SELECTED OBJECT</div>
                <h1>{selectedObject.name}</h1>
                <p>{selectedObject.date} · NEO {selectedObject.id}</p>
              </div>
              <Target className="h-5 w-5" />
            </div>

            <Badge variant={selectedObject.hazardous ? 'destructive' : 'secondary'}>
              {selectedObject.hazardous ? 'POTENTIALLY HAZARDOUS' : 'MONITORED'}
            </Badge>

            <div className="telemetry-stats telemetry-kpis">
              <div><span>MISS DISTANCE</span><strong>{formatDistance(selectedObject.missDistanceAu)}</strong><small>{Math.round(selectedObject.missDistanceKm).toLocaleString()} km</small></div>
              <div><span>VELOCITY</span><strong>{formatVelocity(selectedObject.velocityKph)}</strong></div>
              <div><span>DIAMETER</span><strong>{formatDiameter(selectedObject.diameterMinMeters, selectedObject.diameterMaxMeters)}</strong></div>
            </div>
          </>
        ) : (
          <div className="no-selection"><Target className="h-7 w-7" /><h2>No objects in view</h2><p>Adjust the filters to restore tracked objects.</p></div>
        )}
      </aside>
    </main>
  )
}
