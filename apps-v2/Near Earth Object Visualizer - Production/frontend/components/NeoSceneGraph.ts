import {
  createElement,
  useMemo,
  useRef,
  type ElementType,
  type ReactNode,
} from 'react'
import { useFrame, type ThreeEvent, type RootState } from '@react-three/fiber'
import { Grid, OrbitControls, Sparkles, useTexture } from '@react-three/drei'
import type { Group, Mesh } from 'three'
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  IcosahedronGeometry,
  SRGBColorSpace,
} from 'three'

export type Neo = {
  id: string
  name: string
  date: string
  magnitude: number
  hazardous: boolean
  diameterMinMeters: number
  diameterMaxMeters: number
  missDistanceAu: number
  missDistanceKm: number
  velocityKph: number
}

type NeoPosition = {
  object: Neo
  position: [number, number, number]
  scale: number
}

type SceneProps = {
  objects: Neo[]
  selectedId: string | null
  onSelect: (object: Neo) => void
}

// Using createElement keeps the editor's DOM inspector from attaching data-* props
// to Three.js objects, which React Three Fiber cannot apply.
function sceneElement(
  type: string | ElementType,
  props: Record<string, unknown> | null,
  ...children: ReactNode[]
) {
  return createElement(type as ElementType, props, ...children)
}

function hashNumber(value: string, salt: number) {
  let hash = salt
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  }
  return Math.abs(hash % 10000) / 10000
}

const EARTH_COLOR_MAP = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
const EARTH_BUMP_MAP = 'https://unpkg.com/three-globe/example/img/earth-topology.png'

function createCloudTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) return null

  for (let index = 0; index < 230; index += 1) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    const radius = 5 + Math.random() * 34
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, `rgba(255,255,255,${0.08 + Math.random() * 0.2})`)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function Earth() {
  const earthRef = useRef<Mesh>(null)
  const cloudsRef = useRef<Mesh>(null)
  const loadedTextures = useTexture([EARTH_COLOR_MAP, EARTH_BUMP_MAP])
  const earthTexture = loadedTextures[0]!
  const bumpTexture = loadedTextures[1]!
  const cloudTexture = useMemo(createCloudTexture, [])

  earthTexture.colorSpace = SRGBColorSpace
  earthTexture.anisotropy = 16
  bumpTexture.anisotropy = 16

  useFrame((_state: RootState, delta: number) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.032
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.041
  })

  return sceneElement(
    'group',
    { rotation: [0, 0, -0.22] },
    sceneElement(
      'mesh',
      { ref: earthRef, castShadow: true, receiveShadow: true },
      sceneElement('sphereGeometry', { args: [1, 192, 192] }),
      sceneElement('meshStandardMaterial', {
        map: earthTexture,
        bumpMap: bumpTexture,
        bumpScale: 0.035,
        roughness: 0.76,
        metalness: 0.02,
      }),
    ),
    sceneElement(
      'mesh',
      { ref: cloudsRef, scale: 1.012 },
      sceneElement('sphereGeometry', { args: [1, 96, 96] }),
      sceneElement('meshStandardMaterial', {
        map: cloudTexture,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        roughness: 1,
      }),
    ),
    sceneElement(
      'mesh',
      { scale: 1.055 },
      sceneElement('sphereGeometry', { args: [1, 96, 96] }),
      sceneElement('meshBasicMaterial', {
        color: '#4ab7ff',
        transparent: true,
        opacity: 0.1,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    ),
    sceneElement(
      'mesh',
      { scale: 1.085 },
      sceneElement('sphereGeometry', { args: [1, 96, 96] }),
      sceneElement('meshBasicMaterial', {
        color: '#8ed7ff',
        transparent: true,
        opacity: 0.035,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    ),
  )
}

function OrbitRing({ radius, opacity }: { radius: number; opacity: number }) {
  return sceneElement(
    'mesh',
    { rotation: [Math.PI / 2, 0, 0] },
    sceneElement('ringGeometry', { args: [radius - 0.009, radius + 0.009, 192] }),
    sceneElement('meshBasicMaterial', {
      color: '#7fa8c7',
      transparent: true,
      opacity,
      side: DoubleSide,
    }),
  )
}

function createAsteroidGeometry(id: string) {
  const geometry = new IcosahedronGeometry(1, 4)
  const positions = geometry.attributes['position']
  if (!positions) return geometry

  const seedA = hashNumber(id, 101) * Math.PI * 2
  const seedB = hashNumber(id, 211) * Math.PI * 2
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    const z = positions.getZ(index)
    const length = Math.sqrt(x * x + y * y + z * z) || 1
    const nx = x / length
    const ny = y / length
    const nz = z / length
    const ridges = Math.sin(nx * 9 + seedA) * Math.sin(ny * 11 + seedB) * Math.sin(nz * 8)
    const detail = Math.sin((nx + ny) * 23 + seedB) * 0.035
    const displacement = 1 + ridges * 0.105 + detail
    positions.setXYZ(index, nx * displacement, ny * displacement, nz * displacement)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function Asteroid({ item, selected, onSelect }: {
  item: NeoPosition
  selected: boolean
  onSelect: (object: Neo) => void
}) {
  const groupRef = useRef<Group>(null)
  const geometry = useMemo(() => createAsteroidGeometry(item.object.id), [item.object.id])
  const stretch = useMemo<[number, number, number]>(() => [
    0.82 + hashNumber(item.object.id, 4) * 0.42,
    0.78 + hashNumber(item.object.id, 8) * 0.38,
    0.82 + hashNumber(item.object.id, 12) * 0.42,
  ], [item.object.id])

  useFrame((_state: RootState, delta: number) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += delta * (0.08 + hashNumber(item.object.id, 33) * 0.12)
      groupRef.current.rotation.y += delta * (0.1 + hashNumber(item.object.id, 49) * 0.14)
    }
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onSelect(item.object)
  }
  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    document.body.style.cursor = 'pointer'
  }
  const handlePointerOut = () => {
    document.body.style.cursor = 'default'
  }

  return sceneElement(
    'group',
    { position: item.position },
    selected
      ? sceneElement(
          'mesh',
          { scale: item.scale * 1.9 },
          sceneElement('sphereGeometry', { args: [1, 32, 32] }),
          sceneElement('meshBasicMaterial', {
            color: item.object.hazardous ? '#ff755e' : '#7ed5ff',
            transparent: true,
            opacity: 0.12,
            blending: AdditiveBlending,
          }),
        )
      : null,
    sceneElement(
      'group',
      {
        ref: groupRef,
        scale: [item.scale * stretch[0], item.scale * stretch[1], item.scale * stretch[2]],
        onClick: handleClick,
        onPointerOver: handlePointerOver,
        onPointerOut: handlePointerOut,
      },
      sceneElement(
        'mesh',
        { geometry, castShadow: true, receiveShadow: true },
        sceneElement('meshStandardMaterial', {
          color: item.object.hazardous ? '#8a5749' : '#77736b',
          emissive: item.object.hazardous ? '#35100b' : '#151a1c',
          emissiveIntensity: selected ? 0.48 : 0.12,
          roughness: 0.96,
          metalness: 0.04,
        }),
      ),
      sceneElement(
        'mesh',
        { position: [0.58, 0.2, 0.66], rotation: [0.52, 0.4, 0] },
        sceneElement('circleGeometry', { args: [0.18, 24] }),
        sceneElement('meshStandardMaterial', {
          color: '#302f2c',
          roughness: 1,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      ),
    ),
  )
}

export function SpaceScene({ objects, selectedId, onSelect }: SceneProps) {
  const positionedObjects = useMemo<NeoPosition[]>(() => {
    const maxDiameter = Math.max(...objects.map((object) => object.diameterMaxMeters), 1)
    return objects.map((object) => {
      const longitude = hashNumber(object.id, 17) * Math.PI * 2
      const latitude = (hashNumber(object.id, 73) - 0.5) * Math.PI * 0.62
      const radialDistance = 2.3 + Math.sqrt(Math.min(object.missDistanceAu, 0.5) / 0.5) * 6.5
      const horizontalRadius = Math.cos(latitude) * radialDistance
      return {
        object,
        position: [
          Math.cos(longitude) * horizontalRadius,
          Math.sin(latitude) * radialDistance,
          Math.sin(longitude) * horizontalRadius,
        ],
        scale: 0.12 + Math.sqrt(object.diameterMaxMeters / maxDiameter) * 0.3,
      }
    })
  }, [objects])

  return sceneElement(
    'group',
    null,
    sceneElement('color', { attach: 'background', args: ['#030609'] }),
    sceneElement('fog', { attach: 'fog', args: ['#030609', 20, 40] }),
    sceneElement('ambientLight', { intensity: 0.16 }),
    sceneElement('directionalLight', { position: [7, 7, 5], intensity: 3.4, castShadow: true }),
    sceneElement('pointLight', { position: [-8, -3, -8], intensity: 12, color: '#346f9c', distance: 26 }),
    sceneElement(Sparkles, {
      count: 320,
      scale: [30, 20, 30],
      size: 1,
      speed: 0.05,
      opacity: 0.72,
      color: '#e4f4ff',
    }),
    sceneElement(Grid, {
      position: [0, -4.6, 0],
      args: [34, 34],
      cellSize: 1,
      cellThickness: 0.3,
      cellColor: '#243c49',
      sectionSize: 5,
      sectionThickness: 0.65,
      sectionColor: '#345c70',
      fadeDistance: 25,
      fadeStrength: 1.6,
      infiniteGrid: true,
    }),
    sceneElement(Earth, null),
    sceneElement(OrbitRing, { radius: 2.5, opacity: 0.3 }),
    sceneElement(OrbitRing, { radius: 4.5, opacity: 0.21 }),
    sceneElement(OrbitRing, { radius: 6.5, opacity: 0.16 }),
    sceneElement(OrbitRing, { radius: 8.5, opacity: 0.12 }),
    ...positionedObjects.map((item) => sceneElement(Asteroid, {
      key: item.object.id,
      item,
      selected: item.object.id === selectedId,
      onSelect,
    })),
    sceneElement(OrbitControls, {
      makeDefault: true,
      enableDamping: true,
      dampingFactor: 0.07,
      enablePan: true,
      screenSpacePanning: true,
      minDistance: 3.5,
      maxDistance: 32,
      target: [0, 0, 0],
    }),
  )
}
