export interface DataNode {
  id: string
  title: string
  shortName?: string
  type: string
  osiLayer?: number
  category: string
  description: string
  fullExplanation?: string
  icon?: string
  color?: string
  port?: number | null
  transport?: string | string[]
  keyFacts?: string[]
  children?: string[]        // IDs of child nodes
  parent?: string
  relatedConcepts?: string[]
  cybersecurity?: {
    attacks?: string[]
    defenses?: string[]
  }
  usedBy?: string[]
  dependsOn?: string[]
  visualization?: {
    color: string
    icon: string
    nodeType: 'expandable' | 'leaf'
  }
  // protocol-specific
  header?: { size: string; fields: HeaderField[] }
  versions?: { version: string; year?: number; status?: string; feature?: string }[]
  steps?: Step[]
  types?: Record<string, unknown>[]
  // raw data passthrough
  [key: string]: unknown
}

export interface HeaderField {
  name: string
  bits: number
  description: string
  example: string
}

export interface Step {
  step: number
  name?: string
  action?: string
  description: string
  direction?: string
}

export interface CategoryNode {
  id: string
  title: string
  icon: string
  color: string
  description: string
  children: string[]
  subcategories?: string[]
}

// ── File registry: id → public path ─────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
const FILE_MAP: Record<string, string> = {
  // core
  'osi-model':          '/data/core/osi-model.json',
  'tcp-ip-model':       '/data/core/tcp-ip-model.json',
  'internet':           '/data/core/internet.json',
  'tcpip-application':  '/data/core/tcpip-application.json',
  'tcpip-transport':    '/data/core/tcpip-transport.json',
  'tcpip-internet':     '/data/core/tcpip-internet.json',
  'tcpip-link':         '/data/core/tcpip-link.json',
  // layer indices
  'layer1-physical':    '/data/osi/layer1-physical/physical-layer.json',
  'layer2-datalink':    '/data/osi/layer2-datalink/layer2-datalink.json',
  'layer3-network':     '/data/osi/layer3-network/layer3-network.json',
  'layer4-transport':   '/data/osi/layer4-transport/layer4-transport.json',
  'layer5-session':     '/data/osi/layer5-session/layer5-session.json',
  'layer6-presentation':'/data/osi/layer6-presentation/layer6-presentation.json',
  'layer7-application': '/data/osi/layer7-application/layer7-application.json',
  // layer 1 - physical media & concepts
  'cables':             '/data/osi/layer1-physical/cables.json',
  'wireless':           '/data/osi/layer1-physical/wireless.json',
  'fiber':              '/data/osi/layer1-physical/fiber.json',
  'signals':            '/data/osi/layer1-physical/signals.json',
  'modulation':         '/data/osi/layer1-physical/modulation.json',
  'repeaters':          '/data/osi/layer1-physical/repeaters.json',
  'hubs':               '/data/osi/layer1-physical/hubs.json',
  'rj45-connector':     '/data/osi/layer1-physical/rj45-connector.json',
  'signal-encoding':    '/data/osi/layer1-physical/signal-encoding.json',
  'poe':                '/data/osi/layer1-physical/poe.json',
  'wifi-security':      '/data/osi/layer1-physical/wifi-security.json',
  'ofdm-modulation':    '/data/osi/layer1-physical/ofdm-modulation.json',
  'wifi-channels':      '/data/osi/layer1-physical/wifi-channels.json',
  'wifi-hardware':      '/data/osi/layer1-physical/wifi-hardware.json',
  // layer 2
  'ethernet':           '/data/osi/layer2-datalink/ethernet.json',
  'ethernet-frame':     '/data/osi/layer2-datalink/ethernet.json',
  'arp':                '/data/osi/layer2-datalink/arp.json',
  'mac-addresses':      '/data/osi/layer2-datalink/mac-addresses.json',
  'vlans':              '/data/osi/layer2-datalink/vlans.json',
  'switching':          '/data/osi/layer2-datalink/switching.json',
  'stp':                '/data/osi/layer2-datalink/stp.json',
  'gratuitous-arp':     '/data/osi/layer2-datalink/gratuitous-arp.json',
  'proxy-arp':          '/data/osi/layer2-datalink/proxy-arp.json',
  // layer 3
  'ipv4':               '/data/osi/layer3-network/ipv4.json',
  'bgp':                '/data/osi/layer3-network/bgp.json',
  'ospf':               '/data/osi/layer3-network/ospf.json',
  'subnetting':         '/data/osi/layer3-network/subnetting.json',
  'icmp':               '/data/osi/layer3-network/icmp.json',
  'ipv6':               '/data/osi/layer3-network/ipv6.json',
  'nat':                '/data/osi/layer3-network/nat.json',
  'fragmentation':      '/data/osi/layer3-network/fragmentation.json',
  'bgp-routing':        '/data/osi/layer3-network/bgp-routing.json',
  'bgp-security':       '/data/osi/layer3-network/bgp-security.json',
  'ospf-areas':         '/data/osi/layer3-network/ospf-areas.json',
  'ospf-adjacency':     '/data/osi/layer3-network/ospf-adjacency.json',
  'ospf-lsa':           '/data/osi/layer3-network/ospf-lsa.json',
  'dr-bdr-election':    '/data/osi/layer3-network/dr-bdr-election.json',
  // layer 4
  'tcp':                '/data/osi/layer4-transport/tcp.json',
  'tcp-handshake':      '/data/osi/layer4-transport/tcp-handshake.json',
  'udp':                '/data/osi/layer4-transport/udp.json',
  'tcp-flags':          '/data/osi/layer4-transport/tcp-flags.json',
  'tcp-flow-control':   '/data/osi/layer4-transport/tcp-flow-control.json',
  'tcp-congestion-control': '/data/osi/layer4-transport/tcp-congestion-control.json',
  'retransmission':     '/data/osi/layer4-transport/retransmission.json',
  'sockets':            '/data/osi/layer4-transport/sockets.json',
  'quic':               '/data/osi/layer4-transport/quic.json',
  'rtp':                '/data/osi/layer4-transport/rtp.json',
  // layer 5
  'netbios':            '/data/osi/layer5-session/netbios.json',
  'smb':                '/data/osi/layer5-session/smb.json',
  'pptp':               '/data/osi/layer5-session/pptp.json',
  'rpc':                '/data/osi/layer5-session/rpc.json',
  // layer 6
  'tls':                '/data/osi/layer6-presentation/tls.json',
  'certificates':       '/data/osi/layer6-presentation/certificates.json',
  'cipher-suites':      '/data/osi/layer6-presentation/cipher-suites.json',
  'tls-handshake':      '/data/osi/layer6-presentation/tls-handshake.json',
  'certificate-transparency': '/data/osi/layer6-presentation/certificate-transparency.json',
  // layer 7
  'http':               '/data/osi/layer7-application/http.json',
  'https':              '/data/osi/layer7-application/https.json',
  'dns':                '/data/osi/layer7-application/dns.json',
  'ssh':                '/data/osi/layer7-application/ssh.json',
  'dhcp':               '/data/osi/layer7-application/dhcp.json',
  'smtp':               '/data/osi/layer7-application/smtp.json',
  'ftp':                '/data/osi/layer7-application/ftp.json',
  'snmp':               '/data/osi/layer7-application/snmp.json',
  'ntp':                '/data/osi/layer7-application/ntp.json',
  'dnssec':             '/data/osi/layer7-application/dnssec.json',
  'dns-resolution-flow':'/data/osi/layer7-application/dns-resolution-flow.json',
  'dns-security':       '/data/osi/layer7-application/dns-security.json',
  'doh-dot':            '/data/osi/layer7-application/doh-dot.json',
  'ssh-key-auth':       '/data/osi/layer7-application/ssh-key-auth.json',
  'ssh-tunneling':      '/data/osi/layer7-application/ssh-tunneling.json',
  'ssh-hardening':      '/data/osi/layer7-application/ssh-hardening.json',
  // hardware
  'nic':                '/data/hardware/nic.json',
  'dma':                '/data/hardware/dma.json',
  'interrupts':         '/data/hardware/interrupts.json',
  'pcie':               '/data/hardware/pcie.json',
  'ring-buffer':        '/data/hardware/ring-buffer.json',
  // cybersecurity categories
  'attacks':            '/data/cybersecurity/attacks.json',
  'defenses':           '/data/cybersecurity/defenses.json',
  'tools':              '/data/cybersecurity/tools.json',
  // attacks
  'arp-spoofing':       '/data/cybersecurity/attacks/arp-spoofing.json',
  'syn-flood':          '/data/cybersecurity/attacks/syn-flood.json',
  'dns-poisoning':      '/data/cybersecurity/attacks/dns-poisoning.json',
  'xss':                '/data/cybersecurity/attacks/xss.json',
  'csrf':               '/data/cybersecurity/attacks/csrf.json',
  'mitm':               '/data/cybersecurity/attacks/mitm.json',
  'ssl-stripping':      '/data/cybersecurity/attacks/ssl-stripping.json',
  'phishing':           '/data/cybersecurity/attacks/phishing.json',
  'buffer-overflow':    '/data/cybersecurity/attacks/buffer-overflow.json',
  'ransomware':         '/data/cybersecurity/attacks/ransomware.json',
  'brute-force':        '/data/cybersecurity/attacks/brute-force.json',
  'ssrf':               '/data/cybersecurity/attacks/ssrf.json',
  'ddos':               '/data/cybersecurity/attacks/ddos.json',
  'sql-injection':      '/data/cybersecurity/attacks/sql-injection.json',
  'session-hijacking':  '/data/cybersecurity/attacks/session-hijacking.json',
  'supply-chain-attack':'/data/cybersecurity/attacks/supply-chain-attack.json',
  'path-traversal':     '/data/cybersecurity/attacks/path-traversal.json',
  // defenses
  'firewall':           '/data/cybersecurity/defenses/firewall.json',
  'zero-trust':         '/data/cybersecurity/defenses/zero-trust.json',
  'ids-ips':            '/data/cybersecurity/defenses/ids-ips.json',
  'vpn':                '/data/cybersecurity/defenses/vpn.json',
  'hsts':               '/data/cybersecurity/defenses/hsts.json',
  'iptables':           '/data/cybersecurity/defenses/iptables.json',
  'ngfw':               '/data/cybersecurity/defenses/ngfw.json',
  'waf':                '/data/cybersecurity/defenses/waf.json',
  'firewall-rules':     '/data/cybersecurity/defenses/firewall-rules.json',
  'dmz':                '/data/cybersecurity/defenses/dmz.json',
  'microsegmentation':  '/data/cybersecurity/defenses/microsegmentation.json',
  'ztna':               '/data/cybersecurity/defenses/ztna.json',
  'identity-verification': '/data/cybersecurity/defenses/identity-verification.json',
  'device-trust':       '/data/cybersecurity/defenses/device-trust.json',
  // tools
  'wireshark':          '/data/cybersecurity/tools/wireshark.json',
  'nmap':               '/data/cybersecurity/tools/nmap.json',
  'tshark':             '/data/cybersecurity/tools/tshark.json',
  'wireshark-filters':  '/data/cybersecurity/tools/wireshark-filters.json',
  'wireshark-tls-decrypt': '/data/cybersecurity/tools/wireshark-tls-decrypt.json',
  'nmap-nse':           '/data/cybersecurity/tools/nmap-nse.json',
  'nmap-os-detection':  '/data/cybersecurity/tools/nmap-os-detection.json',
  'nmap-firewall-evasion': '/data/cybersecurity/tools/nmap-firewall-evasion.json',
  'sqlmap':             '/data/cybersecurity/tools/sqlmap.json',
  'hashcat':            '/data/cybersecurity/tools/hashcat.json',
  'netcat':             '/data/cybersecurity/tools/netcat.json',
  'tcpdump':            '/data/cybersecurity/tools/tcpdump.json',
  'aircrack-ng':        '/data/cybersecurity/tools/aircrack-ng.json',
  'burpsuite':          '/data/cybersecurity/tools/burpsuite.json',
  'metasploit':         '/data/cybersecurity/tools/metasploit.json',
  'hydra':              '/data/cybersecurity/tools/hydra.json',
}

