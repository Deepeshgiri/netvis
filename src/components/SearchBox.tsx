import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchNode, getAllIds, getColor, getIcon, type DataNode } from '../data/dataLoader'

interface Props {
  onSelect: (node: DataNode) => void
}

export default function SearchBox({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DataNode[]>([])
  const [open, setOpen] = useState(false)
  const [indexReady, setIndexReady] = useState(false)
  const indexRef = useRef<DataNode[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const buildIndex = useCallback(async () => {
    if (indexReady) return
    const ids = getAllIds()
    const nodes = await Promise.all(ids.map(id => fetchNode(id)))
    indexRef.current = nodes.filter(Boolean) as DataNode[]
    setIndexReady(true)
  }, [indexReady])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const q = query.toLowerCase()
    setResults(
      indexRef.current
        .filter(n =>
          n.title.toLowerCase().includes(q) ||
          (n.shortName ?? '').toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          n.id.toLowerCase().includes(q)
        )
        .slice(0, 10)
    )
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (node: DataNode) => {
    setQuery(''); setResults([]); setOpen(false)
    onSelect(node)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto mb-6">
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all"
        style={{ background: '#0a1628', borderColor: open ? '#00d4ff80' : '#1e3a5f' }}
      >
        <span className="text-gray-500 text-sm">🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { setOpen(true); buildIndex() }}
          onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
          placeholder="Search any concept, protocol, attack…"
          className="flex-1 bg-transparent outline-none text-sm text-gray-200 placeholder-gray-600"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]) }} className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
        )}
        {!indexReady && open && (
          <span className="text-[10px] text-gray-600 animate-pulse">indexing…</span>
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 w-full mt-1 rounded-lg border-2 overflow-hidden"
            style={{ background: '#0a1628', borderColor: '#1e3a5f', boxShadow: '0 8px 32px #000a' }}
          >
            {results.map(node => {
              const color = getColor(node)
              return (
                <button
                  key={node.id}
                  onClick={() => handleSelect(node)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors border-b last:border-0"
                  style={{ borderColor: '#1e3a5f' }}
                >
                  <span className="text-lg flex-shrink-0">{getIcon(node)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color }}>{node.title}</div>
                    <div className="text-[11px] text-gray-500 truncate">{node.description}</div>
                  </div>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: color + '20', color }}
                  >
                    {node.type}
                  </span>
                </button>
              )
            })}
          </motion.div>
        )}
        {open && query.trim() && indexReady && results.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute z-50 w-full mt-1 rounded-lg border-2 px-4 py-3 text-sm text-gray-500"
            style={{ background: '#0a1628', borderColor: '#1e3a5f' }}
          >
            No results for "{query}"
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
