import { Helmet } from 'react-helmet-async'
import { SITE } from '../../data/landingContent'

const description =
  'Hire verified experts for salon, home appliances and repair services in minutes—instant booking, transparent pricing, and secure digital payments across Indian cities.'

const schema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE.name,
  url: SITE.url,
  description,
  logo: `${SITE.url}/favicon.svg`,
  sameAs: [
    'https://www.linkedin.com/company/a2zservices',
    'https://twitter.com/a2zservices',
    'https://www.instagram.com/a2zservices',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: SITE.phone,
    contactType: 'customer support',
    areaServed: 'IN',
    availableLanguage: ['English', 'Hindi'],
  },
}

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: `${SITE.name} On-demand Salon & Home Appliance Services`,
  provider: { '@type': 'Organization', name: SITE.name, url: SITE.url },
  areaServed: { '@type': 'Country', name: 'India' },
  serviceType: 'Salon & Home Appliance Services',
  description,
}

export function SEOMeta() {
  return (
    <Helmet>
      <html lang="en" />
      <title>A2Z — Book Salon, Home Appliances & Services</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={SITE.url} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:title" content="A2Z — Book Salon, Home Appliances & Services" />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={SITE.url} />
      <meta property="og:image" content={`${SITE.url}/og-image.png`} />
      <meta property="og:locale" content="en_IN" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="A2Z — Verified experts on demand" />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${SITE.url}/og-image.png`} />

      <script type="application/ld+json">{JSON.stringify(schema)}</script>
      <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
    </Helmet>
  )
}
