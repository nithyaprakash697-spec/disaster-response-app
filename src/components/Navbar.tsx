import React, { useState } from 'react';
import { ShieldAlert, Users, Radio, Map, Home, Activity, LogOut, UserCheck, Menu, X } from 'lucide-react';
import { UserRole } from '../types';
import { AuthUser } from '../lib/auth';
import { SyncStatusBadge } from './SyncStatusBadge';

interface Props {
  currentUser: AuthUser | null;
  activeTab: 'landing' | 'admin' | 'citizen' | 'map';
  setActiveTab: (tab: 'landing' | 'admin' | 'citizen' | 'map') => void;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<Props> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onOpenAuthModal,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const isCitizen = currentUser?.role === 'citizen';
  const isAdmin = currentUser?.role === 'admin';

  // Build nav items dynamically based on user role
  const navItems = [
    {
      id: 'landing' as const,
      label: 'Overview',
      shortLabel: 'Overview',
      icon: Home,
      iconColor: '',
      show: true,
      className: activeTab === 'landing'
        ? 'bg-slate-800 text-white border border-slate-700'
        : 'text-slate-400 hover:text-slate-200'
    },
    {
      id: 'citizen' as const,
      label: 'Citizen Portal',
      shortLabel: 'Citizen',
      icon: Users,
      iconColor: 'text-amber-400',
      show: isCitizen,
      className: activeTab === 'citizen'
        ? 'bg-amber-950/90 text-amber-300 border border-amber-800 shadow-sm'
        : 'text-slate-400 hover:text-slate-200'
    },
    {
      id: 'admin' as const,
      label: 'Admin Dashboard',
      shortLabel: 'Admin',
      icon: Activity,
      iconColor: 'text-red-400',
      show: isAdmin,
      className: activeTab === 'admin'
        ? 'bg-red-950/90 text-red-300 border border-red-800 shadow-sm'
        : 'text-slate-400 hover:text-slate-200'
    },
    {
      id: 'map' as const,
      label: 'GIS Map',
      shortLabel: 'GIS Map',
      icon: Map,
      iconColor: 'text-blue-400',
      show: true,
      className: activeTab === 'map'
        ? 'bg-blue-950/90 text-blue-300 border border-blue-800 shadow-sm'
        : 'text-slate-400 hover:text-slate-200'
    }
  ].filter(item => item.show);

  const handleNavClick = (id: 'landing' | 'admin' | 'citizen' | 'map') => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-[2000] bg-slate-950/95 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => handleNavClick('landing')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-900/40 shrink-0">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white font-display whitespace-nowrap">
                Disaster Response Hub
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
                <Radio className="w-3 h-3 animate-pulse" /> Live
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden lg:block whitespace-nowrap">
              Multi-Agent AI Crisis Network & Telemetry
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1.5 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap min-h-[40px] ${item.className}`}
              >
                <Icon className={`w-4 h-4 ${item.iconColor} shrink-0`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions: Sync Status, Auth & Mobile Menu Button */}
        <div className="flex items-center gap-2 shrink-0">
          <SyncStatusBadge />

          {/* Desktop Auth Badge */}
          <div className="hidden md:flex items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onOpenAuthModal}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 flex items-center gap-2 transition-all shadow-sm min-h-[40px]"
                >
                  <UserCheck className={`w-4 h-4 ${currentUser.role === 'admin' ? 'text-red-400' : 'text-amber-400'} shrink-0`} />
                  <span className="text-[11px] font-mono text-slate-300 max-w-[140px] truncate">
                    {currentUser.email}
                  </span>
                  <span className={`capitalize text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    currentUser.role === 'admin'
                      ? 'bg-red-950 text-red-300 border border-red-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {currentUser.role}
                  </span>
                </button>

                <button
                  onClick={onLogout}
                  title="Sign Out / Switch Account"
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white transition-all shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-md flex items-center gap-2 hover:brightness-110 whitespace-nowrap min-h-[40px]"
              >
                <span>Sign In</span>
              </button>
            )}
          </div>

          {/* Mobile Hamburger Menu Toggle Button (Touch size >= 44px) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6 text-amber-400" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

      </div>

      {/* Mobile Slide-down Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-b border-slate-800 px-4 py-4 space-y-3 animate-in slide-in-from-top duration-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
            Navigation
          </div>

          <div className="grid grid-cols-1 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-between transition-all min-h-[48px] ${item.className}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${item.iconColor}`} />
                    <span>{item.label}</span>
                  </div>
                  {activeTab === item.id && (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* User Account / Sign In section in Mobile Drawer */}
          <div className="pt-3 border-t border-slate-800/80">
            {currentUser ? (
              <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <UserCheck className={`w-4 h-4 ${currentUser.role === 'admin' ? 'text-red-400' : 'text-amber-400'} shrink-0`} />
                    <span className="text-xs font-mono text-slate-200 truncate">
                      {currentUser.email}
                    </span>
                  </div>
                  <span className={`capitalize text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                    currentUser.role === 'admin'
                      ? 'bg-red-950 text-red-300 border border-red-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {currentUser.role}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { onOpenAuthModal(); setMobileMenuOpen(false); }}
                    className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    Switch Account
                  </button>
                  <button
                    onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                    className="w-full py-2.5 px-3 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { onOpenAuthModal(); setMobileMenuOpen(false); }}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-lg flex items-center justify-center gap-2 hover:brightness-110 min-h-[48px]"
              >
                <span>Sign In to Disaster Hub</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

