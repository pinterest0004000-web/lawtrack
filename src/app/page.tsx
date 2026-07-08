'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const AppContent = dynamic(() => import('@/components/AppContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex flex-col bg-[#0a0f1a]">
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    </div>
  ),
});

export default function Home() {
  return <AppContent />;
}