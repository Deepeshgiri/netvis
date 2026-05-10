import { useEffect, useRef, useState, useCallback, type Dispatch, type SetStateAction } from 'react'
import * as d3 from 'd3'
import {
  fetchNode,
  getColor,
  getIcon,
  hasChildren,
  loadTopicIndex,
  computeVisibleTopicIds,
  computeExpandedIdsForTarget,
  type DataNode,
  type TopicIndex,
} from '../data/dataLoader'

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
  /** True when this node has children not yet on the board (click to drill). */
  showDrillHint: boolean
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  /** Hierarchy (parent→child) or cybersecurity edges (attack / defense). */
  kind: 'child' | 'attack' | 'defense'
}

/** Keeps the force sim “warm” so nodes drift gently instead of freezing. */
const AMBIENT_ALPHA_TARGET = 0.0042

/**
 * Very soft, phase-offset breeze — each node moves slightly out of sync so the mesh feels organic.
 */
function createSlowWindForce(): d3.Force<GraphNode, undefined> {
  let nodes: GraphNode[] = []
  let t = 0
  const force = ((alpha: number) => {
    t += 0.0022 * (0.35 + alpha)
    const mag = 0.2 * alpha + 0.02
    const vCap = 1.05
    for (const n of nodes) {
      let h = 2166136261
      for (let i = 0; i < n.id.length; i++) h = Math.imul(h ^ n.id.charCodeAt(i), 16777619)
      const phase = (h >>> 0) * 2.328e-10
      let vx = (n.vx ?? 0) + Math.sin(t * 0.55 + phase * 40) * mag
      let vy = (n.vy ?? 0) + Math.cos(t * 0.43 + phase * 55) * mag * 0.88
      vx = Math.max(-vCap, Math.min(vCap, vx))
      vy = Math.max(-vCap, Math.min(vCap, vy))
      n.vx = vx
      n.vy = vy
    }
  }) as d3.Force<GraphNode, undefined>
  force.initialize = (init: GraphNode[]) => {
    nodes = init
  }
  return force
}

/** Edge visuals: hierarchy reads clearly; many cyber edges stay visible but quieter. */
const LINK_STYLE: Record<
  GraphLink['kind'],
  { color: string; width: number; opacity: number; dash?: string }
> = {
  child: { color: '#3b82f6', width: 1.35, opacity: 0.5 },
  attack: { color: '#f87171', width: 0.9, opacity: 0.32 },
  defense: { color: '#4ade80', width: 0.9, opacity: 0.32 },
}

interface Props {
  onNodeClick: (node: DataNode) => void
  highlightId?: string
  /** Nodes the user has “opened” — their children appear on the graph (OSINT-style drill-down). */
  expandedIds: Set<string>
  onExpandedChange: Dispatch<SetStateAction<Set<string>>>
  /** Search / deep-link: reveal this id then clear via onRevealComplete. */
  revealTargetId?: string | null
  onRevealComplete?: () => void
}

interface Tooltip { x: number; y: number; node: GraphNode }

function nodeR(type: string, osiLayer?: number): number {
  if (type === 'model') return 26
  if (type === 'osi-layer') return 22
  if (osiLayer) return 17
  if (type === 'attack' || type === 'defense') return 15
  if (type === 'tool') return 15
  return 13
}

