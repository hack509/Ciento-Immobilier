import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

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
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
