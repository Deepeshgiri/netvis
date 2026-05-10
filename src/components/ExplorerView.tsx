import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchNode, fetchCategories, getColor, getIcon, hasChildren, type DataNode, type CategoryNode } from '../data/dataLoader'
import GraphView from './GraphView'
import NodeDetail from './NodeDetail'
import NodeCard from './NodeCard'
import Breadcrumb, { type StackEntry } from './Breadcrumb'
import SearchBox from './SearchBox'

export type { StackEntry }

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
      {children}
    </div>
  )
}

export default function ExplorerView() {
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [stack, setStack] = useState<StackEntry[]>([{ kind: 'home' }])
  const [loading, setLoading] = useState(false)
  const [detailNode, setDetailNode] = useState<DataNode | null>(null)
  const [highlightId, setHighlightId] = useState<string | undefined>()

  useEffect(() => { fetchCategories().then(setCategories) }, [])

  const current = stack[stack.length - 1]

  const pushNode = useCallback(async (node: DataNode) => {
    if (hasChildren(node)) {
      setStack(s => [...s, { kind: 'node', node }])
      setDetailNode(null)
    } else {
      setLoading(true)
      const full = await fetchNode(node.id)
      setLoading(false)
      const resolved = full || node
      setStack(s => [...s, { kind: 'node', node: resolved }])
      setDetailNode(resolved)
    }
  }, [])

  const jumpTo = useCallback((i: number) => {
    if (i === -1) {
      setStack([{ kind: 'home' }])
      setDetailNode(null)
    } else {
      setStack(s => {
        const next = s.slice(0, i + 1)
        const entry = next[next.length - 1]
        if (entry.kind === 'node' && !hasChildren(entry.node)) {
          setDetailNode(entry.node)
        } else {
          setDetailNode(null)
        }
        return next
      })
    }
  }, [])

  // Graph node click — highlight + open detail panel without changing stack
  const handleGraphClick = useCallback(async (node: DataNode) => {
    setHighlightId(node.id)
    const full = await fetchNode(node.id)
    setDetailNode(full || node)
  }, [])

  const closeDetail = useCallback(() => {
    setDetailNode(null)
    setHighlightId(undefined)
  }, [])

  const isHome = current.kind === 'home'

  return (
    <div
      className="h-full w-full flex flex-col overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 20% 10%, #020d1a 0%, #020408 100%)' }}
    >
      {/* Tooltip div for graph hover */}
      <div
        id="graph-tooltip"
        style={{
          position: 'fixed', pointerEvents: 'none', zIndex: 9999,
          background: '#0a1628', border: '1.5px solid #1e3a5f',
          borderRadius: 8, padding: '8px 12px', display: 'none',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
        }}
      />

      {/* Top bar */}
      <div className="flex-shrink-0 px-6 pt-5 pb-3 flex items-center gap-4 border-b border-[#1e3a5f]"
        style={{ background: '#020d1aee', backdropFilter: 'blur(8px)' }}>
        <div className="text-lg font-bold text-[#00d4ff] tracking-tight whitespace-nowrap">🌐 NetVis</div>
        <div className="flex-1">
          <SearchBox onSelect={node => {
            setHighlightId(node.id)
            setDetailNode(node)
          }} />
        </div>
        {!isHome && (
          <button
            onClick={() => { setStack([{ kind: 'home' }]); setDetailNode(null) }}
            className="text-xs px-3 py-1.5 rounded border border-[#1e3a5f] text-gray-400 hover:text-[#00d4ff] hover:border-[#00d4ff40] transition-all whitespace-nowrap"
          >
            🏠 Home
          </button>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Graph — always visible on home, hidden when drilling into category/node grid */}
        {isHome && (
          <div className="flex-1 relative overflow-hidden">
            <GraphView onNodeClick={handleGraphClick} highlightId={highlightId} />

            {/* Home overlay hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-gray-600 pointer-events-none">
              Drag to pan · Scroll to zoom · Click any node to explore
            </div>
          </div>
        )}

        {/* Category / node grid view */}
        {!isHome && (
          <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarWidth: 'thin' }}>
            <Breadcrumb stack={stack} onJump={jumpTo} />

            <AnimatePresence mode="wait">
              {current.kind === 'category' && (
                <motion.div key={current.cat.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                  <div className="mb-6 px-4 py-4 rounded-lg border-2"
                    style={{ background: '#0a1628', borderColor: current.cat.color + '60' }}>
                    <div className="text-2xl font-bold mb-2 flex items-center gap-2" style={{ color: current.cat.color }}>
                      <span className="text-3xl">{current.cat.icon}</span>
                      {current.cat.title}
                    </div>
                    <p className="text-sm text-gray-400 mb-1">{current.cat.description}</p>
                    <div className="text-xs text-gray-500">{current.cat.children.length} topics — click any to explore deeper</div>
                  </div>
                  {loading
                    ? <div className="flex justify-center py-20 text-gray-500">Loading…</div>
                    : <CardGrid>
                        {current.cat.children.map((id, i) => (
                          <NodeCard key={id} id={id} index={i} onClick={pushNode} />
                        ))}
                      </CardGrid>
                  }
                </motion.div>
              )}

              {current.kind === 'node' && hasChildren(current.node) && (
                <motion.div key={current.node.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                  <div className="mb-6 px-4 py-4 rounded-lg border-2"
                    style={{ background: '#0a1628', borderColor: getColor(current.node) + '60' }}>
                    <div className="text-2xl font-bold mb-2 flex items-center gap-2" style={{ color: getColor(current.node) }}>
                      <span className="text-3xl">{getIcon(current.node)}</span>
                      {current.node.title}
                    </div>
                    <p className="text-sm text-gray-400 mb-1">{current.node.description}</p>
                    <div className="text-xs text-gray-500">
                      {(current.node.children as string[]).length} sub-topics — click any to explore deeper
                    </div>
                  </div>
                  {loading
                    ? <div className="flex justify-center py-20 text-gray-500">Loading…</div>
                    : <CardGrid>
                        {(current.node.children as string[]).map((id, i) => (
                          <NodeCard key={id} id={id} index={i} onClick={pushNode} />
                        ))}
                      </CardGrid>
                  }
                </motion.div>
              )}

              {current.kind === 'node' && !hasChildren(current.node) && detailNode && (
                <motion.div key={current.node.id + '-detail'} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                  <NodeDetail node={detailNode} pushNode={pushNode} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Slide-in detail panel (graph mode) */}
        <AnimatePresence>
          {isHome && detailNode && (
            <motion.div
              key={detailNode.id}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="absolute right-0 top-0 h-full overflow-y-auto border-l border-[#1e3a5f] z-20"
              style={{
                width: 'min(520px, 90vw)',
                background: '#020d1af5',
                backdropFilter: 'blur(12px)',
                scrollbarWidth: 'thin',
              }}
            >
              {/* Panel header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-[#1e3a5f]"
                style={{ background: '#020d1aee', backdropFilter: 'blur(8px)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getIcon(detailNode)}</span>
                  <span className="font-bold text-sm" style={{ color: getColor(detailNode) }}>
                    {detailNode.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasChildren(detailNode) && (
                    <button
                      onClick={() => pushNode(detailNode)}
                      className="text-xs px-3 py-1.5 rounded border transition-all"
                      style={{ borderColor: getColor(detailNode) + '60', color: getColor(detailNode) }}
                    >
                      Explore →
                    </button>
                  )}
                  <button onClick={closeDetail} className="text-gray-500 hover:text-gray-300 text-lg leading-none px-1">✕</button>
                </div>
              </div>

              <div className="p-5">
                <NodeDetail node={detailNode} pushNode={pushNode} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Home category grid overlay (bottom strip) */}
        {isHome && !detailNode && categories.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-[#1e3a5f]"
            style={{ background: 'linear-gradient(to top, #020408 60%, transparent)', pointerEvents: 'none' }}>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ pointerEvents: 'auto', scrollbarWidth: 'none' }}>
              {categories.map((cat, i) => (
                <button
                  key={cat.id}
                  onClick={() => setStack(s => [...s, { kind: 'category', cat }])}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: cat.color + '12', borderColor: cat.color + '50', color: cat.color }}
                >
                  <span>{cat.icon}</span>
                  {cat.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