function buildTopicGraphSlice(index: TopicIndex, visible: Set<string>): { nodes: GraphNode[]; links: GraphLink[] } {
  const { byId } = index
  const linkSet = new Set<string>()
  const links: GraphLink[] = []

  const addLink = (src: string, tgt: string, kind: GraphLink['kind']) => {
    if (!visible.has(src) || !visible.has(tgt) || src === tgt) return
    const key = (src < tgt ? src + '|' + tgt : tgt + '|' + src) + kind
    if (linkSet.has(key)) return
    linkSet.add(key)
    links.push({ source: src, target: tgt, kind })
  }

  const degree = new Map<string, number>()
  visible.forEach(id => degree.set(id, 0))
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1)

  byId.forEach(n => {
    if (!visible.has(n.id)) return
    ;(n.children as string[] | undefined)?.forEach(c => {
      if (visible.has(c)) { bump(n.id); bump(c) }
    })
    const cyber = n.cybersecurity as { attacks?: string[]; defenses?: string[] } | undefined
    cyber?.attacks?.forEach(a => { if (visible.has(a)) { bump(n.id); bump(a) } })
    cyber?.defenses?.forEach(def => { if (visible.has(def)) { bump(n.id); bump(def) } })
  })

  const maxDeg = Math.max(...degree.values(), 1)
  const W = window.innerWidth, H = window.innerHeight
  const cx = W / 2, cy = H / 2
  const maxR = Math.min(W, H) * 0.375

  const nodeArr = [...visible].map(id => byId.get(id)!).filter(Boolean)
  const nodes: GraphNode[] = nodeArr.map((n, i) => {
    const deg = degree.get(n.id) ?? 0
    const t = 1 - deg / maxDeg
    const radius = maxR * (0.04 + t * 0.94)
    const angle = (i / Math.max(nodeArr.length, 1)) * 2 * Math.PI + (Math.random() - 0.5) * 0.4
    const ch = (n.children as string[] | undefined) ?? []
    const showDrillHint = ch.length > 0 && ch.some(c => byId.has(c) && !visible.has(c))
    return {
      id: n.id,
      title: n.title,
      shortName: n.shortName ?? n.title.split(/\s+/).slice(0, 3).join(' '),
      type: n.type,
      color: getColor(n),
      icon: getIcon(n),
      osiLayer: n.osiLayer,
      description: n.description,
      r: nodeR(n.type, n.osiLayer),
      showDrillHint,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  })

  nodeArr.forEach(n => {
    if (!visible.has(n.id)) return
    ;(n.children as string[] | undefined)?.forEach(c => addLink(n.id, c, 'child'))
    const cyber = n.cybersecurity as { attacks?: string[]; defenses?: string[] } | undefined
    cyber?.attacks?.forEach(a => addLink(n.id, a, 'attack'))
    cyber?.defenses?.forEach(def => addLink(n.id, def, 'defense'))
  })

  return { nodes, links }
}

