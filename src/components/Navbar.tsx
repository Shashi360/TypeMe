import React, { useEffect, useRef, useState } from 'react';
import { User, AppView } from '../types';
import { User as UserIcon, LogOut, Menu, X, FolderOpen, Plus, Shield, BookOpen, Compass, PenTool, HelpCircle, Layers, Crown } from 'lucide-react';

interface NavbarProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  user: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onStartNewFont: () => void;
  onOpenQuiz: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  user,
  onOpenAuth,
  onLogout,
  onStartNewFont,
  onOpenQuiz,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  // The drawer stays mounted for the 300ms slide-out, then unmounts so the
  // off-canvas element can never expand the page's scrollable area.
  const [drawerMounted, setDrawerMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // Dismiss the account dropdown on outside click.
  useEffect(() => {
    if (!userDropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [userDropdownOpen]);

  useEffect(() => {
    if (mobileMenuOpen) {
      setDrawerMounted(true);
      return;
    }
    const t = window.setTimeout(() => setDrawerMounted(false), 320);
    return () => window.clearTimeout(t);
  }, [mobileMenuOpen]);

  // Smooth drawer behavior: lock body scroll + close on Escape.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen]);

  const scrollToAnchor = (anchorId: string) => {
    const el = document.getElementById(anchorId);
    if (el) {
      const headerOffset = 76;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);

  const handleNavClick = (view: AppView, anchorId?: string) => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    setActiveAnchor(anchorId ?? null);

    if (anchorId) {
      if (currentView !== 'landing') {
        setCurrentView('landing');
        setTimeout(() => {
          scrollToAnchor(anchorId);
        }, 120);
      } else {
        scrollToAnchor(anchorId);
      }
    } else {
      setCurrentView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Brand Wordmark: Type in clean sans + Me in handwriting */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleNavClick('landing')}
            className="flex items-center gap-2 group text-left cursor-pointer"
            title="TypeMe Home"
          >
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shadow-sm group-hover:bg-neutral-800 transition-colors">
              <span className="font-handwriting text-xl text-amber-200 font-bold">M</span>
            </div>
            <div className="flex items-baseline">
              <span className="text-xl font-bold tracking-tight text-neutral-900 font-sans">
                Type
              </span>
              <span className="text-2xl font-bold text-neutral-900 font-handwriting italic -ml-0.5">
                Me
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-neutral-600">
          {!user ? (
            <>
              <button
                onClick={() => handleNavClick('landing', 'how-it-works')}
                className={`transition-colors cursor-pointer ${
                  currentView === 'landing' && activeAnchor === 'how-it-works' ? 'text-neutral-900 font-semibold' : 'hover:text-neutral-900'
                }`}
              >
                How It Works
              </button>
              <button
                onClick={() => handleNavClick('landing', 'where-to-use')}
                className={`transition-colors cursor-pointer ${
                  currentView === 'landing' && activeAnchor === 'where-to-use' ? 'text-neutral-900 font-semibold' : 'hover:text-neutral-900'
                }`}
              >
                Everyday Mediums
              </button>
              <button
                onClick={() => handleNavClick('landing', 'personality')}
                className={`transition-colors cursor-pointer ${
                  currentView === 'landing' && activeAnchor === 'personality' ? 'text-neutral-900 font-semibold' : 'hover:text-neutral-900'
                }`}
              >
                Personality
              </button>
              <button
                onClick={() => handleNavClick('explore')}
                className={`transition-colors cursor-pointer ${
                  currentView === 'explore' ? 'text-neutral-900 font-semibold' : 'hover:text-neutral-900'
                }`}
              >
                Explore Styles
              </button>
              <button
                onClick={onOpenQuiz}
                className="hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1.5 text-neutral-700 font-medium"
              >
                <Compass className="w-3.5 h-3.5 text-neutral-900" />
                <span>Style Quiz</span>
              </button>
              <button
                onClick={() => handleNavClick('learn')}
                className={`transition-colors cursor-pointer ${
                  currentView === 'learn' ? 'text-neutral-900 font-semibold' : 'hover:text-neutral-900'
                }`}
              >
                TypeMe Learn
              </button>
              <button
                onClick={() => handleNavClick('pricing')}
                className={`transition-colors cursor-pointer ${
                  currentView === 'pricing' ? 'text-neutral-900 font-semibold' : 'hover:text-neutral-900'
                }`}
              >
                Pricing
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleNavClick('dashboard')}
                className={`transition-colors cursor-pointer ${
                  currentView === 'dashboard' ? 'text-neutral-900 font-semibold' : 'hover:text-neutral-900'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={onStartNewFont}
                className="hover:text-neutral-900 transition-colors cursor-pointer text-neutral-900 font-semibold"
              >
                + Create Font
              </button>
              <button
                onClick={() => handleNavClick('explore')}
                className={`transition-colors cursor-pointer ${
                  currentView === 'explore' ? 'text-neutral-900 font-semibold' : 'hover:text-neutral-900'
                }`}
              >
                Styles
              </button>
              <button
                onClick={() => handleNavClick('learn')}
                className={`transition-colors cursor-pointer ${
                  currentView === 'learn' ? 'text-neutral-900 font-semibold' : 'hover:text-neutral-900'
                }`}
              >
                Learn
              </button>
              <button
                onClick={() => handleNavClick('pricing')}
                className={`transition-colors cursor-pointer ${
                  currentView === 'pricing' ? 'text-neutral-900 font-semibold' : 'hover:text-neutral-900'
                }`}
              >
                Plans
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: CTA actions and Profile */}
        <div className="flex items-center gap-3">
          {!user ? (
            <>
              <button
                onClick={onOpenAuth}
                className="text-xs font-semibold text-neutral-700 hover:text-neutral-900 px-3 py-2 rounded-lg transition-colors cursor-pointer hidden sm:block"
              >
                Log In
              </button>
              <button
                onClick={onStartNewFont}
                className="text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5"
              >
                <span>Create Font</span>
              </button>
            </>
          ) : (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                aria-label="Account menu"
                aria-expanded={userDropdownOpen}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-neutral-100 transition-colors text-left cursor-pointer border border-neutral-200/80"
              >
                <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center text-[10px] font-mono font-bold">
                  {user.phone?.match(/^\+\d+/)?.[0] ?? (user.phone ? user.phone.slice(-2) : 'ME')}
                </div>
                <div className="hidden sm:block text-xs pr-1">
                  <span className="font-semibold text-neutral-900 block leading-tight">
                    {user.phone || 'My Account'}
                  </span>
                  <span className="text-[10px] text-neutral-400 capitalize font-mono">
                    {user.tier} Plan
                  </span>
                </div>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-neutral-200 py-1.5 z-50 text-xs text-neutral-700">
                  <div className="px-3 py-2 border-b border-neutral-100">
                    <p className="font-semibold text-neutral-900">{user.phone}</p>
                    <p className="text-[10px] font-mono text-neutral-400 capitalize">
                      {user.tier} Plan (Active)
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      handleNavClick('dashboard');
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 cursor-pointer ${
                      currentView === 'dashboard'
                        ? 'bg-neutral-900 text-white font-semibold'
                        : 'hover:bg-neutral-50'
                    }`}
                  >
                    <FolderOpen className={`w-3.5 h-3.5 ${currentView === 'dashboard' ? 'text-white' : 'text-neutral-500'}`} />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onStartNewFont();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Create New Font</span>
                  </button>
                  {user.tier === 'free' ? (
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        handleNavClick('pricing');
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Upgrade to Pro</span>
                    </button>
                  ) : (
                    <div className="w-full px-3 py-2 flex items-center gap-2 text-amber-800 font-semibold">
                      <Crown className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />
                      <span>Pro Plan Active</span>
                    </div>
                  )}
                  <div className="border-t border-neutral-100 my-1" />
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-700 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile menu toggle button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
            title="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile overlay + drawer (unmounted when fully closed) */}
      {drawerMounted ? (
      <>
      <div
        aria-hidden={!mobileMenuOpen}
        onClick={() => setMobileMenuOpen(false)}
        className={`fixed inset-0 z-[75] bg-neutral-900/30 backdrop-blur-[1px] transition-opacity duration-300 lg:hidden ${
          mobileMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      {/* Mobile Drawer Navigation — slides in from the right */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`fixed right-0 top-0 z-[80] flex h-dvh w-[85vw] max-w-xs flex-col bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div className="flex items-baseline">
            <span className="text-lg font-bold tracking-tight text-neutral-900 font-sans">Type</span>
            <span className="text-xl font-bold text-neutral-900 font-handwriting italic -ml-0.5">Me</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
            className="p-2 text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 text-xs">
          {!user ? (
            <>
              <button
                onClick={() => handleNavClick('landing', 'how-it-works')}
                className={`w-full text-left py-2 px-3 rounded-lg font-medium ${
                  currentView === 'landing' && activeAnchor === 'how-it-works' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'
                }`}
              >
                How It Works
              </button>
              <button
                onClick={() => handleNavClick('landing', 'where-to-use')}
                className={`w-full text-left py-2 px-3 rounded-lg font-medium ${
                  currentView === 'landing' && activeAnchor === 'where-to-use' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'
                }`}
              >
                Everyday Mediums
              </button>
              <button
                onClick={() => handleNavClick('landing', 'personality')}
                className={`w-full text-left py-2 px-3 rounded-lg font-medium ${
                  currentView === 'landing' && activeAnchor === 'personality' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'
                }`}
              >
                Personality & Alternates
              </button>
              <button
                onClick={() => handleNavClick('explore')}
                className={`w-full text-left py-2 px-3 rounded-lg font-medium ${
                  currentView === 'explore' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'
                }`}
              >
                Explore Styles
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenQuiz();
                }}
                className="w-full text-left py-2 px-3 rounded-lg hover:bg-neutral-50 font-medium flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Which Font Are You?</span>
              </button>
              <button
                onClick={() => handleNavClick('learn')}
                className={`w-full text-left py-2 px-3 rounded-lg font-medium ${
                  currentView === 'learn' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'
                }`}
              >
                TypeMe Learn
              </button>
              <button
                onClick={() => handleNavClick('pricing')}
                className={`w-full text-left py-2 px-3 rounded-lg font-medium ${
                  currentView === 'pricing' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'
                }`}
              >
                Pricing
              </button>
              <div className="pt-2 border-t border-neutral-100 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth();
                  }}
                  className="w-full py-2.5 text-center text-xs font-semibold text-neutral-800 bg-neutral-100 rounded-xl"
                >
                  Log In
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onStartNewFont();
                  }}
                  className="w-full py-2.5 text-center text-xs font-semibold text-white bg-neutral-900 rounded-xl shadow-sm"
                >
                  Create Font
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => handleNavClick('dashboard')}
                className={`w-full text-left py-2 px-3 rounded-lg font-medium ${
                  currentView === 'dashboard'
                    ? 'bg-neutral-900 text-white'
                    : 'hover:bg-neutral-50'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onStartNewFont();
                }}
                className="w-full text-left py-2 px-3 rounded-lg bg-neutral-900 text-white font-medium"
              >
                + Create Font
              </button>
              <button
                onClick={() => handleNavClick('pricing')}
                className={`w-full text-left py-2 px-3 rounded-lg font-medium ${
                  currentView === 'pricing'
                    ? 'bg-neutral-900 text-white'
                    : 'hover:bg-neutral-50'
                }`}
              >
                Plans
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full text-left py-2 px-3 rounded-lg hover:bg-rose-50 text-rose-700 font-medium"
              >
                Log Out
              </button>
            </>
          )}
        </div>
      </div>
      </>
      ) : null}
    </header>
  );
};
