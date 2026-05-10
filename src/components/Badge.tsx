export default function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[10px] px-2 py-1 rounded font-mono font-semibold"
      style={{ background: color + '15', color, border: `1.5px solid ${color}` }}
    >
      {label}
    </span>
  )
}
