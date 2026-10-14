'use server'

import { getSupabaseAdmin, type LoyaltyCard, type Reward } from '@/lib/supabase'

export type LookupResult =
  | { ok: true; status: 'member'; card: LoyaltyCard }
  | { ok: true; status: 'new'; needsName: boolean }
  | { ok: false; error: string }

function normalizePhone(raw: string) {
  const cleaned = raw.trim().replace(/[^\d+]/g, '')
  const digits = cleaned.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 ? cleaned : null
}

async function buildCard(
  tenantId: string,
  customerName: string | null,
  membership: { stamps_balance: number | null; points_balance: number | null }
): Promise<LoyaltyCard> {
  const db = getSupabaseAdmin()
  const { data } = await db.from('rewards').select('*').eq('tenant_id', tenantId)
  return {
    customerName,
    stamps: membership.stamps_balance ?? 0,
    points: membership.points_balance ?? 0,
    rewards: (data ?? []) as Reward[],
  }
}

/** Busca al cliente por teléfono y su membresía en este comercio. */
export async function lookupMember(tenantId: string, rawPhone: string): Promise<LookupResult> {
  const phone = normalizePhone(rawPhone)
  if (!phone) return { ok: false, error: 'Ingresa un número de teléfono válido.' }

  const db = getSupabaseAdmin()
  const { data: customer, error } = await db
    .from('customers')
    .select('id, name')
    .eq('phone', phone)
    .maybeSingle()
  if (error) return { ok: false, error: 'No pudimos consultar tu tarjeta. Intenta de nuevo.' }
  if (!customer) return { ok: true, status: 'new', needsName: true }

  const { data: membership } = await db
    .from('customer_memberships')
    .select('stamps_balance, points_balance')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customer.id)
    .maybeSingle()
  if (!membership) return { ok: true, status: 'new', needsName: false }

  return { ok: true, status: 'member', card: await buildCard(tenantId, customer.name, membership) }
}

/** Crea el cliente (si no existe) y su membresía en este comercio. */
export async function joinProgram(
  tenantId: string,
  rawPhone: string,
  name: string
): Promise<LookupResult> {
  const phone = normalizePhone(rawPhone)
  if (!phone) return { ok: false, error: 'Ingresa un número de teléfono válido.' }

  const db = getSupabaseAdmin()
  let { data: customer } = await db
    .from('customers')
    .select('id, name')
    .eq('phone', phone)
    .maybeSingle()

  if (!customer) {
    const cleanName = name.trim()
    if (!cleanName) return { ok: false, error: 'Escribe tu nombre para crear tu tarjeta.' }
    const { data: created, error } = await db
      .from('customers')
      .insert({ phone, name: cleanName })
      .select('id, name')
      .single()
    if (error || !created) return { ok: false, error: 'No pudimos crear tu cuenta. Intenta de nuevo.' }
    customer = created
  }

  let { data: membership } = await db
    .from('customer_memberships')
    .select('stamps_balance, points_balance')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customer.id)
    .maybeSingle()

  if (!membership) {
    const { data: createdM, error } = await db
      .from('customer_memberships')
      .insert({
        tenant_id: tenantId,
        customer_id: customer.id,
        stamps_balance: 0,
        points_balance: 0,
      })
      .select('stamps_balance, points_balance')
      .single()
    if (error || !createdM) return { ok: false, error: 'No pudimos afiliarte. Intenta de nuevo.' }
    membership = createdM
  }

  return { ok: true, status: 'member', card: await buildCard(tenantId, customer.name, membership) }
}
