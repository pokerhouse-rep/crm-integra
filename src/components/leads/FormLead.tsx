'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { acaoSalvarLead, type CampoLead, type RespostaSalvarLead, type ValoresLead } from '@/app/(app)/leads/actions'

interface Props {
  /** Ausente = novo lead. */
  leadId?: string
  valoresIniciais: ValoresLead
  nichos: { id: string; nome: string }[]
  origens: { id: string; nome: string }[]
}

const entrada =
  'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul aria-[invalid=true]:border-laranja'

export function FormLead({ leadId, valoresIniciais, nichos, origens }: Props) {
  const [v, setV] = useState<ValoresLead>(valoresIniciais)
  const [resp, setResp] = useState<RespostaSalvarLead>({})
  const [pendente, iniciar] = useTransition()

  function mudar(campo: CampoLead) {
    return (e: { target: { value: string } }) => setV((atual) => ({ ...atual, [campo]: e.target.value }))
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (pendente) return
    setResp({})
    iniciar(async () => {
      const r = await acaoSalvarLead(leadId ?? null, v)
      // sucesso redireciona; só chega aqui com erro
      if (r?.erro) setResp(r)
    })
  }

  function erroDe(campo: CampoLead) {
    return resp.campo === campo ? resp : null
  }

  function aviso(campo: CampoLead) {
    const r = erroDe(campo)
    if (!r) return null
    return (
      <p id={`erro-${campo}`} role="alert" className="mt-1 text-sm text-laranja">
        {r.erro}{' '}
        {r.leadExistenteId && (
          <Link href={`/leads/${r.leadExistenteId}`} className="font-medium text-azul underline">
            Abrir lead existente
          </Link>
        )}
      </p>
    )
  }

  function props(campo: CampoLead) {
    return {
      id: `lead-${campo}`,
      value: v[campo],
      onChange: mudar(campo),
      'aria-invalid': erroDe(campo) ? true : undefined,
      'aria-describedby': erroDe(campo) ? `erro-${campo}` : undefined,
      className: entrada,
    }
  }

  const rotulo = 'block text-sm font-medium text-slate-700'

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <div>
        <label htmlFor="lead-nomeContato" className={rotulo}>
          Nome do contato *
        </label>
        <input {...props('nomeContato')} type="text" autoComplete="off" required />
        {aviso('nomeContato')}
      </div>
      <div>
        <label htmlFor="lead-whatsapp" className={rotulo}>
          WhatsApp *
        </label>
        <input {...props('whatsapp')} type="tel" inputMode="tel" autoComplete="off" placeholder="(63) 99999-0000" required />
        {aviso('whatsapp')}
      </div>
      <div>
        <label htmlFor="lead-empresa" className={rotulo}>
          Empresa
        </label>
        <input {...props('empresa')} type="text" autoComplete="off" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="lead-email" className={rotulo}>
            E-mail
          </label>
          <input {...props('email')} type="email" autoComplete="off" />
          {aviso('email')}
        </div>
        <div>
          <label htmlFor="lead-cidade" className={rotulo}>
            Cidade
          </label>
          <input {...props('cidade')} type="text" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="lead-nichoId" className={rotulo}>
            Nicho
          </label>
          <select {...props('nichoId')}>
            <option value="">Sem nicho</option>
            {nichos.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lead-origemId" className={rotulo}>
            Origem
          </label>
          <select {...props('origemId')}>
            <option value="">Sem origem</option>
            {origens.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="lead-linkMvp" className={rotulo}>
          Link do MVP
        </label>
        <input {...props('linkMvp')} type="url" inputMode="url" autoComplete="off" placeholder="https://" />
        {aviso('linkMvp')}
      </div>
      <div>
        <label htmlFor="lead-observacoes" className={rotulo}>
          Observações
        </label>
        <textarea {...props('observacoes')} rows={3} className={`${entrada} py-2`} />
      </div>

      {resp.erro && !resp.campo && (
        <p role="alert" className="rounded-lg bg-laranja/10 p-3 text-sm text-laranja">
          {resp.erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendente}
          className="min-h-11 flex-1 rounded-lg bg-laranja px-5 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50 md:flex-none"
        >
          {pendente ? 'Salvando…' : leadId ? 'Salvar alterações' : 'Cadastrar lead'}
        </button>
        <Link
          href={leadId ? `/leads/${leadId}` : '/leads'}
          className="flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-5 text-base text-slate-700 focus-visible:outline-2 focus-visible:outline-azul"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
