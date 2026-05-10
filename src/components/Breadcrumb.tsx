import { getColor } from '../data/dataLoader'
import type { DataNode, CategoryNode } from '../data/dataLoader'

export type StackEntry =
  | { kind: 'home' }
  | { kind: 'category'; cat: CategoryNode }
  | { kind: 'node'; node: DataNode }

interface Props {
  stack: StackEntry[]
  onJump: (i: number) => void
}

export default function Breadcrumb({ stack, onJump }: Props) {
  return (
    <div
      className="flex items-center gap-2 flex-wrap mb-6 px-4 py-3 rounded-lg border-2"
      style={{ background: '#0a1628', borderColor: '#1e3a5f' }}
    >
      <button
        onClick={() => onJump(-1)}
        className="text-sm font-semibold px-3 py-1.5 rounded transition-all hover:bg-cyan-500/20"
        style={{ color: '#00d4ff' }}
      >
        🏠 Home
      </button>

      {stack.slice(1).map((entry, i) => {
        const label =
          entry.kind === 'category' ? entry.cat.title
          : entry.kind === 'node' ? entry.node.title
          : ''
        const color =
          entry.kind === 'category' ? entry.cat.color
          : entry.kind === 'node' ? getColor(entry.node)
          : '#00d4ff'
        const isLast = i === stack.length - 2
        return (
          <span key={i} className="flex items-center gap-2">
            <span className="text-gray-600">›</span>
            <button
              onClick={() => onJump(i + 1)}
              className="text-sm font-semibold px-3 py-1.5 rounded transition-all hover:bg-gray-700/50"
              style={{ color: isLast ? color : '#6b7280' }}
            >
              {label}
            </button>
          </span>
        )
      })}
    </div>
  )
}
