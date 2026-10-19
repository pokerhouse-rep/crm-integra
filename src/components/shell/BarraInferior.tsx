'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ITENS_NAV } from './itens'

export function BarraInferior() {
  const caminho = usePathname()
  // O botão flutuante cobre valores em telas densas (ex.: proposta): só em /hoje e na lista de leads.
  const mostrarBotaoLead = caminho === '/hoje' || caminho === '/leads'
  return (
    <>
      {mostrarBotaoLead && (
        <Link
          href="/leads/novo"
          className="fixed right-4 bottom-20 z-30 flex min-h-12 items-center gap-1 rounded-full bg-laranja px-5 font-semibold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marinho md:hidden"
        >
          <Plus size={20} aria-hidden /> Lead
        </Link>
      )}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white md:hidden"
      >
        {ITENS_NAV.filter((i) => i.celular).map(({ href, rotulo, icone: Icone }) => {
          const ativo = caminho === href || caminho.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? 'page' : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-azul ${
                ativo ? 'font-semibold text-marinho' : 'text-slate-500'
              }`}
            >
              <Icone size={22} aria-hidden />
              {rotulo}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
