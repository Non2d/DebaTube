"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '../../../context/LanguageContext';

export default function DashboardRedirect() {
  const router = useRouter();
  const { language } = useTranslation();

  useEffect(() => {
    if (!language) return;

    const savedTab = localStorage.getItem('dashboard_active_tab');
    if (savedTab === 'record') {
      router.replace(`/${language}/record?tab=dashboard`);
    } else {
      router.replace(`/${language}/dashboard/video`);
    }
  }, [router, language]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center">
        <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
        <div className="h-4 w-48 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}