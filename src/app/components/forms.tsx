import { useEffect, useState, type FormEvent } from 'react'

import { api, useApiMutation, useCompanies, useContacts } from '../lib/api'
import { fromDateInput, toDateInput } from '../lib/format'
import { Button, Dialog, Field, Input, Select, useFieldId, useToast } from './ui'
import { CONTACT_STATUSES, DEAL_STAGES, type Company, type Contact, type Deal, type Task } from '../../shared/types'


// Each form works for create and edit: pass `initial` to edit.

function FieldInput(props: React.ComponentPropsWithoutRef<typeof Input>) {
  const id = useFieldId()
  return <Input id={id} {...props} />
}
function FieldSelect(props: React.ComponentPropsWithoutRef<typeof Select>) {
  const id = useFieldId()
  return <Select id={id} {...props} />
}

export function ContactForm({
  open,
  onClose,
  initial,
  defaultCompanyId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  initial?: Contact
  defaultCompanyId?: string | null
  onSaved?: (contact: Contact) => void
}) {
  const toast = useToast()
  const { data: companies } = useCompanies()
  const [form, setForm] = useState(blankContact(initial, defaultCompanyId))
  useEffect(() => {
    if (open) setForm(blankContact(initial, defaultCompanyId))
  }, [open, initial, defaultCompanyId])

  const save = useApiMutation(
    (input: typeof form) =>
      initial
        ? api<{ contact: Contact }>(`/contacts/${initial.id}`, { method: 'PATCH', json: input })
        : api<{ contact: Contact }>('/contacts', { method: 'POST', json: input }),
    ['contacts', 'contact', 'company', 'overview', 'search'],
    {
      onSuccess: (result) => {
        toast(initial ? 'Contact updated' : 'Contact added')
        onSaved?.(result.contact)
        onClose()
      },
    },
  )

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(form)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit contact' : 'New contact'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="contact-form" loading={save.isPending}>
            {initial ? 'Save' : 'Add contact'}
          </Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={submit} className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <FieldInput required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <FieldInput value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </Field>
        </div>
        <Field label="Email">
          <FieldInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <FieldInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Title">
            <FieldInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company">
            <FieldSelect value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              <option value="">None</option>
              {companies?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FieldSelect>
          </Field>
          <Field label="Status">
            <FieldSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Contact['status'] })}>
              {CONTACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </FieldSelect>
          </Field>
        </div>
        {save.error && <p className="text-[13px] text-danger">{save.error.message}</p>}
      </form>
    </Dialog>
  )
}

export const statusLabel: Record<Contact['status'], string> = { lead: 'Lead', active: 'Active', customer: 'Customer', churned: 'Churned' }
export const statusTone: Record<Contact['status'], 'neutral' | 'info' | 'success' | 'danger'> = {
  lead: 'neutral',
  active: 'info',
  customer: 'success',
  churned: 'danger',
}

function blankContact(initial?: Contact, companyId?: string | null) {
  return {
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    title: initial?.title ?? '',
    companyId: initial?.companyId ?? companyId ?? '',
    status: initial?.status ?? ('lead' as Contact['status']),
  }
}

export function CompanyForm({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial?: Company; onSaved?: (company: Company) => void }) {
  const toast = useToast()
  const [form, setForm] = useState(blankCompany(initial))
  useEffect(() => {
    if (open) setForm(blankCompany(initial))
  }, [open, initial])
  const save = useApiMutation(
    (input: typeof form) =>
      initial
        ? api<{ company: Company }>(`/companies/${initial.id}`, { method: 'PATCH', json: input })
        : api<{ company: Company }>('/companies', { method: 'POST', json: input }),
    ['companies', 'company', 'contacts', 'deals', 'search'],
    {
      onSuccess: (result) => {
        toast(initial ? 'Company updated' : 'Company added')
        onSaved?.(result.company)
        onClose()
      },
    },
  )
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit company' : 'New company'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="company-form" loading={save.isPending}>
            {initial ? 'Save' : 'Add company'}
          </Button>
        </>
      }
    >
      <form
        id="company-form"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(form)
        }}
        className="grid gap-4"
      >
        <Field label="Name">
          <FieldInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Website">
          <FieldInput placeholder="example.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Industry">
            <FieldInput value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </Field>
          <Field label="Size">
            <FieldSelect value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
              <option value="">Unknown</option>
              {['1 to 10', '10 to 50', '50 to 200', '200 to 500', '500 to 1000', '1000+'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </FieldSelect>
          </Field>
        </div>
        <Field label="Location">
          <FieldInput value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </Field>
        {save.error && <p className="text-[13px] text-danger">{save.error.message}</p>}
      </form>
    </Dialog>
  )
}

function blankCompany(initial?: Company) {
  return {
    name: initial?.name ?? '',
    domain: initial?.domain ?? '',
    industry: initial?.industry ?? '',
    size: initial?.size ?? '',
    location: initial?.location ?? '',
  }
}

