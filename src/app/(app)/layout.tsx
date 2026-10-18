import Image from 'next/image'
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
        </header>
        <main className="p-4 pb-32 md:pb-8">{children}</main>
      </div>
      <BarraInferior />
    </div>
  )
}