const cache = new Map<string, DataNode>()

export async function fetchNode(id: string): Promise<DataNode | null> {
  if (cache.has(id)) return cache.get(id)!
  const path = FILE_MAP[id]
  if (!path) return null
  try {
    const res = await fetch(BASE + path)
    if (!res.ok) return null
    const data: DataNode = await res.json()
    cache.set(id, data)
    return data
  } catch {
    return null
  }
}

export async function fetchCategories(): Promise<CategoryNode[]> {
  try {
    const res = await fetch(BASE + '/data/metadata/categories.json')
    const data = await res.json()
    return data.categories as CategoryNode[]
  } catch {
    return []
  }
}

export function getColor(node: DataNode): string {
  if (node.visualization?.color) return node.visualization.color
  const layerColors: Record<number, string> = {
    1: '#ff6b35',
    2: '#ffcc00',
    3: '#00d4ff',
    4: '#34d399',
    5: '#8b5cf6',
    6: '#fb7185',
    7: '#38bdf8',
  }
  if (node.osiLayer) return layerColors[node.osiLayer] || '#00d4ff'
  const typeColors: Record<string, string> = {
    attack: '#ff3366', defense: '#00ff88', tool: '#ffcc00',
    hardware: '#ff6b35', protocol: '#00d4ff', model: '#8b5cf6',
  }
  return typeColors[node.type] || '#00d4ff'
}