export default function GraphView({
  onNodeClick,
  highlightId,
  expandedIds,
  onExpandedChange,
  revealTargetId,
  onRevealComplete,
}: Props) {
  const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const gRef = useRef<SVGGElement | null>(null)
  const nodeElRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null)
  const linkElRef = useRef<d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [ready, setReady] = useState(false)
  const currentZoomRef = useRef(1)
  const boardGenRef = useRef(0)
  const bootedRef = useRef(false)

  useEffect(() => {
    if (!nodeElRef.current) return
    nodeElRef.current.each(function (d) {
      const g = d3.select<SVGGElement, GraphNode>(this)
      const isHl = d.id === highlightId
      g.select<SVGCircleElement>('circle.main')
        .attr('fill', isHl ? d.color + '55' : d.color + '14')
        .attr('stroke-width', isHl ? 2.5 : d.r > 20 ? 1.5 : 1)
        .attr('r', isHl ? d.r + 3 : d.r)
      if (isHl) (this as SVGGElement).parentElement?.appendChild(this)
    })
  }, [highlightId])

  useEffect(() => {
    if (!revealTargetId) return
    let dead = false
    loadTopicIndex().then(ix => {
      if (dead) return
      const add = computeExpandedIdsForTarget(ix, revealTargetId)
      if (add.length) onExpandedChange(prev => new Set([...prev, ...add]))
      onRevealComplete?.()
    })
    return () => { dead = true }
  }, [revealTargetId, onExpandedChange, onRevealComplete])

  const onNodeClickRef = useRef(onNodeClick)
  const onExpandedChangeRef = useRef(onExpandedChange)
  useEffect(() => { onNodeClickRef.current = onNodeClick }, [onNodeClick])
  useEffect(() => { onExpandedChangeRef.current = onExpandedChange }, [onExpandedChange])

  const applyLOD = useCallback((k: number) => {
    if (!nodeElRef.current) return
    currentZoomRef.current = k
    nodeElRef.current.select<SVGTextElement>('text.label')
      .attr('display', d => {
        if (k >= 1.35) return null
        if (k >= 0.88) return d.r >= 17 ? null : 'none'
        if (k >= 0.5) return d.r >= 22 ? null : 'none'
        return 'none'
      })
  }, [])

  const initGraph = useCallback((data: { nodes: GraphNode[]; links: GraphLink[] }) => {
    const myGen = ++boardGenRef.current
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const W = svgRef.current!.clientWidth || window.innerWidth
    const H = svgRef.current!.clientHeight || window.innerHeight

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', e => {
        currentTransformRef.current = e.transform
        // Use gRef so there's no closure TDZ issue
        if (gRef.current) d3.select(gRef.current).attr('transform', e.transform)
        applyLOD(e.transform.k)
      })
    zoomRef.current = zoom
    svg.call(zoom).on('dblclick.zoom', null)

    const g = svg.append('g')
    gRef.current = g.node()

    // Restore saved pan/zoom immediately — no flash, no fit-to-view reset
    if (bootedRef.current) {
      g.attr('transform', currentTransformRef.current.toString())
      svg.call(zoom.transform, currentTransformRef.current)
    }

    const linkEl = g.append('g').attr('class', 'links').style('pointer-events', 'none')
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(data.links).join('line')
      .attr('stroke', d => LINK_STYLE[d.kind].color)
      .attr('stroke-width', d => LINK_STYLE[d.kind].width)
      .attr('stroke-opacity', d => LINK_STYLE[d.kind].opacity)
      .attr('stroke-dasharray', d => LINK_STYLE[d.kind].dash ?? null)
      .attr('stroke-linecap', 'round')
    linkElRef.current = linkEl

    const nodeEl = g.append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(data.nodes, d => d.id).join('g')
      .attr('cursor', 'pointer')

    nodeEl.append('circle').attr('class', 'main')
      .attr('r', d => d.r).attr('fill', d => d.color + '14')
      .attr('stroke', d => d.color).attr('stroke-width', d => d.r > 20 ? 1.5 : 1)

    nodeEl.filter(d => d.showDrillHint).append('circle').attr('class', 'expand-ring')
      .attr('r', d => d.r + 2.1).attr('fill', 'none')
      .attr('stroke', '#ff315c').attr('stroke-opacity', 0.88).attr('stroke-width', 1.6)
      .attr('pointer-events', 'none')

    nodeEl.filter(d => d.showDrillHint).append('circle').attr('class', 'drill-hint')
      .attr('cx', d => d.r * 0.62).attr('cy', d => d.r * 0.62).attr('r', 4)
      .attr('fill', '#ff315c').attr('fill-opacity', 0.9)
      .attr('stroke', '#ff8aa2').attr('stroke-opacity', 0.9).attr('stroke-width', 0.9)
      .attr('pointer-events', 'none')

    nodeEl.append('text').attr('class', 'icon')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', d => Math.round(d.r * 0.78)).attr('y', 0)
      .attr('pointer-events', 'none').text(d => d.icon)

    nodeEl.append('text').attr('class', 'label')
      .attr('text-anchor', 'middle').attr('y', d => d.r + 10)
      .attr('font-size', d => d.r >= 22 ? 9 : 7)
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', '#94a3b8').attr('fill-opacity', 0.88)
      .attr('pointer-events', 'none').text(d => d.shortName)

    nodeElRef.current = nodeEl

    nodeEl
      .on('mouseenter', (event, d) => {
        setTooltip({ x: event.clientX, y: event.clientY, node: d })
        d3.select<SVGGElement, GraphNode>(event.currentTarget)
          .select<SVGCircleElement>('circle.main').attr('fill', d.color + '38').attr('stroke-width', 2.5)
      })
      .on('mousemove', event => setTooltip(t => t ? { ...t, x: event.clientX, y: event.clientY } : null))
      .on('mouseleave', (event, d) => {
        setTooltip(null)
        if (d.id !== highlightId)
          d3.select<SVGGElement, GraphNode>(event.currentTarget)
            .select<SVGCircleElement>('circle.main')
            .attr('fill', d.color + '14').attr('stroke-width', d.r > 20 ? 1.5 : 1)
      })
      .on('click', (_e, d) => {
        setTooltip(null)
        fetchNode(d.id).then(raw => {
          if (!raw) return
          // Only expand if this node has children not yet on the board
          if (d.showDrillHint) {
            onExpandedChangeRef.current(prev => new Set([...prev, d.id]))
          }
          onNodeClickRef.current(raw)
        })
      })

    // ── Simulation ──────────────────────────────────────────────────────────
    const linkDistance = (kind: GraphLink['kind']) => {
      switch (kind) {
        case 'child': return 72
        case 'attack':
        case 'defense': return 96
      }
    }
    const linkStrength = (kind: GraphLink['kind']) => {
      switch (kind) {
        case 'child': return 0.92
        case 'attack':
        case 'defense': return 0.4
      }
    }
    const sim = d3.forceSimulation<GraphNode>(data.nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(data.links)
        .id(d => d.id)
        .distance(d => linkDistance(d.kind))
        .strength(d => linkStrength(d.kind))
        .iterations(2)
      )
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength(d => -(d.r * 42))
        .theta(0.9).distanceMax(560)
      )
      .force('collide', d3.forceCollide<GraphNode>().radius(d => d.r + 13).strength(0.82))
      .force('wind', createSlowWindForce())
      .alphaMin(0.0008)
      .alphaDecay(0.026)
      .velocityDecay(0.38)
      .alphaTarget(0)

    simRef.current = sim

    // ── Neighbor map (for drag: relax local subgraph, pin the rest) ─────────
    const neighborMap = new Map<string, Set<string>>()
    data.nodes.forEach(n => neighborMap.set(n.id, new Set()))
    data.links.forEach(l => {
      const s = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id
      const t = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id
      neighborMap.get(s)?.add(t)
      neighborMap.get(t)?.add(s)
    })

    // ── Drag: direct neighbors pulled with full force,
    //         2nd-degree with reduced force, rest pinned ────────────────────
    nodeEl.call(
      d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          const direct = neighborMap.get(d.id) ?? new Set<string>()
          const second = new Set<string>()
          direct.forEach(nid => neighborMap.get(nid)?.forEach(id => {
            if (id !== d.id && !direct.has(id)) second.add(id)
          }))
          data.nodes.forEach(n => {
            if (n.id === d.id || direct.has(n.id) || second.has(n.id)) {
              n.fx = null; n.fy = null
            } else {
              n.fx = n.x; n.fy = n.y
            }
          })
          d.fx = d.x; d.fy = d.y
          if (!event.active) sim.alphaTarget(0.28).restart()
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(AMBIENT_ALPHA_TARGET).restart()
          data.nodes.forEach(n => { n.fx = null; n.fy = null })
        })
    )

    let ambientArmed = false
    sim.on('tick', () => {
      if (boardGenRef.current !== myGen) return
      if (!ambientArmed && sim.alpha() < 0.055) {
        ambientArmed = true
        sim.alphaTarget(AMBIENT_ALPHA_TARGET)
        setReady(true)
        bootedRef.current = true
        applyLOD(currentZoomRef.current)
      }
      linkEl
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!)
      nodeEl.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    applyLOD(1)
  }, [applyLOD])

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
      zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale)
    )
  }

  const expandedKey = [...expandedIds].sort().join('\0')

  useEffect(() => {
    let cancelled = false
    simRef.current?.stop()
    if (!bootedRef.current) setReady(false)
    ;(async () => {
      const index = await loadTopicIndex()
      if (cancelled) return
      const visible = computeVisibleTopicIds(index, expandedIds)
      const data = buildTopicGraphSlice(index, visible)
      initGraph(data)
    })()
    return () => {
      cancelled = true
      simRef.current?.stop()
    }
  }, [expandedKey, initGraph])

  return (
    <div className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" style={{ background: 'transparent' }} />

      {!ready && !bootedRef.current && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[#00d4ff] text-sm animate-pulse mb-2">Building board…</div>
          <div className="text-slate-600 text-xs max-w-xs text-center">Loading topic map · start with roots, click to drill</div>
        </div>
      )}

      {ready && (
        <details
          className="absolute bottom-[5.5rem] left-4 z-10 max-w-[220px] group rounded-lg border text-left overflow-hidden open:shadow-lg"
          style={{ background: '#0a1628e6', borderColor: '#1e3a5f', backdropFilter: 'blur(8px)' }}
        >
          <summary
            className="cursor-pointer list-none px-2.5 py-1.5 text-[10px] font-medium text-slate-400 hover:text-slate-200 transition-colors select-none [&::-webkit-details-marker]:hidden flex items-center gap-1.5"
          >
            <span className="text-slate-500 group-open:text-[#00d4ff]">Edge key</span>
            <span className="text-[9px] text-slate-600 group-open:rotate-180 transition-transform inline-block">▼</span>
          </summary>
          <div className="px-3 pb-2.5 pt-0 border-t border-slate-800/80 pointer-events-none">
            <ul className="space-y-1.5 text-[10px] text-slate-400 pt-2">
              {(
                [
                  ['child', 'Topic hierarchy'],
                  ['attack', 'Security: attack / threat'],
                  ['defense', 'Security: defense / control'],
                ] as const
              ).map(([kind, label]) => {
                const s = LINK_STYLE[kind]
                return (
                  <li key={kind} className="flex items-center gap-2 leading-tight">
                    <span
                      className="shrink-0 rounded-full w-2.5 h-px"
                      style={{ background: s.color, opacity: Math.min(1, s.opacity + 0.25) }}
                    />
                    <span>{label}</span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-[9px] text-slate-600 leading-snug border-t border-slate-800/60 pt-2">
              Red marker = more to drill. Zoom for labels. Ring color = layer / type.
            </p>
          </div>
        </details>
      )}

      {tooltip && (
        <div className="fixed z-50 pointer-events-none rounded-lg border px-3 py-2"
          style={{
            left: tooltip.x + 14, top: tooltip.y - 10,
            background: '#0a1628ee', borderColor: tooltip.node.color + '60',
            backdropFilter: 'blur(8px)', maxWidth: 240,
          }}>
          <div className="font-bold text-xs mb-1" style={{ color: tooltip.node.color }}>
            {tooltip.node.icon} {tooltip.node.title}
          </div>
          <div className="text-[10px] text-slate-500 leading-relaxed">
            {tooltip.node.description.slice(0, 88)}{tooltip.node.description.length > 88 ? '…' : ''}
          </div>
          {tooltip.node.showDrillHint && (
            <div className="text-[9px] text-rose-400/95 mt-1.5">Click to add sub-topics to the board</div>
          )}
        </div>
      )}

      {ready && expandedIds.size > 0 && (
        <button
          type="button"
          onClick={() => onExpandedChange(new Set())}
          className="absolute bottom-[8.75rem] right-4 z-10 text-[10px] px-2 py-1 rounded border text-slate-500 hover:text-slate-300 transition-colors"
          style={{ background: '#0a1628cc', borderColor: '#1e3a5f88' }}
        >
          Reset board
        </button>
      )}

      <div className="absolute bottom-[5.5rem] right-4 flex flex-col gap-0.5">
        {[
          { label: '+', action: () => svgRef.current && d3.select(svgRef.current).transition().duration(250).call(zoomRef.current!.scaleBy, 1.4) },
          { label: '−', action: () => svgRef.current && d3.select(svgRef.current).transition().duration(250).call(zoomRef.current!.scaleBy, 0.7) },
          { label: '⊡', action: () => {
            if (!svgRef.current || !gRef.current || !zoomRef.current) return
            fitView(d3.select(svgRef.current), d3.select(gRef.current), zoomRef.current, svgRef.current.clientWidth, svgRef.current.clientHeight)
          }},
        ].map(({ label, action }) => (
          <button key={label} onClick={action}
            className="w-7 h-7 rounded border text-xs font-bold transition-opacity hover:opacity-90 opacity-80"
            style={{ background: '#0a1628cc', borderColor: '#1e3a5f88', color: '#00d4ff' }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
