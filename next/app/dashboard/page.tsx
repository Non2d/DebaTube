"use client";

import { useAtom } from 'jotai';
import { themeAtom } from '../../components/store/userAtom';
import Header from '../../components/shared/Header';

export default function Dashboard() {
  const [isDark] = useAtom(themeAtom);

  const bgColor = isDark ? 'bg-gray-900' : 'bg-white';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-gray-50';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';

  return (
    <>
      <Header />
      <div className={`min-h-screen ${bgColor} ${textColor} pt-16`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Analytics and insights for your debate analysis
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className={`${cardBg} p-6 rounded-lg border ${borderColor}`}>
            <h3 className="text-lg font-semibold mb-4">Total Videos Analyzed</h3>
            <div className="text-3xl font-bold text-blue-600">24</div>
            <p className="text-sm text-gray-500 mt-2">+3 this week</p>
          </div>

          <div className={`${cardBg} p-6 rounded-lg border ${borderColor}`}>
            <h3 className="text-lg font-semibold mb-4">Average Analysis Time</h3>
            <div className="text-3xl font-bold text-green-600">2.4m</div>
            <p className="text-sm text-gray-500 mt-2">-15s from last week</p>
          </div>

          <div className={`${cardBg} p-6 rounded-lg border ${borderColor}`}>
            <h3 className="text-lg font-semibold mb-4">Arguments Detected</h3>
            <div className="text-3xl font-bold text-purple-600">156</div>
            <p className="text-sm text-gray-500 mt-2">+12 this week</p>
          </div>
        </div>

        <div className="mt-8">
          <div className={`${cardBg} p-6 rounded-lg border ${borderColor}`}>
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span>Analyzed "Oxford Union Debate on AI Ethics"</span>
                <span className="text-sm text-gray-500">2 hours ago</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span>Generated visualization for "Cambridge Parliamentary Finals"</span>
                <span className="text-sm text-gray-500">1 day ago</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Exported analysis report for "World Schools Championship"</span>
                <span className="text-sm text-gray-500">3 days ago</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}