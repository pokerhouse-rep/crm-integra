import { Briefcase, CalendarDays, ChartColumn, Funnel, Home, Settings, Users } from 'lucide-react'

export const ITENS_NAV = [
  { href: '/hoje', rotulo: 'Hoje', icone: Home, celular: true },
  { href: '/leads', rotulo: 'Leads', icone: Users, celular: true },
  { href: '/funil', rotulo: 'Funil', icone: Funnel, celular: true },
  { href: '/agenda', rotulo: 'Agenda', icone: CalendarDays, celular: true },
  { href: '/clientes', rotulo: 'Clientes', icone: Briefcase, celular: true },
  { href: '/relatorios', rotulo: 'Relatórios', icone: ChartColumn, celular: false },
  { href: '/config', rotulo: 'Config', icone: Settings, celular: true },
] as const
