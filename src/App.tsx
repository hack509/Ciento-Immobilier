import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Analytics } from '@/components/seo/Analytics';

const Home = lazy(() => import('@/pages/public/Home').then(m => ({ default: m.Home })));
const Properties = lazy(() => import('@/pages/public/Properties').then(m => ({ default: m.Properties })));
const Rent = lazy(() => import('@/pages/public/Rent').then(m => ({ default: m.Rent })));
const PropertyDetail = lazy(() => import('@/pages/public/PropertyDetail').then(m => ({ default: m.PropertyDetail })));
const Airbnb = lazy(() => import('@/pages/public/Airbnb').then(m => ({ default: m.Airbnb })));
const Agents = lazy(() => import('@/pages/public/Agents').then(m => ({ default: m.Agents })));
const Contact = lazy(() => import('@/pages/public/Contact').then(m => ({ default: m.Contact })));
const Sell = lazy(() => import('@/pages/public/Sell').then(m => ({ default: m.Sell })));
const Privacy = lazy(() => import('@/pages/public/Privacy').then(m => ({ default: m.Privacy })));
const Terms = lazy(() => import('@/pages/public/Terms').then(m => ({ default: m.Terms })));
const FAQ = lazy(() => import('@/pages/public/FAQ').then(m => ({ default: m.FAQ })));
const NotFound = lazy(() => import('@/pages/public/NotFound').then(m => ({ default: m.NotFound })));
const Login = lazy(() => import('@/pages/auth/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('@/pages/auth/Register').then(m => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const AuthCallback = lazy(() => import('@/pages/auth/AuthCallback').then(m => ({ default: m.AuthCallback })));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword').then(m => ({ default: m.ResetPassword })));
const DashboardOverview = lazy(() => import('@/pages/dashboard/DashboardOverview').then(m => ({ default: m.DashboardOverview })));
const MyProperties = lazy(() => import('@/pages/dashboard/MyProperties').then(m => ({ default: m.MyProperties })));
const Favorites = lazy(() => import('@/pages/dashboard/Favorites').then(m => ({ default: m.Favorites })));
const Messages = lazy(() => import('@/pages/dashboard/Messages').then(m => ({ default: m.Messages })));
const Notifications = lazy(() => import('@/pages/dashboard/Notifications').then(m => ({ default: m.Notifications })));
const Profile = lazy(() => import('@/pages/dashboard/Profile').then(m => ({ default: m.Profile })));
const Settings = lazy(() => import('@/pages/dashboard/Settings').then(m => ({ default: m.Settings })));
const PropertyForm = lazy(() => import('@/pages/dashboard/PropertyForm').then(m => ({ default: m.PropertyForm })));
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview').then(m => ({ default: m.AdminOverview })));
const AdminProperties = lazy(() => import('@/pages/admin/AdminProperties').then(m => ({ default: m.AdminProperties })));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
const PropertyAlias = lazy(() => import('@/pages/public/PropertyAlias').then(m => ({ default: m.PropertyAlias })));
const Pricing = lazy(() => import('@/pages/public/Pricing').then(m => ({ default: m.Pricing })));
const Services = lazy(() => import('@/pages/public/Services').then(m => ({ default: m.Services })));
const ServiceDetail = lazy(() => import('@/pages/public/ServiceDetail').then(m => ({ default: m.ServiceDetail })));
const Agencies = lazy(() => import('@/pages/public/Agencies').then(m => ({ default: m.Agencies })));
const AgencyProfile = lazy(() => import('@/pages/public/AgencyProfile').then(m => ({ default: m.AgencyProfile })));
const Leads = lazy(() => import('@/pages/dashboard/Leads').then(m => ({ default: m.Leads })));
const Statistics = lazy(() => import('@/pages/dashboard/Statistics').then(m => ({ default: m.Statistics })));
const Promotions = lazy(() => import('@/pages/dashboard/Promotions').then(m => ({ default: m.Promotions })));
const Subscription = lazy(() => import('@/pages/dashboard/Subscription').then(m => ({ default: m.Subscription })));
const Billing = lazy(() => import('@/pages/dashboard/Billing').then(m => ({ default: m.Billing })));
const Checkout = lazy(() => import('@/pages/dashboard/Checkout').then(m => ({ default: m.Checkout })));
const AgencySpace = lazy(() => import('@/pages/dashboard/AgencySpace').then(m => ({ default: m.AgencySpace })));
const AgencyTeam = lazy(() => import('@/pages/dashboard/AgencyTeam').then(m => ({ default: m.AgencyTeam })));
const AgencyPortfolio = lazy(() => import('@/pages/dashboard/AgencyPortfolio').then(m => ({ default: m.AgencyPortfolio })));
const AdminAgencies = lazy(() => import('@/pages/admin/AdminAgencies').then(m => ({ default: m.AdminAgencies })));
const AdminSubscriptions = lazy(() => import('@/pages/admin/AdminSubscriptions').then(m => ({ default: m.AdminSubscriptions })));
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments').then(m => ({ default: m.AdminPayments })));
const AdminPromotions = lazy(() => import('@/pages/admin/AdminPromotions').then(m => ({ default: m.AdminPromotions })));
const AdminServices = lazy(() => import('@/pages/admin/AdminServices').then(m => ({ default: m.AdminServices })));
const AdminAds = lazy(() => import('@/pages/admin/AdminAds').then(m => ({ default: m.AdminAds })));
const AdminFinance = lazy(() => import('@/pages/admin/AdminFinance').then(m => ({ default: m.AdminFinance })));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminInbox = lazy(() => import('@/pages/admin/AdminInbox').then(m => ({ default: m.AdminInbox })));
const AdminNewsletter = lazy(() => import('@/pages/admin/AdminNewsletter').then(m => ({ default: m.AdminNewsletter })));
const AdminMedia = lazy(() => import('@/pages/admin/AdminMedia').then(m => ({ default: m.AdminMedia })));
const AdminReports = lazy(() => import('@/pages/admin/AdminReports').then(m => ({ default: m.AdminReports })));

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-secondary-200 border-t-secondary-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">Chargement...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Analytics />
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/annonces" element={<Properties />} />
          <Route path="/louer" element={<Rent />} />
          <Route path="/annonces/:citySlug/:propertySlug" element={<PropertyDetail />} />
          <Route path="/airbnb" element={<Airbnb />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/vendre" element={<Sell />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/confidentialite" element={<Privacy />} />
          <Route path="/conditions" element={<Terms />} />
          <Route path="/tarifs" element={<Pricing />} />
          <Route path="/propriete/:slug" element={<PropertyAlias />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:slug" element={<ServiceDetail />} />
          <Route path="/agences" element={<Agencies />} />
          <Route path="/agences/:slug" element={<AgencyProfile />} />
        </Route>

        {/* Auth Routes */}
        <Route path="/auth/connexion" element={<Login />} />
        <Route path="/auth/inscription" element={<Register />} />
        <Route path="/auth/mot-de-passe-oublie" element={<ForgotPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />

        {/* Protected Dashboard Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardOverview />} />
            <Route path="/dashboard/annonces/nouvelle" element={<PropertyForm />} />
            <Route path="/dashboard/annonces/:id/modifier" element={<PropertyForm />} />
            <Route path="/dashboard/annonces" element={<MyProperties />} />
            <Route path="/dashboard/favoris" element={<Favorites />} />
            <Route path="/dashboard/messages" element={<Messages />} />
            <Route path="/dashboard/notifications" element={<Notifications />} />
            <Route path="/dashboard/profil" element={<Profile />} />
            <Route path="/dashboard/settings" element={<Settings />} />
            <Route path="/dashboard/prospects" element={<Leads />} />
            <Route path="/dashboard/statistiques" element={<Statistics />} />
            <Route path="/dashboard/promotions" element={<Promotions />} />
            <Route path="/dashboard/abonnement" element={<Subscription />} />
            <Route path="/dashboard/paiements" element={<Billing />} />
            <Route path="/dashboard/paiement/:id" element={<Checkout />} />
            <Route path="/dashboard/agence" element={<AgencySpace />} />
            <Route path="/dashboard/agence/equipe" element={<AgencyTeam />} />
            <Route path="/dashboard/agence/portefeuille" element={<AgencyPortfolio />} />

            {/* Admin Routes — role-gated in the UI, enforced by RLS in the database */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin']} />}>
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/annonces" element={<AdminProperties />} />
              <Route path="/admin/utilisateurs" element={<AdminUsers />} />
              <Route path="/admin/signalements" element={<AdminReports />} />
              <Route path="/admin/agences" element={<AdminAgencies />} />
              <Route path="/admin/abonnements" element={<AdminSubscriptions />} />
              <Route path="/admin/paiements" element={<AdminPayments />} />
              <Route path="/admin/promotions" element={<AdminPromotions />} />
              <Route path="/admin/services" element={<AdminServices />} />
              <Route path="/admin/publicites" element={<AdminAds />} />
              <Route path="/admin/rapports" element={<AdminFinance />} />
              <Route path="/admin/parametres" element={<AdminSettings />} />
              <Route path="/admin/messages" element={<AdminInbox />} />
              <Route path="/admin/newsletter" element={<AdminNewsletter />} />
              <Route path="/admin/medias" element={<AdminMedia />} />
            </Route>
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
