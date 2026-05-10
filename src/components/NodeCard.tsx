import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { fetchNode, getColor, getIcon, type DataNode } from '../data/dataLoader'
import Badge from './Badge'

interface Props {
  id: string
  index: number
  onClick: (n: DataNode) => void
}

export default function NodeCard({ id, index, onClick }: Props) {
  const [node, setNode] = useState<DataNode | null>(null)

  useEffect(() => {
    fetchNode(id).then(n => { if (n) setNode(n) })
  }, [id])

  if (!node) {
    return (
      <div
        className="rounded-lg border-2 p-3 animate-pulse"
        style={{ background: '#0a1628', borderColor: '#1e3a5f' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded bg-gray-700" />
          <div className="h-3 rounded w-2/3 bg-gray-700" />
        </div>
        <div className="h-2 rounded w-full bg-gray-700 mb-1" />
        <div className="h-2 rounded w-3/4 bg-gray-700" />
      </div>
    )
  }

  const color = getColor(node)
  const icon = getIcon(node)
  const childCount = Array.isArray(node.children) ? (node.children as string[]).length : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      whileHover={{ scale: 1.02 }}
      onClick={() => onClick(node)}
      className="cursor-pointer rounded-lg border-2 p-3 transition-all hover:shadow-lg"
      style={{
        background: '#0a1628',
        borderColor: color + '60',
        boxShadow: `0 0 15px ${color}10`,
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div
          className="text-2xl p-1.5 rounded flex-shrink-0"
          style={{ background: color + '15' }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm mb-1" style={{ color }}>{node.title}</div>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {node.osiLayer && <Badge label={`Layer ${node.osiLayer}`} color={color} />}
            {node.port && <Badge label={`Port ${node.port}`} color={color} />}
            {node.type && <Badge label={node.type} color={color} />}
          </div>
        </div>
        {childCount > 0 && (
          <div
            className="text-xs font-bold px-2 py-1 rounded flex-shrink-0"
            style={{ background: color + '20', color }}
          >
            {childCount}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-2">
        {node.description}
      </p>

      {node.cybersecurity &&
        Array.isArray((node.cybersecurity as Record<string, unknown>).attacks) &&
        ((node.cybersecurity as Record<string, string[]>).attacks).length > 0 && (
          <div
            className="text-[10px] px-2 py-1 rounded inline-block"
            style={{ background: '#ff336620', color: '#ff6688' }}
          >
            ⚠ {((node.cybersecurity as Record<string, string[]>).attacks).length} attack vectors
          </div>
        )}
    </motion.div>
  )
}
