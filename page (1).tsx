import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { getSupabaseAdmin, type Category, type MenuItem, type PlanType, type Tenant } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const money = new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' })

// ---------- Server Actions (corren en el servidor con service role) ----------
async function createCategory(formData: FormData) {
  'use server'
  const tenantId = String(formData.get('tenant_id'))
  const name = String(formData.get('name') ?? '').trim()
  if (!tenantId || !name) return
  const db = getSupabaseAdmin()
  const { count } = await db
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  await db.from('categories').insert({ tenant_id: tenantId, name, display_order: (count ?? 0) + 1 })
  revalidatePath('/admin')
}

async function createItem(formData: FormData) {
  'use server'
  const tenantId = String(formData.get('tenant_id'))
  const slug = String(formData.get('slug'))
  const name = String(formData.get('name') ?? '').trim()
  const price = Number(formData.get('price'))
  const categoryId = String(formData.get('category_id') ?? '')
  if (!tenantId || !name || !Number.isFinite(price) || price < 0) return

  await getSupabaseAdmin()
    .from('menu_items')
    .insert({
      tenant_id: tenantId,
      category_id: categoryId || null,
      name,
      description: String(formData.get('description') ?? '').trim() || null,
      price,
      is_available: true,
    })
  revalidatePath('/admin')
  revalidatePath(`/${slug}`)
}

async function setPlan(formData: FormData) {
  'use server'
  const tenantId = String(formData.get('tenant_id'))
  const slug = String(formData.get('slug'))
  const plan = String(formData.get('plan_type'))
  if (!tenantId || (plan !== 'basic' && plan !== 'premium')) return
  await getSupabaseAdmin().from('tenants').update({ plan_type: plan }).eq('id', tenantId)
  revalidatePath('/admin')
  revalidatePath(`/${slug}`)
}

// ---------- Página ----------
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>
}) {
  const { tenant: tenantSlug } = await searchParams
  const db = getSupabaseAdmin()

  const { data: tenantRows } = await db.from('tenants').select('*').order('name')
  const tenants = (tenantRows ?? []) as Tenant[]
  const tenant = tenants.find((t) => t.slug === tenantSlug) ?? tenants[0]

  if (!tenant) {
    return <main className="p-6 text-gray-600">No hay comercios creados en la tabla tenants.</main>
  }

  const [{ data: cats }, { data: menu }] = await Promise.all([
    db.from('categories').select('*').eq('tenant_id', tenant.id).order('display_order'),
    db.from('menu_items').select('*').eq('tenant_id', tenant.id).order('name'),
  ])
  const categories = (cats ?? []) as Category[]
  const items = (menu ?? []) as MenuItem[]
  const catName = new Map(categories.map((c) => [c.id, c.name]))

  const isPremium = tenant.plan_type === 'premium'
  const nextPlan: PlanType = isPremium ? 'basic' : 'premium'
  const input =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200'

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel · {tenant.name}</h1>
          <Link href={`/${tenant.slug}`} className="text-sm text-amber-600 underline">
            Ver menú público
          </Link>
        </div>
        {tenants.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {tenants.map((t) => (
              <Link
                key={t.id}
                href={`/admin?tenant=${t.slug}`}
                className={`rounded-full px-3 py-1 text-sm ${
                  t.id === tenant.id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Toggle de plan */}
      <section className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="font-semibold text-gray-900">Programa de lealtad</h2>
          <p className="text-sm text-gray-500">
            Plan actual: <strong>{isPremium ? 'Premium (puntos)' : 'Básico (sellos)'}</strong>
          </p>
        </div>
        <form action={setPlan}>
          <input type="hidden" name="tenant_id" value={tenant.id} />
          <input type="hidden" name="slug" value={tenant.slug} />
          <input type="hidden" name="plan_type" value={nextPlan} />
          <button
            type="submit"
            role="switch"
            aria-checked={isPremium}
            aria-label="Cambiar tipo de plan"
            className={`relative h-8 w-14 rounded-full transition ${isPremium ? 'bg-amber-500' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                isPremium ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </form>
      </section>

      {/* Nueva categoría */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-900">Nueva categoría</h2>
        <form action={createCategory} className="flex gap-2">
          <input type="hidden" name="tenant_id" value={tenant.id} />
          <input name="name" required placeholder="Ej: Bebidas calientes" className={input} />
          <button className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
            Agregar
          </button>
        </form>
      </section>

      {/* Nuevo platillo */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-900">Nuevo platillo</h2>
        <form action={createItem} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="tenant_id" value={tenant.id} />
          <input type="hidden" name="slug" value={tenant.slug} />
          <input name="name" required placeholder="Nombre" className={input} />
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="Precio"
            className={input}
          />
          <select name="category_id" className={`${input} sm:col-span-2`} defaultValue="">
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <textarea
            name="description"
            rows={3}
            placeholder="Descripción"
            className={`${input} sm:col-span-2`}
          />
          <button className="rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-white sm:col-span-2">
            Guardar platillo
          </button>
        </form>
      </section>

      {/* Listado */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-900">Platillos ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Aún no hay platillos.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{i.name}</p>
                  <p className="text-xs text-gray-500">
                    {(i.category_id && catName.get(i.category_id)) || 'Sin categoría'}
                  </p>
                  {i.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{i.description}</p>}
                </div>
                <span className="shrink-0 font-semibold text-amber-600">{money.format(i.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