export function getIcon(node: DataNode): string {
  if (node.visualization?.icon) return node.visualization.icon
  const icons: Record<string, string> = {
    attack: '⚔️', defense: '🛡️', tool: '🛠️', hardware: '🔲',
    protocol: '📡', model: '📚', concept: '💡', process: '⚙️',
  }
  return icons[node.type] || '📄'
}

export function getAllIds(): string[] {
  return Object.keys(FILE_MAP)
}

export function hasChildren(node: DataNode): boolean {
  return Array.isArray(node.children) && node.children.length > 0
}

/** Full topic map + hierarchy roots (nodes no other node lists as a child). */
export interface TopicIndex {
  byId: Map<string, DataNode>
  roots: string[]
}

let topicIndexCache: TopicIndex | null = null

/** Loads every JSON node once; reused for progressive graph + search reveal. */
export async function loadTopicIndex(): Promise<TopicIndex> {
  if (topicIndexCache) return topicIndexCache
  const ids = getAllIds()
  const raw = await Promise.all(ids.map(id => fetchNode(id)))
  const byId = new Map<string, DataNode>()
  raw.forEach(n => {
    if (n) byId.set(n.id, n)
  })
  const hasParent = new Set<string>()
  byId.forEach(n => {
    ;(n.children as string[] | undefined)?.forEach(c => {
      if (byId.has(c)) hasParent.add(c)
    })
  })
  const roots = [...byId.keys()].filter(id => !hasParent.has(id)).sort()
  topicIndexCache = { byId, roots }
  return topicIndexCache
}

