import React, { useState, useEffect, useRef } from 'react';
import { FontProject, User, AppView, Stroke, LegalDoc } from './types';
import {
  createInitialSampleProject,
  createArchitectSampleProject,
  createNewProject,
  ALL_CHARACTERS,
} from './utils/sampleData';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { DashboardView } from './components/DashboardView';
import { WorkspaceView } from './components/WorkspaceView';
import { ReviewView } from './components/ReviewView';
import { PreviewStudioView } from './components/PreviewStudioView';
import { DownloadView } from './components/DownloadView';
import { PricingView } from './components/PricingView';
import { AuthModal } from './components/AuthModal';
import { OnboardingModal } from './components/OnboardingModal';
import { GenerationModal } from './components/GenerationModal';
import { StyleQuizModal } from './components/StyleQuizModal';
import { LearnView } from './components/LearnView';
import { StyleExplorerView } from './components/StyleExplorerView';
import LegalView from './components/LegalView';

export default function App() {
  // User state
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('typeme_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Projects state
  const [projects, setProjects] = useState<FontProject[]>(() => {
    try {
      const saved = localStorage.getItem('typeme_projects');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return [createInitialSampleProject(), createArchitectSampleProject()];
  });

  // Active project ID
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return projects[0]?.id || '';
  });

  // Navigation state
  const [currentView, setCurrentView] = useState<AppView>(() => {
    return user ? 'dashboard' : 'landing';
  });

  // Browser back/forward moves through app views instead of leaving the app.
  const historyInit = useRef(false);
  const popNavigating = useRef(false);
  useEffect(() => {
    // State changes caused by back/forward must not push a new entry,
    // or the forward stack would be destroyed.
    if (popNavigating.current) {
      popNavigating.current = false;
      return;
    }
    const state = { view: currentView, projectId: activeProjectId };
    try {
      if (!historyInit.current) {
        historyInit.current = true;
        window.history.replaceState(state, '');
      } else {
        window.history.pushState(state, '');
      }
    } catch {
      // ignore (non-browser contexts)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = e.state as { view?: AppView; projectId?: string } | null;
      if (!s || !s.view) return;
      popNavigating.current = true;
      if (s.projectId) setActiveProjectId(s.projectId);
      setCurrentView(s.view);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);

  // Legal document state
  const [legalDoc, setLegalDoc] = useState<LegalDoc>('privacy');

  const openLegal = (doc: LegalDoc) => {
    setLegalDoc(doc);
    setCurrentView('legal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync state to localStorage
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem('typeme_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('typeme_user');
      }
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem('typeme_projects', JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects]);

  // Active project helper
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  // Auth handler
  const handleAuthSuccess = (authenticatedUser: User, isNewUser: boolean) => {
    setUser(authenticatedUser);
    if (isNewUser) {
      setOnboardingModalOpen(true);
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('landing');
  };

  // Project management handlers
  const handleStartNewFont = () => {
    setOnboardingModalOpen(true);
  };

  const handleCreateProject = (name: string, description: string) => {
    const authorName = user?.name || 'You';
    const newProj = createNewProject(name, description, authorName);
    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setOnboardingModalOpen(false);
    setCurrentView('workspace');
  };

  const handleOpenProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setCurrentView('workspace');
  };

  const handleDuplicateProject = (projectId: string) => {
    const orig = projects.find((p) => p.id === projectId);
    if (!orig) return;

    const copy: FontProject = {
      ...JSON.parse(JSON.stringify(orig)),
      id: `font_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${orig.name} (Copy)`,
      createdAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      updatedAt: 'Just now',
      status: 'draft',
      ttfBlobUrl: undefined,
      otfBlobUrl: undefined,
    };

    setProjects((prev) => [copy, ...prev]);
  };

  const handleUpdateProjectName = (projectId: string, newName: string) => {
    const updated = projects.map((p) => (p.id === projectId ? { ...p, name: newName } : p));
    setProjects(updated);
    try {
      localStorage.setItem('typeme_projects', JSON.stringify(updated));
    } catch {}
  };

  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const handleDeleteProject = (projectId: string) => {
    if (projects.length <= 1) {
      setDeleteBlocked(true);
      return;
    }
    const updated = projects.filter((p) => p.id !== projectId);
    setProjects(updated);
    if (activeProjectId === projectId) {
      setActiveProjectId(updated[0].id);
    }
  };

  const handleUpdateCharacter = (
    char: string,
    strokes: Stroke[],
    variants?: Stroke[][],
    strokeStyles?: { brush: string; size: string }[],
    variantStyles?: { brush: string; size: string }[][],
  ) => {
    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.id !== activeProjectId) return proj;

        const updatedChars = { ...proj.characters };
        const oldData = updatedChars[char] || {
          char,
          unicode: char.charCodeAt(0),
          category: 'uppercase',
          strokes: [],
          qualityStatus: 'empty',
        };

        updatedChars[char] = {
          ...oldData,
          strokes,
          variants: variants || oldData.variants,
          strokeStyles: strokeStyles || oldData.strokeStyles,
          variantStyles: variantStyles || oldData.variantStyles,
          qualityStatus: strokes.length > 0 ? 'good' : 'empty',
          lastUpdated: Date.now(),
        };

        const completedCount = Object.values(updatedChars).filter(
          (c) => c.strokes && c.strokes.length > 0
        ).length;
        const totalChars = ALL_CHARACTERS.length;
        const completionPct = Math.round((completedCount / totalChars) * 100);

        return {
          ...proj,
          characters: updatedChars,
          characterCount: completedCount,
          completionPercentage: completionPct,
          updatedAt: 'Just now',
        };
      })
    );
  };

  // Generation complete handler
  const handleGenerationComplete = (result: {
    ttfBlobUrl: string;
    registeredFontFamily: string;
    fileSizeBytes: number;
  }) => {
    // Release previously generated blob URLs before replacing them so
    // repeated generations don't leak object URLs for the session.
    const prev = projects.find((p) => p.id === activeProjectId);
    if (prev?.ttfBlobUrl) {
      try {
        URL.revokeObjectURL(prev.ttfBlobUrl);
      } catch {}
    }
    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.id !== activeProjectId) return proj;
        return {
          ...proj,
          status: 'generated',
          ttfBlobUrl: result.ttfBlobUrl,
          otfBlobUrl: undefined,
          fontFamilyName: result.registeredFontFamily,
          fileSizeBytes: result.fileSizeBytes,
          lastGeneratedAt: 'Just now',
        };
      })
    );

    setGenerationModalOpen(false);
    setCurrentView('download');
  };

  // Increment download stats
  const handleIncrementDownload = () => {
    if (user) {
      setUser({
        ...user,
        totalDownloads: (user.totalDownloads || 0) + 1,
      });
    }
  };

  // Upgrade user tier
  const handleUpgradeTier = (tier: 'creator' | 'pro' = 'creator') => {
    if (user) {
      setUser({
        ...user,
        tier,
      });
    } else {
      setUser({
        phone: '+91 98765 43210',
        name: 'Creator',
        isLoggedIn: true,
        isAdmin: true,
        tier,
        fontsCreatedCount: 1,
        totalDownloads: 0,
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900 font-sans selection:bg-amber-100 selection:text-neutral-900">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        onStartNewFont={handleStartNewFont}
        onOpenQuiz={() => setQuizModalOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1">
        <div key={currentView} className="animate-fadeIn transition-all duration-300 ease-in-out">
          {currentView === 'landing' && (
            <LandingPage
              onStartWriting={() => {
                if (!user) {
                  handleStartNewFont();
                } else {
                  setCurrentView('dashboard');
                }
              }}
              onExploreStyles={() => setCurrentView('explore')}
              onOpenQuiz={() => setQuizModalOpen(true)}
              onOpenLearn={() => setCurrentView('learn')}
              onSeePricing={() => setCurrentView('pricing')}
            />
          )}

          {currentView === 'dashboard' && user && (
            <DashboardView
              user={user}
              projects={projects}
              onOpenProject={handleOpenProject}
              onCreateNewProject={handleStartNewFont}
              onDuplicateProject={handleDuplicateProject}
              onDeleteProject={handleDeleteProject}
              onUpdateProjectName={handleUpdateProjectName}
              onPreviewProject={(id) => {
                setActiveProjectId(id);
                setCurrentView('preview');
              }}
              onDownloadProject={(id) => {
                setActiveProjectId(id);
                setGenerationModalOpen(true);
              }}
            />
          )}

          {currentView === 'workspace' && activeProject && (
            <WorkspaceView
              project={activeProject}
              onUpdateCharacter={handleUpdateCharacter}
              onRenameProject={(name) => handleUpdateProjectName(activeProject.id, name)}
              tier={user?.tier ?? 'free'}
              onUpgrade={() => setCurrentView('pricing')}
              onBackToDashboard={() => setCurrentView(user ? 'dashboard' : 'landing')}
              onOpenReview={() => setCurrentView('review')}
              onOpenPreview={() => setCurrentView('preview')}
              onGenerateFont={() => setGenerationModalOpen(true)}
            />
          )}

          {currentView === 'review' && activeProject && (
            <ReviewView
              project={activeProject}
              onUpdateCharacter={handleUpdateCharacter}
              onBackToWorkspace={() => setCurrentView('workspace')}
              onContinueToPreview={() => setCurrentView('preview')}
              tier={user?.tier ?? 'free'}
              onUpgrade={() => setCurrentView('pricing')}
            />
          )}

          {currentView === 'preview' && activeProject && (
            <PreviewStudioView
              project={activeProject}
              onBackToWorkspace={() => setCurrentView('workspace')}
              onGenerateFont={() => setGenerationModalOpen(true)}
            />
          )}

          {currentView === 'download' && activeProject && (
            <DownloadView
              project={activeProject}
              onPreview={() => setCurrentView('preview')}
              onCreateAnother={handleStartNewFont}
              onBackToDashboard={() => setCurrentView(user ? 'dashboard' : 'landing')}
              onIncrementDownload={handleIncrementDownload}
              tier={user?.tier ?? 'free'}
              onUpgrade={() => setCurrentView('pricing')}
            />
          )}

          {currentView === 'learn' && (
            <LearnView
              onBackToHome={() => setCurrentView(user ? 'dashboard' : 'landing')}
              onStartWriting={() => {
                if (!user) handleStartNewFont();
                else setCurrentView('workspace');
              }}
            />
          )}

          {currentView === 'explore' && (
            <StyleExplorerView
              onBackToHome={() => setCurrentView(user ? 'dashboard' : 'landing')}
              onStartWriting={() => {
                if (!user) handleStartNewFont();
                else setCurrentView('workspace');
              }}
            />
          )}

          {currentView === 'legal' && (
            <LegalView
              doc={legalDoc}
              onOpenDoc={(doc) => {
                setLegalDoc(doc);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onNavigate={(view) => {
                setCurrentView(view);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onStartWriting={() => {
                if (!user) handleStartNewFont();
                else setCurrentView('dashboard');
              }}
            />
          )}

          {currentView === 'pricing' && (
            <PricingView
              user={user}
              onUpgradeTier={handleUpgradeTier}
              onStartFree={() => {
                if (!user) setAuthModalOpen(true);
                else setCurrentView('dashboard');
              }}
            />
          )}
        </div>
      </main>

      {/* Global Footer */}
      <Footer
        onNavigate={(view, anchorId) => {
          if (anchorId) {
            if (currentView !== 'landing') {
              setCurrentView('landing');
              setTimeout(() => {
                const el = document.getElementById(anchorId);
                if (el) {
                  const y = el.getBoundingClientRect().top + window.pageYOffset - 76;
                  window.scrollTo({ top: y, behavior: 'smooth' });
                }
              }, 120);
            } else {
              const el = document.getElementById(anchorId);
              if (el) {
                const y = el.getBoundingClientRect().top + window.pageYOffset - 76;
                window.scrollTo({ top: y, behavior: 'smooth' });
              }
            }
          } else {
            setCurrentView(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onStartWriting={() => {
          if (!user) handleStartNewFont();
          else setCurrentView('dashboard');
        }}
        onOpenLegal={openLegal}
        onExploreStyles={() => {
          setCurrentView('explore');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenLearn={() => {
          setCurrentView('learn');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        currentView={currentView}
        onOpenQuiz={() => setQuizModalOpen(true)}
      />

      {/* Auth Modal (Mobile OTP Flow) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Cannot-delete-last-font notice */}
      {deleteBlocked ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-neutral-900/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setDeleteBlocked(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Cannot delete font"
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl font-bold text-neutral-900">Keep at least one font</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              This is your last font project, so it can't be deleted. Create a new font first, then delete this one if you like.
            </p>
            <button
              type="button"
              onClick={() => setDeleteBlocked(false)}
              className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Okay
            </button>
          </div>
        </div>
      ) : null}

      {/* Onboarding Modal ("What should we call your font?") */}
      <OnboardingModal
        isOpen={onboardingModalOpen}
        onClose={() => setOnboardingModalOpen(false)}
        onCreateProject={handleCreateProject}
      />

      {/* Style Quiz Modal ("Which Font Are You?") */}
      <StyleQuizModal
        isOpen={quizModalOpen}
        onClose={() => setQuizModalOpen(false)}
        onStartFontWithStyle={(styleName) => {
          handleCreateProject(
            `My ${styleName} Font`,
            `Personal handwriting inspired by ${styleName}.`
          );
        }}
      />

      {/* Font Generation Modal (Compiles glyphs via opentype.js) */}
      {activeProject && (
        <GenerationModal
          isOpen={generationModalOpen}
          project={activeProject}
          onClose={() => setGenerationModalOpen(false)}
          onGenerationComplete={handleGenerationComplete}
          onReview={() => {
            setGenerationModalOpen(false);
            setCurrentView('review');
          }}
          tier={user?.tier ?? 'free'}
          onUpgrade={() => {
            setGenerationModalOpen(false);
            setCurrentView('pricing');
          }}
        />
      )}
    </div>
  );
}
