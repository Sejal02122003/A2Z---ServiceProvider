import { HardHat } from 'lucide-react'
import { footerLinks, SITE } from '../../data/landingContent'
import { Container } from '../ui/Container'

function IconLinkedIn(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM.5 8.5h4V23h-4V8.5zM8.5 8.5h3.8v1.9h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6v7.6h-4v-6.7c0-1.6 0-3.7-2.3-3.7-2.3 0-2.6 1.8-2.6 3.6V23h-4V8.5z" />
    </svg>
  )
}

function IconX(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function IconInstagram(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5zm5.25-3.75a1.25 1.25 0 1 1-1.25 1.25 1.25 1.25 0 0 1 1.25-1.25z" />
    </svg>
  )
}

const social = [
  { Icon: IconLinkedIn, href: 'https://www.linkedin.com/company/a2zservices', label: 'LinkedIn' },
  { Icon: IconX, href: 'https://twitter.com/a2zservices', label: 'X (Twitter)' },
  { Icon: IconInstagram, href: 'https://www.instagram.com/a2zservices', label: 'Instagram' },
]

export function Footer() {
  return (
    <footer id="footer" className="border-t border-white/10 bg-surface-950 py-14 text-zinc-400">
      <Container>
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-white">
              <img src="/logo.png" alt={SITE.name} className="h-10 w-auto object-contain rounded-lg bg-white/10 p-1" />
              <span className="text-lg font-extrabold tracking-tight">{SITE.name}</span>
            </div>
            <p className="text-sm leading-relaxed">
              Verified construction labour, on demand—built for India’s contractors, builders, and
              hardworking crews.
            </p>
            <div className="flex gap-2">
              {social.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:border-brand/50 hover:text-brand-bright"
                  aria-label={s.label}
                >
                  <s.Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Product</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {footerLinks.product.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Company</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {footerLinks.company.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href={`mailto:${SITE.contactEmail}`} className="hover:text-white">
                  {SITE.contactEmail}
                </a>
              </li>
              <li>
                <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="hover:text-white">
                  {SITE.phone}
                </a>
              </li>
            </ul>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Get the app</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href="#app"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white hover:border-brand/50"
                >
                  Google Play
                </a>
                <a
                  href="#app"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white hover:border-brand/50"
                >
                  App Store
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-zinc-500 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            {footerLinks.legal.map((l) => (
              <a key={l.label} href={l.href} className="hover:text-zinc-300">
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  )
}
