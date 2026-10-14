'use client'

import { useEffect, useState, useTransition } from 'react'
import { lookupMember, joinProgram, type LookupResult } from '@/app/actions/loyalty'
import type { LoyaltyCard, PlanType } from '@/lib/supabase'

interface Props {
  tenant: { id: string; name: string; plan_type: PlanType }
}

type Step = 'phone' | 'join' | 'card'

export default function LoyaltyModal({ tenant }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [needsName, setNeedsName] = useState(true)
  const [card, setCard] = useState<LoyaltyCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const isStamps = tenant.plan_type === 'basic'
  const unit = isStamps ? 'sellos' : 'puntos'
  const balance = card ? (isStamps ? card.stamps : card.points) : 0

  // Bloquea el scroll del fondo mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  function handleResult(r: LookupResult) {
    if (!r.ok) return setError(r.error)
    setError(null)
    if (r.status === 'member') {
      setCard(r.card)
      setStep('card')
    } else {
      setNeedsName(r.needsName)
      setStep('join')
    }
  }

  function onLookup(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => handleResult(await lookupMember(tenant.id, phone)))
  }

  function onJoin(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => handleResult(await joinProgram(tenant.id, phone, name)))
  }

  function reset() {
    setStep('phone')
    setCard(null)
    setName('')
    setError(null)
  }

  return (
    <>
      {/* Botón flotante */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-amber-500/30 transition active:scale-95"
        >
          <span aria-hidden>🎁</span> Mi Tarjeta de Puntos/Sellos
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Mi tarjeta</h2>
                <p className="text-sm text-gray-500">{tenant.name}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {step === 'phone' && (
              <form onSubmit={onLookup} className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Tu número de teléfono
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="6000-0000"
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </label>
                <PrimaryButton pending={pending}>Ver mi tarjeta</PrimaryButton>
              </form>
            )}

            {step === 'join' && (
              <form onSubmit={onJoin} className="space-y-4">
                <p className="text-sm text-gray-600">
                  ¡Aún no estás afiliado! Únete gratis y acumula {unit} en cada visita.
                </p>
                {needsName && (
                  <label className="block text-sm font-medium text-gray-700">
                    Tu nombre
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    />
                  </label>
                )}
                <PrimaryButton pending={pending}>Crear mi tarjeta</PrimaryButton>
                <button type="button" onClick={reset} className="w-full text-sm text-gray-500">
                  Usar otro número
                </button>
              </form>
            )}

            {step === 'card' && card && (
              <div className="space-y-5">
                <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white">
                  <p className="text-sm opacity-90">Hola{card.customerName ? `, ${card.customerName}` : ''} 👋</p>
                  <p className="mt-2 text-5xl font-extrabold">{balance}</p>
                  <p className="text-sm uppercase tracking-wide opacity-90">{unit} acumulados</p>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold text-gray-900">Premios</h3>
                  <RewardList card={card} isStamps={isStamps} balance={balance} unit={unit} />
                </div>

                <button onClick={reset} className="w-full text-sm text-gray-500">
                  Consultar otro número
                </button>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function PrimaryButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-amber-500 py-3 text-base font-semibold text-white transition disabled:opacity-60"
    >
      {pending ? 'Un momento…' : children}
    </button>
  )
}

function RewardList({
  card,
  isStamps,
  balance,
  unit,
}: {
  card: LoyaltyCard
  isStamps: boolean
  balance: number
  unit: string
}) {
  const rewards = card.rewards
    .map((r) => ({ ...r, cost: isStamps ? r.stamps_cost : r.points_cost }))
    .filter((r) => r.cost && r.cost > 0)
    .sort((a, b) => a.cost! - b.cost!)

  if (rewards.length === 0) {
    return <p className="text-sm text-gray-500">Pronto habrá premios disponibles.</p>
  }

  return (
    <ul className="space-y-2">
      {rewards.map((r) => {
        const canRedeem = balance >= r.cost!
        return (
          <li
            key={r.id}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
              canRedeem ? 'border-green-300 bg-green-50' : 'border-gray-200'
            }`}
          >
            <div>
              <p className="font-medium text-gray-900">{r.name}</p>
              <p className="text-xs text-gray-500">
                {r.cost} {unit}
              </p>
            </div>
            {canRedeem ? (
              <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">
                ¡Canjeable!
              </span>
            ) : (
              <span className="text-xs text-gray-500">
                Te faltan {r.cost! - balance}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
