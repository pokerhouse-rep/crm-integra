'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Plus } from 'lucide-react'
import { ITENS_NAV } from './itens'
import { sair } from '@/app/login/actions'

export function MenuLateral() {
  const caminho = usePathname()
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-marinho p-4 text-white md:flex">
      <Image src="/logo.png" alt="Integra Sistemas" width={160} height={48} className="mb-6 h-auto w-40 rounded bg-white p-2" priority />
      <Link
        href="/leads/novo"
        className="mb-4 flex min-h-11 items-center justify-center gap-1 rounded-lg bg-laranja font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <Plus size={18} aria-hidden /> Lead
      </Link>
      <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1">
        {ITENS_NAV.map(({ href, rotulo, icone: Icone }) => {
          const ativo = caminho === href || caminho.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 focus-visible:outline-2 focus-visible:outline-white ${
                ativo ? 'bg-white/15 font-semibold' : 'hover:bg-white/10'
              }`}
            >
              <Icone size={20} aria-hidden />
              {rotulo}
            </Link>
          )
        })}
      </nav>
      <form action={sair}>
        <button
          type="submit"
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          <LogOut size={20} aria-hidden /> Sair
        </button>
      </form>
    </aside>
  )
}
