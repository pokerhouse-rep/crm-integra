import { sair } from '../login/actions'

// Layout temporário: será substituído pela navegação definitiva.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between bg-marinho px-4 py-2 text-white">
        <span className="font-semibold">CRM Integra</span>
        <form action={sair}>
          <button type="submit" className="min-h-11 rounded-lg px-3 text-sm hover:bg-white/10">
            Sair
          </button>
        </form>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}