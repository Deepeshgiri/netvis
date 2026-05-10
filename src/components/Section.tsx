import type { ReactNode } from 'react'

interface Props {
  title: string
  color: string
  icon?: string
  children: ReactNode
}

export default function Section({ title, color, icon, children }: Props) {
  return (
    <div
      className="rounded-lg border-2 overflow-hidden"
      style={{ borderColor: color + '40', background: '#0a1628' }}
    >
      <div
        className="px-4 py-3 font-bold text-sm flex items-center gap-2 border-b-2"
        style={{ background: color + '10', borderColor: color + '40', color }}
      >
        {icon && <span className="text-lg">{icon}</span>}
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}
