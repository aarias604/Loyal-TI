import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local')
}

/** Cliente público (anon key). Solo lectura del menú; respeta RLS. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Cliente con service role. SOLO usar en servidor (Server Components,
 * Server Actions, Route Handlers). Salta RLS: nunca lo importes en un
 * componente 'use client'.
 */
export function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en .env.local')
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------- Tipos ----------
export type PlanType = 'basic' | 'premium'

export interface Tenant {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan_type: PlanType
}

export interface Category {
  id: string
  tenant_id: string
  name: string
  display_order: number | null
}

export interface MenuItem {
  id: string
  tenant_id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
}

export interface Reward {
  id: string
  tenant_id: string
  name: string
  points_cost: number | null
  stamps_cost: number | null
}

export interface LoyaltyCard {
  customerName: string | null
  stamps: number
  points: number
  rewards: Reward[]
}
