import React, { useState } from 'react';
import { FontProject, User } from '../types';
import {
  Plus,
  Search,
  Download,
  Edit2,
  Trash2,
  Copy,
  Eye,
  CheckCircle,
  FileText,
  ArrowRight,
} from 'lucide-react';

interface DashboardViewProps {
  user: User;
  projects: FontProject[];
  onOpenProject: (projectId: string) => void;
  onCreateNewProject: () => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onPreviewProject: (projectId: string) => void;
  onDownloadProject: (projectId: string) => void;
  onUpdateProjectName: (projectId: string, newName: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  projects,
  onOpenProject,
  onCreateNewProject,
  onDuplicateProject,
  onDeleteProject,
  onPreviewProject,
  onDownloadProject,
  onUpdateProjectName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'completion' | 'name'>('recent');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [pendingDelete, setPendingDelete] = useState<FontProject | null>(null);

  // Compute metrics across projects (always real counts, never demo floors)
  const myFontsCount = projects.length;
  const totalCharacters = projects.reduce((acc, p) => acc + (p.characterCount || 0), 0);
  const generatedCount = projects.filter((p) => p.status === 'generated').length;
  const downloadsCount = user.totalDownloads || 0;

  // Filter & sort
  const filteredProjects = projects
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'completion') return b.completionPercentage - a.completionPercentage;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* 1. Header (Prompt Section 21) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
            TypeMe Dashboard
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 font-serif tracking-tight mt-0.5">
            Good to see you.
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Your handwriting journey starts here.
          </p>
        </div>

        <button
          onClick={onCreateNewProject}
          className="px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Font</span>
        </button>
      </div>

      {/* 2. Dashboard Stat Cards (Prompt Section 21) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-2xs">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
            MY FONTS
          </span>
          <div className="text-3xl font-extrabold font-mono tabular-nums text-neutral-900">
            {myFontsCount}
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 block">Active typefaces</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-2xs">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
            CHARACTERS
          </span>
          <div className="text-3xl font-extrabold font-mono tabular-nums text-neutral-900">
            {totalCharacters}
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 block">Vectorized glyphs</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-2xs">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
            GENERATED
          </span>
          <div className="text-3xl font-extrabold font-mono tabular-nums text-neutral-900">
            {generatedCount}
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 block">Compiled OpenType binaries</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-2xs">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
            DOWNLOADS
          </span>
          <div className="text-3xl font-extrabold font-mono tabular-nums text-neutral-900">
            {downloadsCount}
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 block">Installed on devices</span>
        </div>
      </div>

      {/* 3. Main Section: Your Fonts (Prompt Section 21) */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 font-serif">Your Fonts</h2>
            <p className="text-xs text-neutral-500">
              Manage your personal handwriting typefaces and drafts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search fonts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-900 w-44 sm:w-56"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-1.5 px-3 text-xs rounded-xl border border-neutral-200 bg-white text-neutral-700 focus:outline-none"
            >
              <option value="recent">Recently Created</option>
              <option value="completion">Completion %</option>
              <option value="name">Alphabetical</option>
            </select>
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const isReady = project.status === 'generated' || project.completionPercentage >= 80;

            return (
              <div
                key={project.id}
                className="rounded-3xl border border-neutral-200 bg-white hover:border-neutral-300 transition-all shadow-2xs flex flex-col justify-between overflow-hidden group"
              >
                {/* Saved Font Name Block Area */}
                <div className="p-4 bg-neutral-900 text-white flex items-center justify-between transition-colors">
                  <div className="flex-1 pr-2">
                    <span className="text-[10px] font-mono text-amber-300 uppercase tracking-widest block">
                      Saved Font Name
                    </span>
                    {editingProjectId === project.id ? (
                      <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          className="w-full px-2.5 py-1 text-sm bg-neutral-800 text-white rounded border border-amber-400 focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editNameValue.trim()) {
                              onUpdateProjectName(project.id, editNameValue.trim());
                              setEditingProjectId(null);
                            } else if (e.key === 'Escape') {
                              setEditingProjectId(null);
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (editNameValue.trim()) {
                              onUpdateProjectName(project.id, editNameValue.trim());
                              setEditingProjectId(null);
                            }
                          }}
                          className="px-2.5 py-1 bg-amber-400 text-neutral-900 font-semibold rounded text-xs hover:bg-amber-300 transition-colors cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/name">
                        <h3
                          onClick={() => onOpenProject(project.id)}
                          className="text-base font-bold font-serif truncate mt-0.5 cursor-pointer hover:underline"
                        >
                          {project.name}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProjectId(project.id);
                            setEditNameValue(project.name);
                          }}
                          className="p-1 text-neutral-400 hover:text-amber-300 transition-colors opacity-80 group-hover/name:opacity-100 cursor-pointer"
                          title="Edit Saved Font Name"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-white/10 text-white font-medium shrink-0">
                    {project.completionPercentage}% Ready
                  </span>
                </div>

                {/* Visual Header */}
                <div
                  onClick={() => onOpenProject(project.id)}
                  className="p-6 bg-neutral-50/70 border-b border-neutral-100 cursor-pointer min-h-[140px] flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-mono text-neutral-400">
                      {project.createdAt}
                    </span>
                    {isReady ? (
                      <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 font-mono">
                        Ready ✓
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full font-medium font-mono">
                        {project.completionPercentage}% Complete
                      </span>
                    )}
                  </div>

                  {/* Handwriting Ribbon */}
                  <div className="py-2 overflow-hidden text-neutral-800">
                    <div className="font-handwriting text-3xl tracking-wider truncate">
                      Aa Bb Cc Dd Ee
                    </div>
                    <p className="text-[11px] text-neutral-500 italic truncate mt-1">
                      "Write it once. Type it forever."
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                      <span>{project.characterCount} characters written</span>
                      <span>{project.completionPercentage}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                      <div
                        className="h-full bg-neutral-900 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(project.completionPercentage, 20)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Body & Actions */}
                <div className="p-5 space-y-3">
                  <div>
                    <h3
                      onClick={() => onOpenProject(project.id)}
                      className="text-base font-bold text-neutral-900 hover:text-neutral-700 cursor-pointer font-serif truncate"
                    >
                      {project.name}
                    </h3>
                    <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
                      {project.description || 'Personal handwriting typeface'}
                    </p>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenProject(project.id)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Continue</span>
                      </button>
                      <button
                        onClick={() => onPreviewProject(project.id)}
                        className="px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1 border border-neutral-200"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview</span>
                      </button>
                      <button
                        onClick={() => onDownloadProject(project.id)}
                        className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                        title="Download font"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => onDuplicateProject(project.id)}
                        className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                        title="Duplicate font"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPendingDelete(project)}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete font"
                        aria-label={`Delete ${project.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirmation */}
      {pendingDelete ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm"
          onClick={() => setPendingDelete(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Delete ${pendingDelete.name}`}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
              <Trash2 className="h-5 w-5 text-rose-600" />
            </div>
            <h3 className="mt-3 font-serif text-xl font-bold text-neutral-900">Delete this font?</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              “{pendingDelete.name}” and all its handwriting will be permanently removed. This cannot be undone.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onDeleteProject(pendingDelete.id);
                  setPendingDelete(null);
                }}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
              >
                Delete font
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Keep it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