export function DealForm({
  open,
  onClose,
  initial,
  defaults,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  initial?: Deal
  defaults?: { stage?: Deal['stage']; contactId?: string | null; companyId?: string | null }
  onSaved?: (deal: Deal) => void
}) {
  const toast = useToast()
  const { data: companies } = useCompanies()
  const { data: contacts } = useContacts({ sort: 'name' })
  const [form, setForm] = useState(blankDeal(initial, defaults))
  useEffect(() => {
    if (open) setForm(blankDeal(initial, defaults))
  }, [open, initial, defaults])
  const save = useApiMutation(
    (input: typeof form) => {
      const payload = { ...input, value: Number(input.value) || 0 }
      return initial
        ? api<{ deal: Deal }>(`/deals/${initial.id}`, { method: 'PATCH', json: payload })
        : api<{ deal: Deal }>('/deals', { method: 'POST', json: payload })
    },
    ['deals', 'deal', 'contact', 'company', 'overview', 'search'],
    {
      onSuccess: (result) => {
        toast(initial ? 'Deal updated' : 'Deal added')
        onSaved?.(result.deal)
        onClose()
      },
    },
  )
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit deal' : 'New deal'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="deal-form" loading={save.isPending}>
            {initial ? 'Save' : 'Add deal'}
          </Button>
        </>
      }
    >
      <form
        id="deal-form"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(form)
        }}
        className="grid gap-4"
      >
        <Field label="Title">
          <FieldInput required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Value">
            <span className="relative block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13.5px] text-faint">$</span>
              <FieldInput type="number" min={0} step={100} className="pl-7" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </span>
          </Field>
          <Field label="Stage">
            <FieldSelect value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as Deal['stage'] })}>
              {DEAL_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </FieldSelect>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company">
            <FieldSelect value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              <option value="">None</option>
              {companies?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FieldSelect>
          </Field>
          <Field label="Contact">
            <FieldSelect value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
              <option value="">None</option>
              {contacts?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </FieldSelect>
          </Field>
        </div>
        <Field label="Expected close">
          <FieldInput type="date" value={form.closeDate} onChange={(e) => setForm({ ...form, closeDate: e.target.value })} />
        </Field>
        {save.error && <p className="text-[13px] text-danger">{save.error.message}</p>}
      </form>
    </Dialog>
  )
}

function blankDeal(initial?: Deal, defaults?: { stage?: Deal['stage']; contactId?: string | null; companyId?: string | null }) {
  return {
    title: initial?.title ?? '',
    value: initial ? String(initial.value) : '',
    stage: initial?.stage ?? defaults?.stage ?? ('lead' as Deal['stage']),
    companyId: initial?.companyId ?? defaults?.companyId ?? '',
    contactId: initial?.contactId ?? defaults?.contactId ?? '',
    closeDate: initial?.closeDate ?? '',
  }
}

export function TaskForm({
  open,
  onClose,
  initial,
  defaults,
}: {
  open: boolean
  onClose: () => void
  initial?: Task
  defaults?: { contactId?: string | null; dealId?: string | null }
}) {
  const toast = useToast()
  const { data: contacts } = useContacts({ sort: 'name' })
  const [form, setForm] = useState(blankTask(initial, defaults))
  useEffect(() => {
    if (open) setForm(blankTask(initial, defaults))
  }, [open, initial, defaults])
  const save = useApiMutation(
    (input: typeof form) => {
      const payload = { title: input.title, dueAt: fromDateInput(input.due), contactId: input.contactId || null, dealId: input.dealId || null }
      return initial ? api(`/tasks/${initial.id}`, { method: 'PATCH', json: payload }) : api('/tasks', { method: 'POST', json: payload })
    },
    ['tasks', 'overview', 'contact'],
    {
      onSuccess: () => {
        toast(initial ? 'Task updated' : 'Task added')
        onClose()
      },
    },
  )
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit task' : 'New task'}
      width={440}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="task-form" loading={save.isPending}>
            {initial ? 'Save' : 'Add task'}
          </Button>
        </>
      }
    >
      <form
        id="task-form"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(form)
        }}
        className="grid gap-4"
      >
        <Field label="Task">
          <FieldInput required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due">
            <FieldInput type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
          </Field>
          <Field label="Contact">
            <FieldSelect value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
              <option value="">None</option>
              {contacts?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </FieldSelect>
          </Field>
        </div>
        {save.error && <p className="text-[13px] text-danger">{save.error.message}</p>}
      </form>
    </Dialog>
  )
}

function blankTask(initial?: Task, defaults?: { contactId?: string | null; dealId?: string | null }) {
  return {
    title: initial?.title ?? '',
    due: toDateInput(initial?.dueAt ?? null),
    contactId: initial?.contactId ?? defaults?.contactId ?? '',
    dealId: initial?.dealId ?? defaults?.dealId ?? '',
  }
}
