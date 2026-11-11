import { ArrowLeft, Building2, Camera, Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { ContactForm, DealForm, TaskForm, statusLabel, statusTone } from '../components/forms'
import { ActivityFeed, FilesPanel, NoteComposer } from '../components/records'
import { Avatar, Badge, Button, ConfirmDialog, Spinner, useToast } from '../components/ui'
import { api, uploadAvatar, useApiMutation, useContact, useMe } from '../lib/api'
import { longDate, money, relativeTime } from '../lib/format'
import { DEAL_STAGES } from '../../shared/types'

export function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isLoading } = useContact(id)
  const { data: me } = useMe()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newDeal, setNewDeal] = useState(false)
  const [newTask, setNewTask] = useState(false)
  const avatarInput = useRef<HTMLInputElement>(null)
  const [avatarVersion, setAvatarVersion] = useState(0)

  const remove = useApiMutation(() => api(`/contacts/${id}`, { method: 'DELETE' }), ['contacts', 'companies', 'deals', 'overview'], {
    onSuccess: () => navigate('/contacts'),
  })
  const avatar = useApiMutation((file: File) => uploadAvatar(id!, file), ['contact', 'contacts'], {
    onSuccess: () => {
      setAvatarVersion((v) => v + 1)
      toast('Photo updated')
    },
  })

  if (isLoading || !data) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }
  const { contact, activities, deals, files } = data
  const name = `${contact.firstName} ${contact.lastName}`.trim()
  const openValue = deals.filter((d) => !['won', 'lost'].includes(d.stage)).reduce((s, d) => s + d.value, 0)

  return (
    <div className="mx-auto max-w-[1200px] p-5 sm:p-8">
      <Link to="/contacts" className="inline-flex h-8 items-center gap-1.5 rounded-tile text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="size-4" />
        Contacts
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => me?.capabilities.files && avatarInput.current?.click()}
            className="group relative rounded-full"
            aria-label="Change photo"
            disabled={!me?.capabilities.files}
          >
            <Avatar name={name} hue={contact.hue} src={contact.avatarKey ? `/api/files/avatar/${contact.id}?v=${avatarVersion}` : null} size={64} />
            {me?.capabilities.files && (
              <span className="round absolute inset-0 grid place-items-center bg-fg/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                {avatar.isPending ? <Spinner className="text-white" /> : <Camera className="size-5" />}
              </span>
            )}
            <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && avatar.mutate(e.target.files[0])} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[24px] font-semibold tracking-[-0.02em]">{name}</h1>
              <Badge tone={statusTone[contact.status]} dot>
                {statusLabel[contact.status]}
              </Badge>
            </div>
            <p className="mt-1 text-[14px] text-muted">
              {contact.title}
              {contact.title && contact.companyName && <span className="text-faint"> at </span>}
              {contact.companyName && (
                <Link to={`/companies/${contact.companyId}`} className="font-medium text-fg hover:underline">
                  {contact.companyName}
                </Link>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete contact" onClick={() => setDeleting(true)}>
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <NoteComposer contactId={contact.id} />
          <div className="mt-6">
            <h2 className="text-[13px] font-semibold">Activity</h2>
            <ActivityFeed items={activities} />
          </div>
        </div>

        <aside className="flex flex-col gap-8">
          <section>
            <h3 className="text-[13px] font-semibold">Details</h3>
            <dl className="mt-3 flex flex-col gap-3 text-[13.5px]">
              <div className="flex items-center gap-3">
                <dt className="grid size-7 place-items-center rounded-[9px] bg-surface-2 text-muted">
                  <Mail className="size-3.5" />
                </dt>
                <dd className="min-w-0 truncate">
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="hover:underline">
                      {contact.email}
                    </a>
                  ) : (
                    <span className="text-faint">No email</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="grid size-7 place-items-center rounded-[9px] bg-surface-2 text-muted">
                  <Phone className="size-3.5" />
                </dt>
                <dd className="truncate">{contact.phone ?? <span className="text-faint">No phone</span>}</dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="grid size-7 place-items-center rounded-[9px] bg-surface-2 text-muted">
                  <Building2 className="size-3.5" />
                </dt>
                <dd className="truncate">
                  {contact.companyName ? (
                    <Link to={`/companies/${contact.companyId}`} className="hover:underline">
                      {contact.companyName}
                    </Link>
                  ) : (
                    <span className="text-faint">No company</span>
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-[12.5px] text-faint">Added {longDate(contact.createdAt)}</p>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Deals{openValue > 0 && <span className="ml-2 font-normal text-muted">{money(openValue)} open</span>}</h3>
              <Button size="sm" onClick={() => setNewDeal(true)}>
                <Plus />
                Deal
              </Button>
            </div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {deals.map((d) => (
                <li key={d.id}>
                  <Link to={`/deals?deal=${d.id}`} className="flex h-12 items-center gap-3 rounded-control border border-line px-3 transition-colors hover:bg-surface-2/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{d.title}</span>
                      <span className="block text-[12px] text-faint">{DEAL_STAGES.find((s) => s.key === d.stage)?.label}</span>
                    </span>
                    <span className="text-[13px] tabular-nums">{money(d.value)}</span>
                  </Link>
                </li>
              ))}
              {deals.length === 0 && <li className="py-3 text-center text-[12.5px] text-faint">No deals yet</li>}
            </ul>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Follow up</h3>
              <Button size="sm" onClick={() => setNewTask(true)}>
                <Plus />
                Task
              </Button>
            </div>
            <p className="mt-2 text-[12.5px] text-faint">Last activity {relativeTime(contact.lastActivityAt)}</p>
          </section>

          <FilesPanel files={files} target={{ contactId: contact.id }} />
        </aside>
      </div>

      <ContactForm open={editing} initial={contact} onClose={() => setEditing(false)} />
      <DealForm open={newDeal} onClose={() => setNewDeal(false)} defaults={{ contactId: contact.id, companyId: contact.companyId }} />
      <TaskForm open={newTask} onClose={() => setNewTask(false)} defaults={{ contactId: contact.id }} />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate(undefined)}
        loading={remove.isPending}
        title={`Delete ${contact.firstName}?`}
        description="Their notes and files are removed too. Deals stay but lose the contact."
      />
    </div>
  )
}
