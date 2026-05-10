import { motion } from 'framer-motion'
import type { CategoryNode } from '../data/dataLoader'

interface Props {
  cat: CategoryNode
  index: number
  onClick: () => void
}

export default function CategoryCard({ cat, index, onClick }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className="cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-lg"
      style={{
        background: '#0a1628',
        borderColor: cat.color + '60',
        boxShadow: `0 0 20px ${cat.color}15`,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="text-3xl p-2 rounded" style={{ background: cat.color + '15' }}>
          {cat.icon}
        </div>
        <div className="flex-1">
          <div className="font-bold text-base mb-1" style={{ color: cat.color }}>
            {cat.title}
          </div>
          <div className="text-xs" style={{ color: cat.color + '99' }}>
            {cat.children.length} topics
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed mb-3">{cat.description}</p>

      <div className="flex items-center justify-between text-xs">
        <div className="flex flex-wrap gap-1">
          {cat.children.slice(0, 3).map(c => (
            <span
              key={c}
              className="px-2 py-0.5 rounded text-[10px]"
              style={{ background: cat.color + '20', color: cat.color }}
            >
              {c}
            </span>
          ))}
          {cat.children.length > 3 && (
            <span className="text-gray-600">+{cat.children.length - 3}</span>
          )}
        </div>
        <span className="font-semibold" style={{ color: cat.color }}>→</span>
      </div>
    </motion.div>
  )
}
