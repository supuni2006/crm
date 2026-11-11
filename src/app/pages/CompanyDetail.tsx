import { ArrowLeft, Globe, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { CompanyForm, ContactForm, DealForm, statusLabel, statusTone } from '../components/forms'
import { ActivityFeed } from '../components/records'
import { Avatar, Badge, Button, CompanyMark, ConfirmDialog, Spinner } from '../components/ui'
import { api, useApiMutation, useCompany } from '../lib/api'
import { money, relativeTime } from '../lib/format'
import { DEAL_STAGES } from '../../shared/types'

export function CompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useCompany(id)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newContact, setNewContact] = useState(false)
  const [newDeal, setNewDeal] = useState(false)
  const remove = useApiMutation(() => api(`/companies/${id}`, { method: 'DELETE' }), ['companies', 'contacts', 'deals', 'overview'], {
    onSuccess: () => navigate('/companies'),
  })

  if (isLoading || !data) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }
  const { company, contacts, deals, activities } = data
  const open = deals.filter((d) => !['won', 'lost'].includes(d.stage))
  const won = deals.filter((d) => d.stage === 'won')

  return (
    <div className="mx-auto max-w-[1200px] p-5 sm:p-8">
      <Link to="/companies" className="inline-flex h-8 items-center gap-1.5 rounded-tile text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="size-4" />
        Companies
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <CompanyMark name={company.name} hue={company.hue} size={64} />
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">{company.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted">
              {company.domain && (
                <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-fg">
                  <Globe className="size-3.5" />
                  {company.domain}
                </a>
              )}
              {company.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {company.location}
                </span>
              )}
              {company.industry && <span>{company.industry}</span>}
              {company.size && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {company.size}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete company" onClick={() => setDeleting(true)}>
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          ['Open pipeline', money(open.reduce((s, d) => s + d.value, 0))],
          ['Won', money(won.reduce((s, d) => s + d.value, 0))],
          ['People', String(contacts.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-line p-4">
            <p className="text-[12.5px] text-muted">{label}</p>
            <p className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">People</h2>
            <Button size="sm" onClick={() => setNewContact(true)}>
              <Plus />
              Contact
            </Button>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {contacts.map((c) => (
              <li key={c.id}>
                <Link to={`/contacts/${c.id}`} className="flex h-14 items-center gap-3 rounded-control border border-line px-3 transition-colors hover:bg-surface-2/60">
                  <Avatar name={`${c.firstName} ${c.lastName}`} hue={c.hue} src={c.avatarKey ? `/api/files/avatar/${c.id}` : null} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="block truncate text-[12px] text-faint">{c.title ?? c.email}</span>
                  </span>
                  <Badge tone={statusTone[c.status]}>{statusLabel[c.status]}</Badge>
                </Link>
              </li>
            ))}
            {contacts.length === 0 && <li className="py-4 text-center text-[12.5px] text-faint">No people yet</li>}
          </ul>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">Deals</h2>
            <Button size="sm" onClick={() => setNewDeal(true)}>
              <Plus />
              Deal
            </Button>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {deals.map((d) => (
              <li key={d.id}>
                <Link to={`/deals?deal=${d.id}`} className="flex h-14 items-center gap-3 rounded-control border border-line px-3 transition-colors hover:bg-surface-2/60">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{d.title}</span>
                    <span className="block text-[12px] text-faint">
                      {DEAL_STAGES.find((s) => s.key === d.stage)?.label}
                      {d.contactName && ` with ${d.contactName}`}
                    </span>
                  </span>
                  <span className="text-[13px] tabular-nums">{money(d.value)}</span>
                </Link>
              </li>
            ))}
            {deals.length === 0 && <li className="py-4 text-center text-[12.5px] text-faint">No deals yet</li>}
          </ul>
        </section>
      </div>

      <section className="mt-8 max-w-3xl">
        <h2 className="text-[13px] font-semibold">Activity</h2>
        <ActivityFeed items={activities} showContact />
        {activities.length > 0 && <p className="mt-2 text-[12px] text-faint">Updated {relativeTime(company.updatedAt)}</p>}
      </section>

      <CompanyForm open={editing} initial={company} onClose={() => setEditing(false)} />
      <ContactForm open={newContact} onClose={() => setNewContact(false)} defaultCompanyId={company.id} />
      <DealForm open={newDeal} onClose={() => setNewDeal(false)} defaults={{ companyId: company.id }} />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate(undefined)}
        loading={remove.isPending}
        title={`Delete ${company.name}?`}
        description="People and deals stay in your workspace, without a company."
      />
    </div>
  )
}
