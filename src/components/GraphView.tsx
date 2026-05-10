import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { getAllIds, fetchNode, getColor, getIcon, type DataNode } from '../data/dataLoader'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  title: string
  shortName: string
  type: string
  color: string
  icon: string
  osiLayer?: number
  description: string
  r: number
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  kind: 'child' | 'related' | 'security'
}

interface Props {
  onNodeClick: (node: DataNode) => void
  highlightId?: string
}

interface Tooltip {
  x: number; y: number
  node: GraphNode
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeR(type: string, osiLayer?: number): number {
  if (type === 'model') return 26
  if (type === 'osi-layer') return 22
  if (osiLayer) return 17
  if (type === 'attack' || type === 'defense') return 15
  if (type === 'tool') return 15
  return 13
}

// ─── Build graph data (cached after first call) ───────────────────────────────

let cachedData: { nodes: GraphNode[]; links: GraphLink[] } | null = null

// Layer → rough Y band for pre-positioning
const LAYER_Y: Record<string, number> = {
  'model': 0.1, 'osi-layer': 0.2,
  'protocol': 0.5, 'concept': 0.5, 'process': 0.5,
  'attack': 0.75, 'defense': 0.85, 'tool': 0.9, 'hardware': 0.95,
}
const OSI_Y: Record<number, number> = { 7: 0.15, 6: 0.25, 5: 0.35, 4: 0.45, 3: 0.55, 2: 0.65, 1: 0.75 }

export async function buildGraphData() {
  if (cachedData) return cachedData

  const ids = getAllIds()
  const rawNodes = await Promise.all(ids.map(id => fetchNode(id)))
  const nodeMap = new Map<string, DataNode>()
  rawNodes.forEach(n => n && nodeMap.set(n.id, n))

  const nodes: GraphNode[] = []
  const linkSet = new Set<string>()
  const links: GraphLink[] = []

  const addLink = (src: string, tgt: string, kind: GraphLink['kind']) => {
    if (!nodeMap.has(src) || !nodeMap.has(tgt) || src === tgt) return
    const key = (src < tgt ? src + '|' + tgt : tgt + '|' + src) + kind
    if (linkSet.has(key)) return
    linkSet.add(key)
    links.push({ source: src, target: tgt, kind })
  }

  const W = window.innerWidth, H = window.innerHeight
  const layerCounts: Record<string, number> = {}

  nodeMap.forEach(n => {
    const yBand = n.osiLayer ? OSI_Y[n.osiLayer] ?? 0.5 : (LAYER_Y[n.type] ?? 0.5)
    const bandKey = String(yBand)
    layerCounts[bandKey] = (layerCounts[bandKey] ?? 0) + 1
    const idx = layerCounts[bandKey]
    // Spread nodes horizontally within their band, with jitter
    const x = (W * 0.1) + (idx * 120) % (W * 0.8) + (Math.random() - 0.5) * 40
    const y = H * yBand + (Math.random() - 0.5) * 60

    nodes.push({
      id: n.id,
      title: n.title,
      shortName: n.shortName ?? n.title.split(/\s+/).slice(0, 3).join(' '),
      type: n.type,
      color: getColor(n),
      icon: getIcon(n),
      osiLayer: n.osiLayer,
      description: n.description,
      r: nodeR(n.type, n.osiLayer),
      x, y,
    })
    ;(n.children as string[] | undefined)?.forEach(c => addLink(n.id, c, 'child'))
    ;(n.relatedConcepts as string[] | undefined)?.forEach(c => addLink(n.id, c, 'related'))
    const cyber = n.cybersecurity as { attacks?: string[]; defenses?: string[] } | undefined
    cyber?.attacks?.forEach(a => addLink(n.id, a, 'security'))
    cyber?.defenses?.forEach(d => addLink(n.id, d, 'security'))
  })

  cachedData = { nodes, links }
  return cachedData
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GraphView({ onNodeClick, highlightId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const gRef = useRef<SVGGElement | null>(null)
  const nodeElRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null)
  const linkElRef = useRef<d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null>(null)
  const dataRef = useRef<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [ready, setReady] = useState(false)
  const currentZoomRef = useRef(1)

  // ── Highlight ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!nodeElRef.current) return
    nodeElRef.current.each(function (d) {
      const g = d3.select<SVGGElement, GraphNode>(this)
      const isHl = d.id === highlightId
      g.select<SVGCircleElement>('circle.main')
        .attr('fill', isHl ? d.color + '55' : d.color + '18')
        .attr('stroke-width', isHl ? 3 : d.r > 20 ? 2 : 1.5)
        .attr('r', isHl ? d.r + 3 : d.r)
      if (isHl) (this as SVGGElement).parentElement?.appendChild(this)
    })
  }, [highlightId])

