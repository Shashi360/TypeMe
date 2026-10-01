import React, { useState } from 'react';
import { FontProject, User, CommunityFont } from '../types';
import { COMMUNITY_FONTS } from '../utils/sampleData';
import {
  Users,
  FileText,
  Activity,
  CreditCard,
  Download,
  ShieldCheck,
  ArrowLeft,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Settings,
} from 'lucide-react';

interface AdminViewProps {
  user: User;
  projects: FontProject[];
  onBackToDashboard: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  user,
  projects,
  onBackToDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'fonts' | 'community' | 'pricing' | 'health'>('overview');
  const [communityList, setCommunityList] = useState<CommunityFont[]>(COMMUNITY_FONTS);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock admin stats
  const totalUsers = 12480;
  const totalGenerations = 84210;
  const totalStorageGb = '34.2';
  const totalRevenue = '₹4,82,400';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div className="space-y-1">
          <button
            onClick={onBackToDashboard}
            className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 font-serif">
              TypeMe Admin Console
            </h1>
            <span className="text-[10px] bg-neutral-900 text-white px-2 py-0.5 rounded font-mono font-medium">
              SUPERADMIN
            </span>
          </div>
          <p className="text-xs text-neutral-500">
            System overview, font generation queue, user access, community approvals, and pricing configuration.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-neutral-700 font-medium font-mono">Engine Status: Healthy</span>
        </div>
      </div>

      {/* 2. Admin Nav Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-xl max-w-xl overflow-x-auto no-scrollbar">
        {[
          { id: 'overview' as const, label: 'Overview', icon: Activity },
          { id: 'fonts' as const, label: 'Font Projects', icon: FileText },
          { id: 'community' as const, label: 'Community Hub', icon: Users },
          { id: 'pricing' as const, label: 'Pricing Engine', icon: CreditCard },
          { id: 'health' as const, label: 'System Health', icon: HardDrive },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-3.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Tab Contents */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-2xs">
              <span className="text-xs text-neutral-500 block mb-1">Total Users</span>
              <div className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
                {totalUsers.toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-600 mt-1 block">+142 this week</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-2xs">
              <span className="text-xs text-neutral-500 block mb-1">Fonts Compiled</span>
              <div className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
                {totalGenerations.toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-600 mt-1 block">99.8% compiler success</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-2xs">
              <span className="text-xs text-neutral-500 block mb-1">Gross Revenue</span>
              <div className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
                {totalRevenue}
              </div>
              <span className="text-[10px] text-neutral-400 mt-1 block">Creator & Pro plans</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-2xs">
              <span className="text-xs text-neutral-500 block mb-1">Storage Utilized</span>
              <div className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
                {totalStorageGb} GB
              </div>
              <span className="text-[10px] text-neutral-400 mt-1 block">OpenType binary store</span>
            </div>
          </div>

          {/* Recent Generation Queue */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 font-serif">
                Recent Font Generations
              </h3>
              <span className="text-xs text-neutral-400 font-mono">Live WebSocket Feed</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-100 text-neutral-400">
                    <th className="pb-2 font-medium">Font Name</th>
                    <th className="pb-2 font-medium">Creator</th>
                    <th className="pb-2 font-medium">Characters</th>
                    <th className="pb-2 font-medium">Format</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-mono text-neutral-700">
                  <tr>
                    <td className="py-2.5 font-medium text-neutral-900">Shashi Handwriting</td>
                    <td className="py-2.5">Activity.shashi1403</td>
                    <td className="py-2.5">82 / 82</td>
                    <td className="py-2.5">TTF + OTF</td>
                    <td className="py-2.5 text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Success
                    </td>
                    <td className="py-2.5">380ms</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-neutral-900">Elena Journal Script</td>
                    <td className="py-2.5">+91 98210 44321</td>
                    <td className="py-2.5">52 / 52</td>
                    <td className="py-2.5">TTF</td>
                    <td className="py-2.5 text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Success
                    </td>
                    <td className="py-2.5">320ms</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-neutral-900">Architect Monoline</td>
                    <td className="py-2.5">+1 415 892 1022</td>
                    <td className="py-2.5">74 / 82</td>
                    <td className="py-2.5">TTF + OTF</td>
                    <td className="py-2.5 text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Success
                    </td>
                    <td className="py-2.5">410ms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fonts' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-base font-bold text-neutral-900 font-serif">
              All Active Workspace Fonts
            </h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search font projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-white focus:outline-none w-52"
              />
            </div>
          </div>

          <div className="divide-y divide-neutral-100">
            {projects.map((proj) => (
              <div key={proj.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-neutral-900 block font-serif text-sm">
                    {proj.name}
                  </span>
                  <span className="text-neutral-500 text-[11px]">
                    Created {proj.createdAt} · {proj.characterCount} characters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] bg-neutral-100 px-2 py-0.5 rounded text-neutral-600">
                    {proj.status}
                  </span>
                  <span className="font-mono text-[11px] text-neutral-400">
                    {proj.completionPercentage}% complete
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'community' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-900 font-serif">
                Community Story Moderation
              </h3>
              <p className="text-xs text-neutral-500">
                Curated user-submitted fonts featured in the TypeMe showcase.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {communityList.map((cf) => (
              <div key={cf.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-900">{cf.name}</span>
                  <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Approved
                  </span>
                </div>
                <p className="text-xs text-neutral-600 italic">"{cf.story}"</p>
                <div className="text-[11px] text-neutral-400 flex items-center justify-between pt-1">
                  <span>By {cf.creator}</span>
                  <span className="font-mono">{cf.downloads} downloads</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'pricing' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-neutral-900 font-serif">
            Configurable Pricing Tiers
          </h3>
          <p className="text-xs text-neutral-500">
            Adjust localized tier pricing and feature caps across regions.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
              <span className="text-xs font-semibold text-neutral-900 block">Free Tier</span>
              <span className="text-lg font-bold font-mono text-neutral-900">₹0</span>
              <span className="text-[11px] text-neutral-500 block mt-1">1 active font project</span>
            </div>
            <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
              <span className="text-xs font-semibold text-neutral-900 block">Creator Tier</span>
              <span className="text-lg font-bold font-mono text-neutral-900">₹199 / font</span>
              <span className="text-[11px] text-neutral-500 block mt-1">Single font license</span>
            </div>
            <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
              <span className="text-xs font-semibold text-neutral-900 block">Pro Subscription</span>
              <span className="text-lg font-bold font-mono text-neutral-900">₹499 / mo</span>
              <span className="text-[11px] text-neutral-500 block mt-1">Unlimited fonts & priority</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-neutral-900 font-serif">
            Infrastructure & Compiler Health
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-neutral-200">
              <span className="text-xs text-neutral-500 block">Vite Client Engine</span>
              <span className="text-sm font-bold text-emerald-600 block mt-1">Operational</span>
            </div>
            <div className="p-4 rounded-xl border border-neutral-200">
              <span className="text-xs text-neutral-500 block">OpenType.js Binary Compiler</span>
              <span className="text-sm font-bold text-emerald-600 block mt-1">Operational</span>
            </div>
            <div className="p-4 rounded-xl border border-neutral-200">
              <span className="text-xs text-neutral-500 block">Browser FontFace Registry</span>
              <span className="text-sm font-bold text-emerald-600 block mt-1">Operational</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
