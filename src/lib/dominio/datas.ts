export type DataISO = string // 'YYYY-MM-DD'

const MS_DIA = 86_400_000

function paraUTC(data: DataISO): Date {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

function deUTC(d: Date): DataISO {
  return d.toISOString().slice(0, 10)
}

export function hojeEmPalmas(agora: Date = new Date()): DataISO {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Araguaina',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}

export function somarDias(data: DataISO, dias: number): DataISO {
  return deUTC(new Date(paraUTC(data).getTime() + dias * MS_DIA))
}

export function ajustarFimDeSemana(data: DataISO): DataISO {
  const dia = paraUTC(data).getUTCDay()
  if (dia === 6) return somarDias(data, 2)
  if (dia === 0) return somarDias(data, 1)
  return data
}

export function agendarPrazo(base: DataISO, dias: number): DataISO {
  return ajustarFimDeSemana(somarDias(base, dias))
}

export function formatarDataBR(data: DataISO): string {
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}

export function inicioDaSemana(data: DataISO): DataISO {
  const dia = paraUTC(data).getUTCDay()
  return somarDias(data, -((dia + 6) % 7))
}
