import { Calendar, Download, FileText, Mail, MessageSquare, Paperclip, Phone, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'

import { api, uploadFile, useApiMutation, useMe } from '../lib/api'
import { cx } from '../lib/cx'
import { fileSize, relativeTime } from '../lib/format'
import { activityIcon } from '../pages/Overview'
import { Button, Textarea, useToast } from './ui'
import type { Activity, StoredFile } from '../../shared/types'

// The activity feed, note composer and attachments panel shared by contact
// pages and the deal drawer.

const kinds = [
  { key: 'note', label: 'Note', icon: MessageSquare },
  { key: 'call', label: 'Call', icon: Phone },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'meeting', label: 'Meeting', icon: Calendar },
] as const

export function NoteComposer({ contactId, dealId }: { contactId?: string; dealId?: string }) {
  const [kind, setKind] = useState<(typeof kinds)[number]['key']>('note')
  const [body, setBody] = useState('')
  const add = useApiMutation(
    (input: { kind: string; body: string }) => api('/activities', { method: 'POST', json: { ...input, contactId, dealId } }),
    ['contact', 'deal', 'company', 'overview', 'contacts'],
    { onSuccess: () => setBody('') },
  )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (body.trim()) add.mutate({ kind, body })
      }}
      className="rounded-card border border-line-strong bg-surface p-2 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/15"
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && body.trim()) add.mutate({ kind, body })
        }}
        placeholder={kind === 'note' ? 'Write a note' : `Log a ${kind}`}
        className="min-h-[72px] border-0 bg-transparent px-2 focus:ring-0"
      />
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <div className="flex gap-0.5">
          {kinds.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              className={cx(
                'inline-flex h-8 items-center gap-1.5 rounded-tile px-2.5 text-[12.5px] font-medium transition-colors',
                kind === key ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" type="submit" disabled={!body.trim()} loading={add.isPending}>
          Add
        </Button>
      </div>
    </form>
  )
}

export function ActivityFeed({ items, showContact }: { items: Activity[]; showContact?: boolean }) {
  const remove = useApiMutation((id: string) => api(`/activities/${id}`, { method: 'DELETE' }), ['contact', 'deal', 'company', 'overview'])
  if (items.length === 0) return <p className="py-6 text-center text-[13px] text-muted">No activity yet</p>
  return (
    <ol className="relative mt-1 flex flex-col">
      <span aria-hidden className="absolute bottom-3 left-[13px] top-3 w-px bg-line" />
      {items.map((a) => (
        <li key={a.id} className="group relative flex gap-3 py-3">
          <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-[9px] border border-line bg-surface text-muted [&_svg]:size-3.5">{activityIcon[a.kind]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[12.5px] font-medium capitalize text-fg">{a.kind === 'stage' ? 'Stage' : a.kind}</span>
              {showContact && a.contactName && (
                <Link to={`/contacts/${a.contactId}`} className="truncate text-[12.5px] text-muted hover:text-fg">
                  {a.contactName}
                </Link>
              )}
              <span className="ml-auto shrink-0 text-[12px] tabular-nums text-faint">{relativeTime(a.createdAt)}</span>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-fg/90">{a.body}</p>
          </div>
          {['note', 'call', 'email', 'meeting'].includes(a.kind) && (
            <button
              type="button"
              aria-label="Delete"
              onClick={() => remove.mutate(a.id)}
              className="absolute right-0 top-3 grid size-7 place-items-center rounded-tile text-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-danger group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </li>
      ))}
    </ol>
  )
}

export function FilesPanel({ files, target }: { files: StoredFile[]; target: { contactId?: string; dealId?: string; companyId?: string } }) {
  const { data: me } = useMe()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useApiMutation((file: File) => uploadFile(file, target), ['contact', 'deal', 'company', 'overview'], {
    onSuccess: () => toast('File attached'),
  })
  const remove = useApiMutation((id: string) => api(`/files/${id}`, { method: 'DELETE' }), ['contact', 'deal', 'company'])
  const enabled = me?.capabilities.files

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Files</h3>
        {enabled ? (
          <>
            <input ref={inputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
            <Button size="sm" onClick={() => inputRef.current?.click()} loading={upload.isPending}>
              <Paperclip />
              Attach
            </Button>
          </>
        ) : (
          <span className="text-[12px] text-faint">Storage not connected</span>
        )}
      </div>
      {upload.error && <p className="mt-2 text-[12.5px] text-danger">{upload.error.message}</p>}
      <ul className="mt-2 flex flex-col gap-1.5">
        {files.map((f) => (
          <li key={f.id} className="group flex h-11 items-center gap-3 rounded-control border border-line px-3">
            <FileText className="size-4 shrink-0 text-muted" />
            <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[13px] hover:underline">
              {f.name}
            </a>
            <span className="text-[12px] tabular-nums text-faint">{fileSize(f.size)}</span>
            <a href={`/api/files/${f.id}?download`} aria-label="Download" className="grid size-7 place-items-center rounded-tile text-faint hover:bg-surface-2 hover:text-fg">
              <Download className="size-3.5" />
            </a>
            <button
              type="button"
              aria-label="Delete file"
              onClick={() => remove.mutate(f.id)}
              className="grid size-7 place-items-center rounded-tile text-faint hover:bg-surface-2 hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
        {files.length === 0 && enabled && <li className="py-4 text-center text-[12.5px] text-faint">No files yet</li>}
      </ul>
    </div>
  )
}