/** Visible topic ids: all roots plus, iteratively, children of any expanded node. */
export function computeVisibleTopicIds(
  index: TopicIndex,
  expanded: ReadonlySet<string>
): Set<string> {
  const { byId, roots } = index
  const V = new Set<string>(roots)
  let added = true
  while (added) {
    added = false
    for (const id of expanded) {
      if (!V.has(id)) continue
      const ch = (byId.get(id)?.children as string[] | undefined) ?? []
      for (const c of ch) {
        if (byId.has(c) && !V.has(c)) {
          V.add(c)
          added = true
        }
      }
    }
  }
  return V
}

/**
 * Ids to add to `expanded` so `targetId` becomes visible (all ancestors on a root path, excluding target).
 * Uses BFS from roots over child edges; falls back to `parent` chain if disconnected.
 */
export function computeExpandedIdsForTarget(index: TopicIndex, targetId: string): string[] {
  const { byId, roots } = index
  if (!byId.has(targetId)) return []
  const rootSet = new Set(roots)
  if (rootSet.has(targetId)) return []

  const prev = new Map<string, string | null>()
  const q: string[] = []
  for (const r of roots) {
    if (prev.has(r)) continue
    prev.set(r, null)
    q.push(r)
  }
  let qi = 0
  let found = false
  while (qi < q.length) {
    const id = q[qi++]
    if (id === targetId) {
      found = true
      break
    }
    const ch = (byId.get(id)?.children as string[] | undefined) ?? []
    for (const c of ch) {
      if (!byId.has(c) || prev.has(c)) continue
      prev.set(c, id)
      q.push(c)
    }
  }

  if (!found) {
    const chain: string[] = []
    let cur: string | undefined = targetId
    const seen = new Set<string>()
    while (cur && byId.has(cur) && !seen.has(cur)) {
      seen.add(cur)
      chain.push(cur)
      const p = byId.get(cur)?.parent as string | undefined
      cur = p && byId.has(p) ? p : undefined
    }
    chain.reverse()
    if (chain.length <= 1) return []
    return chain.slice(0, -1)
  }

  const path: string[] = []
  let cur: string | null = targetId
  while (cur !== null) {
    path.push(cur)
    cur = prev.get(cur) ?? null
  }
  path.reverse()
  return path.slice(0, -1)
}
