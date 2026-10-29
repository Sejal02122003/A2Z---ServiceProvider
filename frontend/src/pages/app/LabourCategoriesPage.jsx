import { useNavigate } from 'react-router-dom'
import { AppAmbientBackground } from '../../components/app/AppAmbientBackground.jsx'
import { LabourCategorySetup } from '../../components/auth/LabourCategorySetup.jsx'
import { MobileShell } from '../../layouts/MobileShell.jsx'

export function LabourCategoriesPage() {
  const navigate = useNavigate()

  return (
    <>
      <AppAmbientBackground />
      <MobileShell transparent className="pb-0">
        <LabourCategorySetup variant="app" onComplete={() => navigate('/serviceprovider', { replace: true })} />
      </MobileShell>
    </>
  )
}
