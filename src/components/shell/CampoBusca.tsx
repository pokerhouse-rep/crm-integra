import { Search } from 'lucide-react'

export function CampoBusca() {
  return (
    <form action="/busca" role="search" className="relative w-full">
      <label htmlFor="busca-global" className="sr-only">
        Buscar lead
      </label>
      <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
      <input
        id="busca-global"
        type="search"
        name="q"
        placeholder="Buscar por nome, empresa ou telefone"
        className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-10 text-base focus-visible:outline-2 focus-visible:outline-azul"
      />
    </form>
  )
}
