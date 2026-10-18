import Image from 'next/image'
import { LogOut } from 'lucide-react'
import { sair } from '../login/actions'
import { BarraInferior } from '@/components/shell/BarraInferior'
import { CampoBusca } from '@/components/shell/CampoBusca'
import { MenuLateral } from '@/components/shell/MenuLateral'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <MenuLateral />
      <div className="md:pl-60">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-slate-50 p-3">
          <Image src="/logo.png" alt="Integra Sistemas" width={96} height={32} className="h-8 w-auto md:hidden" />
          <CampoBusca />
          {/* No celular o "Sair" fica aqui até a tela /config existir; no PC fica no menu lateral. */}
          <form action={sair} className="md:hidden">
            <button
              type="submit"
              aria-label="Sair"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-azul"
            >
              <LogOut size={20} aria-hidden />
            </button>
          </form>
        </header>
        <main className="p-4 pb-32 md:pb-8">{children}</main>
      </div>
      <BarraInferior />
    </div>
  )
}
