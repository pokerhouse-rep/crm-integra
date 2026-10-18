import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatarDataBR, hojeEmPalmas, inicioDaSemana, somarDias } from '@/lib/dominio/datas'
import { criarClienteServidor } from '@/lib/supabase/server'
import { agendaDaSemana } from '@/lib/servicos/agenda'
import { dataValida } from '@/lib/validacao'
import { SemanaAgenda } from '@/components/agenda/SemanaAgenda'
import { FormTarefa } from '@/components/agenda/FormTarefa'

export const dynamic = 'force-dynamic'

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ inicio?: string | string[] }> }) {
  const { inicio: bruto } = await searchParams
  const hoje = hojeEmPalmas()
  const param = Array.isArray(bruto) ? bruto[0] : bruto
  const inicio = inicioDaSemana(param && dataValida(param) ? param : hoje)
  const fim = somarDias(inicio, 6)

  const semana = await agendaDaSemana(await criarClienteServidor(), inicio)

  const nav =
    'inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-marinho focus-visible:outline-2 focus-visible:outline-azul'

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-marinho">Agenda</h1>
          <p className="text-sm text-slate-600">
            {formatarDataBR(inicio).slice(0, 5)} a {formatarDataBR(fim).slice(0, 5)}
          </p>
        </div>
        <nav aria-label="Navegar entre semanas" className="flex items-center gap-2">
          <Link href={`/agenda?inicio=${somarDias(inicio, -7)}`} className={nav}>
            <ChevronLeft size={18} aria-hidden /> Anterior
          </Link>
          {inicio !== inicioDaSemana(hoje) && (
            <Link href="/agenda" className={nav}>
              Hoje
            </Link>
          )}
          <Link href={`/agenda?inicio=${somarDias(inicio, 7)}`} className={nav}>
            Próxima <ChevronRight size={18} aria-hidden />
          </Link>
        </nav>
      </header>
      <div className="mb-4">
        <FormTarefa hoje={hoje} />
      </div>
      <SemanaAgenda semana={semana} hoje={hoje} />
    </div>
  )
}
