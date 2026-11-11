import { AnimatePresence, motion } from 'motion/react'
import { Building2, Handshake, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { useSearch } from '../lib/api'
import { cx } from '../lib/cx'
import { moneyCompact } from '../lib/format'
import { Avatar, CompanyMark } from './ui'

type Item = { key: string; label: string; detail?: string; to: string; icon: React.ReactNode }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const { data } = useSearch(q)

  useEffect(() => {
    if (!open) {
      setQ('')
      setActive(0)
    }
  }, [open])

  const items = useMemo<Item[]>(() => {
    if (!data) return []
    return [
      ...data.contacts.map((c) => ({
        key: `c-${c.id}`,
        label: c.name,
        detail: c.email ?? undefined,
        to: `/contacts/${c.id}`,
        icon: <Avatar name={c.name} hue={c.hue} size={24} />,
      })),
      ...data.companies.map((c) => ({
        key: `co-${c.id}`,
        label: c.name,
        detail: c.domain ?? undefined,
        to: `/companies/${c.id}`,
        icon: <CompanyMark name={c.name} hue={c.hue} size={24} />,
      })),
      ...data.deals.map((d) => ({
        key: `d-${d.id}`,
        label: d.title,
        detail: moneyCompact(d.value),
        to: `/deals?deal=${d.id}`,
        icon: (
          <span className="grid size-6 place-items-center rounded-[8px] bg-surface-2 text-muted">
            <Handshake className="size-3.5" />
          </span>
        ),
      })),
    ]
  }, [data])

  const shortcuts: Item[] = [
    { key: 's-contacts', label: 'Go to contacts', to: '/contacts', icon: <Users className="size-4 text-muted" /> },
    { key: 's-companies', label: 'Go to companies', to: '/companies', icon: <Building2 className="size-4 text-muted" /> },
    { key: 's-deals', label: 'Go to deals', to: '/deals', icon: <Handshake className="size-4 text-muted" /> },
  ]
  const list = q.trim() ? items : shortcuts

  useEffect(() => setActive(0), [q, list.length])

  function go(item: Item) {
    onClose()
    navigate(item.to)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-fg/25 px-4 pt-[12vh] backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-label="Search"
            className="w-full max-w-[560px] overflow-hidden rounded-dialog bg-surface shadow-dialog"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex h-12 items-center gap-3 border-b border-line px-4">
              <Search className="size-4 text-faint" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, list.length - 1)))
                  if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
                  if (e.key === 'Enter' && list[active]) go(list[active])
                  if (e.key === 'Escape') onClose()
                }}
                placeholder="Search contacts, companies and deals"
                className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
              />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-1.5">
              {list.length === 0 && <li className="px-3 py-8 text-center text-[13.5px] text-muted">Nothing matches “{q}”</li>}
              {list.map((item, i) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item)}
                    className={cx('flex h-10 w-full items-center gap-3 rounded-control px-2.5 text-left', i === active && 'bg-surface-2')}
                  >
                    {item.icon}
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{item.label}</span>
                    {item.detail && <span className="truncate text-[12.5px] text-faint">{item.detail}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