  // ── LOD: show/hide labels based on zoom ────────────────────────────────────
  const applyLOD = useCallback((k: number) => {
    if (!nodeElRef.current) return
    currentZoomRef.current = k
    nodeElRef.current.select<SVGTextElement>('text.label')
      .attr('display', d => {
        if (k >= 0.6) return null          // show all
        if (k >= 0.35) return d.r >= 17 ? null : 'none'  // only bigger nodes
        return d.r >= 22 ? null : 'none'   // only largest
      })
  }, [])

  // ── Main render (called once) ──────────────────────────────────────────────
  const initGraph = useCallback((data: { nodes: GraphNode[]; links: GraphLink[] }) => {
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const W = svgRef.current!.clientWidth || window.innerWidth
    const H = svgRef.current!.clientHeight || window.innerHeight

    // Single shared glow filter
    const defs = svg.append('defs')
    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%')
    filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'blur')
    const merge = filter.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', e => {
        g.attr('transform', e.transform)
        applyLOD(e.transform.k)
      })
    zoomRef.current = zoom
    svg.call(zoom).on('dblclick.zoom', null)

    const g = svg.append('g')
    gRef.current = g.node()

    // ── Links ──────────────────────────────────────────────────────────────
    const linkG = g.append('g').attr('class', 'links')
    const linkEl = linkG.selectAll<SVGLineElement, GraphLink>('line')
      .data(data.links)
      .join('line')
      .attr('stroke', d => d.kind === 'child' ? '#1e4a8a' : d.kind === 'security' ? '#ff336640' : '#0d3020')
      .attr('stroke-width', d => d.kind === 'child' ? 1.4 : 0.7)
      .attr('stroke-opacity', d => d.kind === 'child' ? 0.55 : 0.25)
    linkElRef.current = linkEl

    // ── Nodes ──────────────────────────────────────────────────────────────
    const nodeG = g.append('g').attr('class', 'nodes')
    const nodeEl = nodeG.selectAll<SVGGElement, GraphNode>('g')
      .data(data.nodes, d => d.id)
      .join('g')
      .attr('cursor', 'pointer')

    // Glow ring (only on large nodes to save GPU)
    nodeEl.filter(d => d.r >= 17)
      .append('circle')
      .attr('class', 'glow-ring')
      .attr('r', d => d.r + 5)
      .attr('fill', 'none')
      .attr('stroke', d => d.color)
      .attr('stroke-width', 0.8)
      .attr('stroke-opacity', 0.15)
      .attr('filter', 'url(#glow)')

    // Main circle
    nodeEl.append('circle')
      .attr('class', 'main')
      .attr('r', d => d.r)
      .attr('fill', d => d.color + '18')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.r > 20 ? 2 : 1.5)

    // Icon text
    nodeEl.append('text')
      .attr('class', 'icon')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', d => Math.round(d.r * 0.85))
      .attr('y', 0)
      .attr('pointer-events', 'none')
      .text(d => d.icon)

    // Label (LOD-controlled)
    nodeEl.append('text')
      .attr('class', 'label')
      .attr('text-anchor', 'middle')
      .attr('y', d => d.r + 11)
      .attr('font-size', d => d.r >= 22 ? 10 : 8)
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.85)
      .attr('pointer-events', 'none')
      .text(d => d.shortName)

    nodeElRef.current = nodeEl

    // ── Interactions ───────────────────────────────────────────────────────
    nodeEl
      .on('mouseenter', (event, d) => {
        setTooltip({ x: event.clientX, y: event.clientY, node: d })
        d3.select<SVGGElement, GraphNode>(event.currentTarget)
          .select<SVGCircleElement>('circle.main')
          .attr('fill', d.color + '40')
          .attr('stroke-width', 3)
      })
      .on('mousemove', event => {
        setTooltip(t => t ? { ...t, x: event.clientX, y: event.clientY } : null)
      })
      .on('mouseleave', (event, d) => {
        setTooltip(null)
        if (d.id !== highlightId) {
          d3.select<SVGGElement, GraphNode>(event.currentTarget)
            .select<SVGCircleElement>('circle.main')
            .attr('fill', d.color + '18')
            .attr('stroke-width', d.r > 20 ? 2 : 1.5)
        }
      })
      .on('click', (_e, d) => {
        fetchNode(d.id).then(n => n && onNodeClick(n))
      })

    // Drag
    nodeEl.call(
      d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simRef.current?.alphaTarget(0.2).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) simRef.current?.alphaTarget(0)
          d.fx = null; d.fy = null
        })
    )

    // ── Simulation ─────────────────────────────────────────────────────────
    const sim = d3.forceSimulation<GraphNode>(data.nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(data.links)
        .id(d => d.id)
        .distance(d => d.kind === 'child' ? 80 : d.kind === 'related' ? 140 : 120)
        .strength(d => d.kind === 'child' ? 0.5 : 0.08)
      )
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength(d => -(d.r * 14))
        .theta(0.95)
        .distanceMax(300)
      )
      .force('center', d3.forceCenter(W / 2, H / 2).strength(0.02))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => d.r + 10).strength(0.8))
      .alphaMin(0.003)
      .alphaDecay(0.04)
      .velocityDecay(0.5)

    simRef.current = sim

    sim.on('tick', () => {
      linkEl
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!)
      nodeEl.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    sim.on('end', () => {
      setReady(true)
      applyLOD(currentZoomRef.current)
    })

    applyLOD(1)
  }, [onNodeClick, applyLOD])

  // ── Fit view helper ────────────────────────────────────────────────────────
  function fitView(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    zoom: d3.ZoomBehavior<SVGSVGElement, unknown>,
    W: number, H: number
  ) {
    const bounds = (g.node() as SVGGElement).getBBox()
    if (!bounds.width || !bounds.height) return
    const pad = 80
    const scale = Math.min(1.0, Math.max(0.15, Math.min(
      (W - pad * 2) / bounds.width,
      (H - pad * 2) / bounds.height
    )))
    const tx = W / 2 - scale * (bounds.x + bounds.width / 2)
    const ty = H / 2 - scale * (bounds.y + bounds.height / 2)
    svg.transition().duration(800).ease(d3.easeCubicOut).call(
      zoom.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    )
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    buildGraphData().then(data => {
      dataRef.current = data
      initGraph(data)
    })
    return () => { simRef.current?.stop() }
  }, [initGraph])

  return (
    <div className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" style={{ background: 'transparent' }} />

      {/* Loading overlay */}
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[#00d4ff] text-sm animate-pulse mb-2">Building graph…</div>
          <div className="text-gray-600 text-xs">Loading {getAllIds().length} nodes</div>
        </div>
      )}

      {/* React-managed tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border px-3 py-2"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y - 10,
            background: '#0a1628ee',
            borderColor: tooltip.node.color + '60',
            backdropFilter: 'blur(8px)',
            maxWidth: 240,
          }}
        >
          <div className="font-bold text-xs mb-1" style={{ color: tooltip.node.color }}>
            {tooltip.node.icon} {tooltip.node.title}
          </div>
          <div className="text-[11px] text-gray-400 leading-relaxed">
            {tooltip.node.description.slice(0, 110)}{tooltip.node.description.length > 110 ? '…' : ''}
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-16 right-4 flex flex-col gap-1">
        {[
          { label: '+', action: () => svgRef.current && d3.select(svgRef.current).transition().duration(250).call(zoomRef.current!.scaleBy, 1.4) },
          { label: '−', action: () => svgRef.current && d3.select(svgRef.current).transition().duration(250).call(zoomRef.current!.scaleBy, 0.7) },
          { label: '⊡', action: () => {
            if (!svgRef.current || !gRef.current || !zoomRef.current) return
            const svg = d3.select(svgRef.current)
            const g = d3.select(gRef.current)
            fitView(svg, g, zoomRef.current, svgRef.current.clientWidth, svgRef.current.clientHeight)
          }},
        ].map(({ label, action }) => (
          <button key={label} onClick={action}
            className="w-8 h-8 rounded border text-sm font-bold transition-all hover:scale-110"
            style={{ background: '#0a1628', borderColor: '#1e3a5f', color: '#00d4ff' }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
