import { useEffect, useState } from 'react';
import { Check, Copy, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  supabaseConfigDetails,
  verifySupabaseConnection,
  type ConnectionStatus,
} from '../../lib/supabase';
import migrationSql from '../../../supabase/migrations/001_initial_schema.sql?raw';

export function SupabaseSetupNotice() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    const res = await verifySupabaseConnection();
    setStatus(res);
    setChecking(false);
  };

  useEffect(() => {
    runCheck();
  }, []);

  const envSnippet = `VITE_SUPABASE_URL=https://your-project-ref.supabase.co\nVITE_SUPABASE_ANON_KEY=your-public-anon-key`;

  const copyText = async (text: string, which: 'env' | 'sql') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'env') {
        setCopiedEnv(true);
        setTimeout(() => setCopiedEnv(false), 2000);
      } else {
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 2000);
      }
    } catch {
      // ignore clipboard permissions error
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#E6E4DF] bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E6E4DF] pb-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1B4332]/10 text-[#1B4332]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Supabase Backend Setup Required
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Connect your Supabase project to enable administrator login, PostgreSQL storage, and live QR menus.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={runCheck}
          disabled={checking}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E6E4DF] bg-white px-3.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking...' : 'Verify Connection'}
        </button>
      </div>

      {/* Live Environment & Schema Status */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] p-3.5">
          <p className="text-xs font-medium text-zinc-500">VITE_SUPABASE_URL</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">
            {supabaseConfigDetails.hasUrl
              ? 'Configured'
              : supabaseConfigDetails.urlIssue?.includes('missing')
              ? 'Missing'
              : 'Invalid Format'}
          </p>
        </div>
        <div className="rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] p-3.5">
          <p className="text-xs font-medium text-zinc-500">VITE_SUPABASE_ANON_KEY</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">
            {supabaseConfigDetails.hasAnonKey ? 'Configured' : 'Missing'}
          </p>
        </div>
        <div className="rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] p-3.5">
          <p className="text-xs font-medium text-zinc-500">Database Schema</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">
            {status?.schemaReady ? 'Ready' : status?.connected ? 'Migration Needed' : 'Not Connected'}
          </p>
        </div>
      </div>

      {status && (
        <p className="mt-3 text-xs text-zinc-600">
          Status: {status.message}
        </p>
      )}

      {/* Exact Setup Steps */}
      <div className="mt-6 space-y-5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">
              1. Add Supabase Client Environment Variables
            </h3>
            <button
              type="button"
              onClick={() => copyText(envSnippet, 'env')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1B4332] hover:underline whitespace-nowrap shrink-0"
            >
              {copiedEnv ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedEnv ? 'Copied' : 'Copy snippet'}
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-600">
            Set <code className="font-mono text-zinc-800">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono text-zinc-800">VITE_SUPABASE_ANON_KEY</code> in your environment secrets (never add the <code className="font-mono text-zinc-800">service_role</code> key).
          </p>
          <pre className="mt-2 overflow-x-auto rounded-xl border border-[#E6E4DF] bg-[#111315] p-3.5 font-mono text-xs text-zinc-200">
            {envSnippet}
          </pre>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">
              2. Run SQL Schema, RLS Policies & Storage Bucket Migration
            </h3>
            <button
              type="button"
              onClick={() => copyText(migrationSql, 'sql')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1B4332] hover:underline whitespace-nowrap shrink-0"
            >
              {copiedSql ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedSql ? 'Copied SQL' : 'Copy full SQL'}
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-600">
            Open your Supabase Dashboard SQL Editor, paste <code className="font-mono text-zinc-800">supabase/migrations/001_initial_schema.sql</code>, and execute it.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] p-3.5 text-xs text-zinc-700">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1B4332]" />
          <div>
            <span className="font-semibold text-zinc-900">3. Provision Administrator Account: </span>
            In Supabase Dashboard go to Authentication &rarr; Users &rarr; Add user, create the restaurant administrator email/password, then sign in here.
          </div>
        </div>
      </div>
    </div>
  );
}
