import React, { useState, Suspense, lazy, useEffect } from 'react';
import { UserRole } from './types';
import { AuthUser, getStoredAuthUser, setStoredAuthUser, getSupabaseUserRole } from './lib/auth';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { initAutoSyncListener } from './lib/syncEngine';
import { Navbar } from './components/Navbar';
import { LandingHero } from './components/LandingHero';
import { CitizenHome } from './components/CitizenHome';
import { AuthModal } from './components/AuthModal';
import { CardSkeleton, MapSkeleton } from './components/SkeletonLoader';

// Code splitting & Lazy Loading heavy routes (MapScreen & AdminDashboard)
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const MapScreen = lazy(() => import('./components/MapScreen').then(m => ({ default: m.MapScreen })));

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredAuthUser());
  const [activeTab, setActiveTab] = useState<'landing' | 'admin' | 'citizen' | 'map'>('landing');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Sync Supabase session/profile role & register offline sync listener
  useEffect(() => {
    const cleanupSync = initAutoSyncListener();

    getSupabaseUserRole().then((user) => {
      if (user) {
        setCurrentUser(user);
      }
    });

    let authUnsub: (() => void) | undefined;
    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const user = await getSupabaseUserRole();
          if (user) setCurrentUser(user);
        } else if (event === 'SIGNED_OUT') {
          setStoredAuthUser(null);
          setCurrentUser(null);
          setActiveTab('landing');
        }
      });
      authUnsub = () => subscription.unsubscribe();
    }

    return () => {
      cleanupSync();
      if (authUnsub) authUnsub();
    };
  }, []);

  // Enforce Admin route protection: If activeTab === 'admin' and user is not admin
  useEffect(() => {
    if (activeTab === 'admin' && currentUser?.role !== 'admin') {
      console.warn('Unauthorized access to Admin Dashboard. Redirecting.');
      setActiveTab(currentUser?.role === 'citizen' ? 'citizen' : 'landing');
    }
  }, [activeTab, currentUser]);

  const handleTabChange = (tab: 'landing' | 'admin' | 'citizen' | 'map') => {
    if (tab === 'admin' && currentUser?.role !== 'admin') {
      console.warn('Access denied: Citizen accounts cannot view Admin Dashboard');
      setActiveTab('landing');
      return;
    }
    setActiveTab(tab);
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setActiveTab('admin');
    } else {
      setActiveTab('citizen');
    }
  };

  const handleLogout = () => {
    setStoredAuthUser(null);
    setCurrentUser(null);
    setActiveTab('landing');
  };

  const handleOpenAuth = (_intendedRole?: UserRole) => {
    setIsAuthModalOpen(true);
  };

  const effectiveRole: UserRole = currentUser?.role || 'citizen';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-500 selection:text-white">
      
      {/* Navbar */}
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* View Switcher */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'landing' && (
          <LandingHero
            onOpenAuth={handleOpenAuth}
            onExploreMap={() => setActiveTab('map')}
          />
        )}

        {activeTab === 'citizen' && (
          <CitizenHome
            currentUser={currentUser}
            onNavigateMap={() => setActiveTab('map')}
            onRedirectToLogin={() => setIsAuthModalOpen(true)}
          />
        )}

        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <Suspense fallback={
            <div className="p-8 max-w-7xl mx-auto w-full">
              <CardSkeleton count={4} />
            </div>
          }>
            <AdminDashboard currentUser={currentUser} onRedirectHome={() => setActiveTab('citizen')} />
          </Suspense>
        )}

        {activeTab === 'map' && (
          <Suspense fallback={<MapSkeleton />}>
            <MapScreen userRole={effectiveRole} />
          </Suspense>
        )}
      </main>

      {/* Auth Modal with Hardcoded Accounts */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={handleLoginSuccess}
      />

    </div>
  );
}

