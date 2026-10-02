import React, { useMemo, useState } from 'react';
import { FontProject } from '../types';
import {
  Download,
  CheckCircle2,
  ArrowRight,
  Eye,
  FileCode,
  Copy,
  Check,
  FolderOpen,
  Laptop,
  Share2,
  Image,
  Lock,
} from 'lucide-react';
import { getEntitlements, upgradeForDownload, type UpgradeCopy } from '../utils/entitlements';
import { UpgradeModal } from './UpgradeModal';

interface DownloadViewProps {
  project: FontProject;
  onPreview: () => void;
  onCreateAnother: () => void;
  onBackToDashboard: () => void;
  onIncrementDownload: () => void;
  tier?: string;
  onUpgrade?: () => void;
}

export const DownloadView: React.FC<DownloadViewProps> = ({
  project,
  onPreview,
  onCreateAnother,
  onBackToDashboard,
  onIncrementDownload,
  tier = 'free',
  onUpgrade,
}) => {
  const [copiedCss, setCopiedCss] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  const cleanFileName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'MyHandwriting';

  // Format file size
  const sizeKb = project.fileSizeBytes
    ? (project.fileSizeBytes / 1024).toFixed(1)
    : '28.4';

  const ent = useMemo(() => getEntitlements(tier), [tier]);
  const [upgrade, setUpgrade] = useState<UpgradeCopy | null>(null);

  const handleDownload = (type: 'ttf' | 'otf') => {
    if (!ent.canDownloadFont()) {
      setUpgrade(upgradeForDownload);
      return;
    }
    const url = type === 'ttf' ? project.ttfBlobUrl : project.otfBlobUrl;
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanFileName}.${type}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    onIncrementDownload();
  };

  const cssSnippet = `@font-face {
  font-family: '${project.name}';
  src: url('${cleanFileName}.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}`;

  const handleCopyCss = () => {
    navigator.clipboard.writeText(cssSnippet);
    setCopiedCss(true);
    setTimeout(() => setCopiedCss(false), 2000);
  };

  const handleCopyShareLink = () => {
    const fakeUrl = `${window.location.origin}/font/${project.id}`;
    navigator.clipboard.writeText(fakeUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2000);
  };

  const previewFont = project.fontFamilyName
    ? `"${project.fontFamilyName}", "Caveat", cursive`
    : '"Caveat", cursive';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* 1. Success Hero Box */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8 sm:p-10 shadow-sm text-center relative overflow-hidden">
        <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 font-serif tracking-tight">
          Your handwriting just became a font.
        </h1>
        <p className="text-sm text-neutral-600 max-w-md mx-auto mt-2 leading-relaxed">
          You turned your hand strokes into a permanent digital typeface. Ready to download and install on any compatible system.
        </p>

        {/* Live Font Sample Showcase */}
        <div className="mt-8 p-6 rounded-2xl bg-neutral-50/80 border border-neutral-200/80 max-w-2xl mx-auto">
          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block mb-2">
            Specimen: {project.name}
          </span>
          <div
            className="text-3xl sm:text-4xl text-neutral-900 my-2 leading-snug break-words"
            style={{ fontFamily: previewFont }}
          >
            "I made a font out of me."
          </div>
          <div
            className="text-lg text-neutral-600 tracking-wider truncate"
            style={{ fontFamily: previewFont }}
          >
            Aa Bb Cc Dd Ee Ff Gg 0 1 2 3 4 5 ! ?
          </div>
        </div>
      </div>

      {/* 2. Download Options Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-neutral-900 font-serif">Download Formats</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TTF Card */}
          <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-neutral-900 text-white">
                  TTF
                </span>
                <span className="text-xs text-neutral-400 font-mono tabular-nums">{sizeKb} KB</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 font-serif">TrueType Font</h3>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                Most widely supported format. Compatible with macOS, Windows, iPad, iPhone, Word, Photoshop, and Procreate.
              </p>
            </div>

            <button
              onClick={() => handleDownload('ttf')}
              disabled={!project.ttfBlobUrl}
              className="mt-6 w-full py-2.5 px-4 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {ent.canDownloadFont() ? <Download className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>Download TrueType (.ttf)</span>
              {!ent.canDownloadFont() ? (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 px-1.5 py-0.5 rounded">Pro</span>
              ) : null}
            </button>
          </div>

          {/* OTF Card */}
          <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200">
                  OTF
                </span>
                <span className="text-xs text-neutral-400 font-mono tabular-nums">{sizeKb} KB</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 font-serif">OpenType Font</h3>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                Advanced vector font format supporting alternate glyph tables and high-precision typographic metrics in design software.
              </p>
            </div>

            <button
              onClick={() => handleDownload('otf')}
              disabled={!project.otfBlobUrl}
              className="mt-6 w-full py-2.5 px-4 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 rounded-xl transition-colors border border-neutral-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              {ent.canDownloadFont() ? <Download className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>Download OpenType (.otf)</span>
              {!ent.canDownloadFont() ? (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-neutral-900/10 px-1.5 py-0.5 rounded">Pro</span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Social / Shareable Moment Card */}
      <div className="p-6 sm:p-8 bg-neutral-900 text-white rounded-3xl shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-mono uppercase tracking-wider mb-1">
              <Share2 className="w-3.5 h-3.5" />
              <span>Shareable Specimen Card</span>
            </div>
            <h3 className="text-xl font-bold font-serif">Show someone your font.</h3>
            <p className="text-xs text-neutral-400">
              Share your custom handwriting specimen on Instagram, Twitter, or with friends.
            </p>
          </div>

          <button
            onClick={handleCopyShareLink}
            className="px-4 py-2 text-xs font-semibold text-neutral-900 bg-white hover:bg-neutral-100 rounded-xl transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            {copiedShareLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Share My Font</span>
              </>
            )}
          </button>
        </div>

        {/* The Graphic Specimen Preview Box */}
        <div className="p-6 rounded-2xl bg-neutral-800/80 border border-neutral-700 text-center space-y-3">
          <div className="flex items-baseline justify-center">
            <span className="text-sm font-bold font-sans text-neutral-400 tracking-wider">TYPE</span>
            <span className="text-base font-bold font-handwriting italic text-amber-200 -ml-0.5">ME</span>
          </div>
          <p className="text-xs text-neutral-400 uppercase tracking-widest font-mono">
            This is my handwriting.
          </p>
          <div
            className="text-3xl sm:text-4xl text-white my-3 leading-snug"
            style={{ fontFamily: previewFont }}
          >
            "{project.name}"
          </div>
          <span className="text-[11px] text-neutral-500 font-mono block">
            Hand-drawn & compiled with TypeMe
          </span>
        </div>
      </div>

      {/* 4. Installation Guide (macOS, Windows, Mobile) */}
      <div className="p-6 bg-white rounded-2xl border border-neutral-200 shadow-2xs space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
          <Laptop className="w-3.5 h-3.5" />
          <span>What can you do with your TypeMe font? (Installation Guide)</span>
        </h4>
        <p className="text-xs text-neutral-500 leading-relaxed">
          If an application supports installed or custom fonts on your operating system, your TypeMe font can be selected from the standard font picker.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs text-neutral-600">
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80">
            <span className="font-semibold text-neutral-900 block mb-1">macOS</span>
            <p className="leading-relaxed">
              Double-click the downloaded <code>.ttf</code> file. Click "Install Font" in the Font Book app. Select in Pages, Keynote, Word, or Figma.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80">
            <span className="font-semibold text-neutral-900 block mb-1">Windows</span>
            <p className="leading-relaxed">
              Right-click the <code>.ttf</code> file and choose "Install" (or "Install for all users"). Re-open Microsoft Word, Photoshop, or PowerPoint.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80">
            <span className="font-semibold text-neutral-900 block mb-1">iPad & Mobile</span>
            <p className="leading-relaxed">
              Install via any configuration profile app such as iFont or AnyFont. Your handwriting becomes available directly inside Procreate & GoodNotes.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Web Embed CSS Snippet */}
      <div className="p-6 bg-white rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-700 flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-neutral-500" />
            <span>Web Embed Code (CSS @font-face)</span>
          </span>
          <button
            onClick={handleCopyCss}
            className="text-xs text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
          >
            {copiedCss ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy CSS</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-mono text-neutral-800 overflow-x-auto">
          {cssSnippet}
        </pre>
      </div>

      {/* 6. Footer Navigation */}
      <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200">
        <button
          onClick={onBackToDashboard}
          className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onPreview}
            className="px-4 py-2 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Test in Preview Studio</span>
          </button>
          <button
            onClick={onCreateAnother}
            className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>Create Another Font</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <UpgradeModal
        open={!!upgrade}
        feature={upgrade?.feature ?? ""}
        description={upgrade?.description ?? ""}
        onClose={() => setUpgrade(null)}
        onUpgrade={onUpgrade}
      />
    </div>
  );
};
