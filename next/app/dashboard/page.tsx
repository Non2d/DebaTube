"use client";

import { useAtom } from 'jotai';
import { themeAtom } from '../../components/store/userAtom';
import Header from '../../components/shared/Header';
import { useRounds } from './hooks/useRoundsSummary';

export default function Dashboard() {
  const [isDark] = useAtom(themeAtom);
  const { rounds, loading, error } = useRounds();

  const bgColor = isDark ? 'bg-gray-900' : 'bg-white';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-gray-50';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';

  const totalRounds = rounds.length;
  const totalPois = rounds.reduce((sum, round) => sum + round.poi_count, 0);
  const totalRebuttals = rounds.reduce((sum, round) => sum + round.rebuttal_count, 0);
  const totalArgumentUnits = rounds.reduce((sum, round) => sum + round.total_argument_units, 0);

  if (loading) {
    return (
      <>
        <Header />
        <div className={`min-h-screen ${bgColor} ${textColor} pt-16`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">Loading...</div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div className={`min-h-screen ${bgColor} ${textColor} pt-16`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">Error loading rounds</div>
              <div className="text-gray-500">{error}</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className={`min-h-screen ${bgColor} ${textColor} pt-16`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-300">
              Overview of all debate rounds and their statistics
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className={`${cardBg} p-6 rounded-lg border ${borderColor}`}>
              <h3 className="text-lg font-semibold mb-4">Total Rounds</h3>
              <div className="text-3xl font-bold text-blue-600">{totalRounds}</div>
            </div>

            <div className={`${cardBg} p-6 rounded-lg border ${borderColor}`}>
              <h3 className="text-lg font-semibold mb-4">Total POIs</h3>
              <div className="text-3xl font-bold text-green-600">{totalPois}</div>
            </div>

            <div className={`${cardBg} p-6 rounded-lg border ${borderColor}`}>
              <h3 className="text-lg font-semibold mb-4">Total Rebuttals</h3>
              <div className="text-3xl font-bold text-purple-600">{totalRebuttals}</div>
            </div>

            <div className={`${cardBg} p-6 rounded-lg border ${borderColor}`}>
              <h3 className="text-lg font-semibold mb-4">Argument Units</h3>
              <div className="text-3xl font-bold text-orange-600">{totalArgumentUnits}</div>
            </div>
          </div>

          <div className={`${cardBg} p-6 rounded-lg border ${borderColor}`}>
            <h3 className="text-lg font-semibold mb-4">All Rounds</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">Title</th>
                    <th className="text-left py-2 px-4">Motion</th>
                    <th className="text-left py-2 px-4">POIs</th>
                    <th className="text-left py-2 px-4">Rebuttals</th>
                    <th className="text-left py-2 px-4">Speeches</th>
                    <th className="text-left py-2 px-4">Arguments</th>
                    <th className="text-left py-2 px-4">Tag</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((round) => (
                    <tr key={round.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <td className="py-2 px-4 max-w-xs truncate" title={round.title}>
                        {round.title}
                      </td>
                      <td className="py-2 px-4 max-w-xs truncate" title={round.motion}>
                        {round.motion}
                      </td>
                      <td className="py-2 px-4">{round.poi_count}</td>
                      <td className="py-2 px-4">{round.rebuttal_count}</td>
                      <td className="py-2 px-4">{round.speech_count}</td>
                      <td className="py-2 px-4">{round.total_argument_units}</td>
                      <td className="py-2 px-4">
                        <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs">
                          {round.tag}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}