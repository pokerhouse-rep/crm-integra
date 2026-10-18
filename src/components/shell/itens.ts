import { CalendarDays, Funnel, Home, Settings, Users } from 'lucide-react'

export const ITENS_NAV = [
  { href: '/hoje', rotulo: 'Hoje', icone: Home },
  { href: '/leads', rotulo: 'Leads', icone: Users },
  { href: '/funil', rotulo: 'Funil', icone: Funnel },
  { href: '/agenda', rotulo: 'Agenda', icone: CalendarDays },
  { href: '/config', rotulo: 'Config', icone: Settings },
] as const
