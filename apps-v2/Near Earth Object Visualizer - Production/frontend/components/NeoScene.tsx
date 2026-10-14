import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Maximize2, MousePointer2, Move3d, Rotate3d, ZoomIn } from 'lucide-react'
import { Button } from '../lib/shadcn/button'
import { SpaceScene, type Neo } from './NeoSceneGraph'

export type { Neo } from './NeoSceneGraph'

export function NeoScene({ objects, selectedId, onSelect }: {
  objects: Neo[]
  selectedId: string | null
  onSelect: (object: Neo) => void
}) {
  const [sceneKey, setSceneKey] = useState(0)

  return (
    <div className="neo-3d-shell">
      <div className="neo-canvas-wrap">
        <Canvas
          key={sceneKey}
          shadows
          dpr={[1, 2]}
          camera={{ position: [10, 7, 13], fov: 46, near: 0.1, far: 100 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <Suspense fallback={null}>
            <SpaceScene objects={objects} selectedId={selectedId} onSelect={onSelect} />
          </Suspense>
        </Canvas>
        <div className="scene-controls" aria-hidden="true">
          <span><Rotate3d /> Left drag · orbit</span>
          <span><Move3d /> Right drag · pan</span>
          <span><ZoomIn /> Wheel · zoom</span>
          <span><MousePointer2 /> Click · inspect</span>
        </div>
        <Button
          className="scene-reset"
          variant="secondary"
          size="icon"
          aria-label="Reset 3D view"
          onClick={() => setSceneKey((key) => key + 1)}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
