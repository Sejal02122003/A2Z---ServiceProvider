import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider.jsx'
import { BrandingProvider } from './context/BrandingContext.jsx'
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx'
import { AppShell } from './layouts/AppShell.jsx'
import { AdminLayout } from './layouts/AdminLayout.jsx'
import { LandingPage } from './pages/LandingPage'
import { AuthEntryPage } from './pages/auth/AuthEntryPage.jsx'
import { LabourCategoriesPage } from './pages/app/LabourCategoriesPage.jsx'
import { appShellChildRoutes } from './routes/appRoutes.jsx'
import { bootRoutes } from './routes/bootRoutes.jsx'
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage.jsx'
import { AdminSubCategoriesPage } from './pages/admin/AdminSubCategoriesPage.jsx'
import { AdminServicesPage } from './pages/admin/AdminServicesPage.jsx'
import { AdminLoginPage } from './pages/admin/AdminLoginPage.jsx'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.jsx'
import { AdminUsersPage } from './pages/admin/AdminUsersPage.jsx'
import { AdminLabourPage } from './pages/admin/AdminLabourPage.jsx'

import { AdminBookingsPage } from './pages/admin/AdminBookingsPage.jsx'

import { AdminBillingPage } from './pages/admin/AdminBillingPage.jsx'
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage.jsx'
import { AdminReportsPage } from './pages/admin/AdminReportsPage.jsx'
import { AdminZoneManagementPage } from './pages/admin/AdminZoneManagementPage.jsx'
import { AdminBannersPage } from './pages/admin/AdminBannersPage.jsx'
import { AdminComplaintsPage } from './pages/admin/AdminComplaintsPage.jsx'
import { AdminProfilePage } from './pages/admin/AdminProfilePage.jsx'
import { AdminZonesPage } from './pages/admin/AdminZonesPage.jsx'
import { AdminPlatformFeePage } from './pages/admin/AdminPlatformFeePage.jsx'
import { AdminCommissionFeePage } from './pages/admin/AdminCommissionFeePage.jsx'
import { AdminLabourWalletPage } from './pages/admin/AdminLabourWalletPage.jsx'
import { AdminCashManagementPage } from './pages/admin/AdminCashManagementPage.jsx'
import { AdminReviewsRatingsPage } from './pages/admin/AdminReviewsRatingsPage.jsx'
import { AdminLabourSubscriptionsPage } from './pages/admin/AdminLabourSubscriptionsPage.jsx'
import { AdminFreeTrialPage } from './pages/admin/AdminFreeTrialPage.jsx'
import { AdminPrivacyPolicyPage } from './pages/admin/AdminPrivacyPolicyPage.jsx'
import { AdminTermsConditionsPage } from './pages/admin/AdminTermsConditionsPage.jsx'
import { AdminFAQsPage } from './pages/admin/AdminFAQsPage.jsx'
import { AdminCancellationPolicyPage } from './pages/admin/AdminCancellationPolicyPage.jsx'
import { AdminRefundPolicyPage } from './pages/admin/AdminRefundPolicyPage.jsx'
import { AdminSimulatedOpportunitiesPage } from './pages/admin/AdminSimulatedOpportunitiesPage.jsx'

import { BroadcastPopup } from './components/app/BroadcastPopup.jsx'
import { SimulatedOpportunityPopup } from './components/app/SimulatedOpportunityPopup.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { useEffect } from 'react'
import { APP_B2C_ROLES } from './constants/panelRoles.js'
import { USER_ROLES } from './constants/userRoles.js'
import { initializePushNotifications, setupForegroundNotificationHandler } from './services/pushNotificationService.js'

function App() {
  useEffect(() => {
    initializePushNotifications();
    setupForegroundNotificationHandler((payload) => {
      // You can replace this with a custom toast notification library like react-hot-toast if desired
      if (payload?.notification) {
        alert(`New Notification: ${payload.notification.title}\n${payload.notification.body}`);
      }
      if (payload.data?.link) {
        // Optional navigation handling based on data payload
        console.log('Navigating to', payload.data.link);
      }
    });
  }, []);

  return (
    <BrowserRouter>
      <BrandingProvider>
        <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          {bootRoutes}
          <Route path="/auth" element={<Navigate to="/users/auth" replace />} />
          <Route path="/users/auth" element={<AuthEntryPage authGroup="users" />} />
          <Route path="/labours/auth" element={<AuthEntryPage authGroup="labours" />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute roles={APP_B2C_ROLES} allowGuest>
                <ErrorBoundary>
                  <AppShell />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          >
            {appShellChildRoutes}
          </Route>
          <Route
            path="/app/work-categories"
            element={
              <ProtectedRoute roles={[USER_ROLES.LABOUR]}>
                <ErrorBoundary>
                  <LabourCategoriesPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />

          <Route path="/admin/login" element={<AdminLoginPage />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={[USER_ROLES.ADMIN]}>
                <ErrorBoundary>
                  <AdminLayout />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="sub-categories" element={<AdminSubCategoriesPage />} />
            <Route path="services" element={<AdminServicesPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="labour" element={<AdminLabourPage />} />

            <Route path="bookings" element={<AdminBookingsPage />} />

            <Route path="billing" element={<AdminBillingPage />} />
            <Route path="banners" element={<AdminBannersPage />} />
            <Route path="complaints" element={<AdminComplaintsPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="zones" element={<AdminZonesPage />} />
            <Route path="zone-management" element={<AdminZoneManagementPage />} />
            <Route path="platform-fee" element={<AdminPlatformFeePage />} />
            <Route path="commission-fee" element={<AdminCommissionFeePage />} />
            <Route path="labour-wallet" element={<AdminLabourWalletPage />} />
            <Route path="cash-management" element={<AdminCashManagementPage />} />
            <Route path="reviews" element={<AdminReviewsRatingsPage />} />
            <Route path="labour-subscriptions" element={<AdminLabourSubscriptionsPage />} />
            <Route path="free-trials" element={<AdminFreeTrialPage />} />
            <Route path="privacy-policy" element={<AdminPrivacyPolicyPage />} />
            <Route path="terms-conditions" element={<AdminTermsConditionsPage />} />
            <Route path="faqs" element={<AdminFAQsPage />} />
            <Route path="cancellation-policy" element={<AdminCancellationPolicyPage />} />
            <Route path="refund-policy" element={<AdminRefundPolicyPage />} />
            <Route path="simulated-opportunities" element={<AdminSimulatedOpportunitiesPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BroadcastPopup />
        <SimulatedOpportunityPopup />
        </AuthProvider>
      </BrandingProvider>
    </BrowserRouter>
  )
}

export default App
