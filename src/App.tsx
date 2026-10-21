import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import MerchantList from './pages/MerchantList'
import MerchantDetail from './pages/MerchantDetail'
import MerchantActivity from './pages/MerchantActivity'
import OnboardingList from './pages/OnboardingList'
import OnboardingDetail from './pages/OnboardingDetail'
import SupportList from './pages/SupportList'
import SupportDetail from './pages/SupportDetail'
import Subscriptions from './pages/Subscriptions'
import SubscriptionDetail from './pages/SubscriptionDetail'
import Invoice from './pages/Invoice'
import Contacts from './pages/Contacts'
import Churn from './pages/Churn'
import Faq from './pages/Faq'
import Promotions from './pages/Promotions'
import Overview from './pages/Overview'
import Settings from './pages/Settings'
import Help from './pages/Help'
import NotFound from './pages/NotFound'

/** One route per design screen (see SPEC.md). Page files in src/pages/ own their own data fetching. */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        <Route path="/merchants" element={<MerchantList />} />
        <Route path="/merchants/:id" element={<MerchantDetail />} />
        <Route path="/merchants/:id/activity" element={<MerchantActivity />} />
        <Route path="/onboarding" element={<OnboardingList />} />
        <Route path="/onboarding/:merchantId" element={<OnboardingDetail />} />
        <Route path="/support" element={<SupportList />} />
        <Route path="/support/:id" element={<SupportDetail />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/subscriptions/:merchantId" element={<SubscriptionDetail />} />
        <Route path="/subscriptions/:merchantId/invoice" element={<Invoice />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/churn" element={<Churn />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
