import { useEffect, useState, useMemo } from 'react'
import { HelpCircle, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiRequest } from '../../api/http.js'
import { useAuth } from '../../hooks/useAuth.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-200/70 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-4 px-2 text-left outline-none transition-colors hover:bg-slate-50/50 focus-visible:ring-2 focus-visible:ring-brand/40 rounded-xl"
      >
        <span className="font-semibold text-slate-800 leading-snug">{question}</span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100/80 transition-transform duration-200 ${open ? 'rotate-180 bg-brand/10 text-brand' : 'text-slate-400'}`}>
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pb-4 px-2 pt-1 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AppFAQsPage() {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    if (!user?.role) return

    setIsLoading(true)
    apiRequest(`/policies/faqs/${user.role}`)
      .then((res) => {
        if (mounted) setContent(res.data?.content || 'No FAQs available.')
      })
      .catch(() => {
        if (mounted) setError('Failed to load FAQs.')
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [user?.role])

  const parsedFaqs = useMemo(() => {
    if (!content) return { title: '', items: [] }
    
    // Split by 'Q: ' to extract questions and answers
    const qParts = content.split('Q: ')
    const title = qParts[0]?.trim() || ''
    
    const items = []
    for (let i = 1; i < qParts.length; i++) {
      const part = qParts[i]
      const [question, ...rest] = part.split('A: ')
      if (question && rest.length > 0) {
        items.push({
          question: question.trim(),
          answer: rest.join('A: ').trim()
        })
      }
    }
    
    // If parsing fails or format is different, fallback to empty items
    return { title, items }
  }, [content])

  return (
    <div className="mx-auto max-w-3xl pt-2 pb-12 space-y-4">
      <AppStackScreenHeader title="FAQs" />
      <div className="mb-2 px-1">
        <p className="text-sm font-medium text-slate-500">
          Frequently asked questions and answers.
        </p>
      </div>

      <GlassPanel className="p-3 sm:p-6">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-r-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-600">
            {error}
          </div>
        ) : parsedFaqs.items.length > 0 ? (
          <div className="flex flex-col">
            {parsedFaqs.title && (
              <h2 className="px-2 pb-4 text-sm font-bold tracking-tight text-slate-400 uppercase">
                {parsedFaqs.title}
              </h2>
            )}
            <div className="flex flex-col gap-1">
              {parsedFaqs.items.map((faq, idx) => (
                <FAQItem key={idx} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        ) : (
          <div className="prose prose-sm prose-slate max-w-none px-2">
            {content.split('\\n').map((paragraph, i) => (
              <p key={i} className="mb-4 text-slate-700 whitespace-pre-wrap">
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
