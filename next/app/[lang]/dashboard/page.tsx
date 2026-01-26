"use client";

import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../../components/shared/Header';
import { useRounds } from './hooks/useRoundsSummary';
import { useTranslation } from '../../../context/LanguageContext';
import { type BackgroundStepStatus } from '../../../components/lib/utils';
import Step1ProgressCircle from './components/Step1ProgressCircle';

export default function VideoDashboard() {
  const { rounds, loading, error, pagination, jobProgress } = useRounds('external_video');
  const { t, language } = useTranslation();
  const router = useRouter();

  // Use the total from pagination for the total count widget
  // Note: counts for POIs/Rebuttals are now only for the current page
  const totalRounds = pagination ? pagination.total : 0;
  const totalPois = rounds.reduce((sum, round) => sum + round.poi_count, 0);
  const totalRebuttals = rounds.reduce((sum, round) => sum + round.rebuttal_count, 0);
  const totalArgumentUnits = rounds.reduce((sum, round) => sum + round.total_argument_units, 0);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background text-foreground pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">{t('dashboard.title')}</h1>
              <p className="text-gray-600 dark:text-gray-300">
                {t('dashboard.description')}
              </p>
            </div>
            <Link
              href={`/${language}/dashboard/new`}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md dark:shadow-indigo-500/20"
            >
              <Plus className="w-5 h-5" />
              {t('dashboard.registerNewRound')}
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4">{t('dashboard.stats.totalRounds')}</h3>
              <div className="text-3xl font-bold text-blue-600">
                {loading ? (
                  <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-9 w-16 rounded"></div>
                ) : (
                  totalRounds
                )}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4">{t('dashboard.stats.totalPois')} <span className="text-xs text-gray-500 font-normal">(Page)</span></h3>
              <div className="text-3xl font-bold text-green-600">
                {loading ? (
                  <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-9 w-16 rounded"></div>
                ) : (
                  totalPois
                )}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4">{t('dashboard.stats.totalRebuttals')} <span className="text-xs text-gray-500 font-normal">(Page)</span></h3>
              <div className="text-3xl font-bold text-purple-600">
                {loading ? (
                  <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-9 w-16 rounded"></div>
                ) : (
                  totalRebuttals
                )}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4">{t('dashboard.stats.argumentUnits')} <span className="text-xs text-gray-500 font-normal">(Page)</span></h3>
              <div className="text-3xl font-bold text-orange-600">
                {loading ? (
                  <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-9 w-16 rounded"></div>
                ) : (
                  totalArgumentUnits
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="mb-6">
              <h3 className="text-lg font-semibold">{t('dashboard.table.title')}</h3>
            </div>

            {error ? (
              <div className="text-center py-8">
                <div className="text-red-500 mb-2">{t('dashboard.table.error')}</div>
                <div className="text-gray-500 text-sm">{error}</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-4 w-[280px]">{t('dashboard.table.headers.title')}</th>
                      <th className="text-left py-2 px-4 w-[60px]">{t('dashboard.table.headers.style')}</th>
                      <th className="text-left py-2 px-4">{t('dashboard.table.headers.motion')}</th>
                      <th className="text-left py-2 px-4 w-[120px]">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                          <td className="py-2 px-4">
                            <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-4 w-32 rounded"></div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-4 w-12 rounded"></div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-4 w-48 rounded"></div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-4 w-8 rounded"></div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-4 w-8 rounded"></div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-4 w-12 rounded"></div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      (() => {
                        // Filter for External Video is done by API now
                        const filteredRounds = [...rounds]; // Copy for sorting

                        // Sort by Title (asc) then Try Count (desc)
                        filteredRounds.sort((a, b) => {
                          if (a.title !== b.title) {
                            return a.title.localeCompare(b.title);
                          }
                          return (b.try_count || 1) - (a.try_count || 1);
                        });

                        if (filteredRounds.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-gray-500">
                                {t('dashboard.table.noRounds')}
                              </td>
                            </tr>
                          );
                        }

                        return filteredRounds.map((round, index) => {
                          // Check if this row is part of a group (same title as prev or next)
                          const isSameTitleAsPrev = index > 0 && filteredRounds[index - 1].title === round.title;
                          const isSameTitleAsNext = index < filteredRounds.length - 1 && filteredRounds[index + 1].title === round.title;
                          const isGrouped = isSameTitleAsPrev || isSameTitleAsNext;

                          // Different styling for grouped rows to visually connect them
                          let rowClass = "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors";
                          if (isGrouped) {
                            if (isSameTitleAsNext) rowClass = "border-b-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"; // Lighter separator
                            else rowClass = "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"; // End of group
                          }

                          return (
                            <tr
                              key={round.id}
                              className={`${rowClass}`}
                              onClick={() => router.push(`/${language}/dashboard/register/${round.id}`)}
                            >
                              <td className="py-2 px-4 max-w-xs">
                                {isGrouped && isSameTitleAsPrev ? (
                                  <div className="font-medium truncate opacity-0 select-none" aria-hidden="true">{round.title}</div>
                                ) : (
                                  <div className="font-medium truncate" title={round.title}>{round.title}</div>
                                )}
                              </td>
                              <td className="py-2 px-4 whitespace-nowrap">
                                {(() => {
                                  // Normalize display of debate styles
                                  const style = round.style;
                                  if (!style) return '-';
                                  if (style === 'british_parliamentary' || style === 'BP') return 'BP';
                                  if (style === 'north_american' || style === 'NA') return 'NA';
                                  if (style === 'asian' || style === 'ASIAN') return 'Asian';
                                  if (style === 'bp_opening_half' || style === 'OPENING_HALF_BP_ORDER') return 'BP Half';
                                  if (style === 'wsdc' || style === 'WSDC') return 'WSDC';
                                  if (style === 'hpdu' || style === 'HPDU') return 'HPDU';
                                  return style;
                                })()}
                              </td>
                              <td className="py-2 px-4 max-w-xs truncate" title={round.motion}>
                                {round.motion}
                              </td>
                              <td className="py-2 px-4">
                                <div className="flex items-center">
                                  {(() => {
                                    const progress = jobProgress.get(round.id);
                                    const hasError = progress ? (
                                      (progress.step_1b !== 'not_in_queue' && progress.step_1a !== 'done') ||
                                      (progress.step_1c !== 'not_in_queue' && progress.step_1b !== 'done') ||
                                      (progress.step_1d !== 'not_in_queue' && progress.step_1c !== 'done')
                                    ) : false;
                                    const step1Status =
                                      (progress?.step_1b === 'done' &&
                                        progress?.step_1c === 'done' &&
                                        progress?.step_1d === 'done') ||
                                      progress?.step_1b === 'processing' ||
                                      progress?.step_1c === 'processing' ||
                                      progress?.step_1d === 'processing'
                                        ? 'done'
                                        : 'not_done';
                                    return (
                                      <>
                                        <Step1ProgressCircle
                                          step1a={progress?.step_1a || 'not_in_queue'}
                                          step1b={progress?.step_1b || 'not_in_queue'}
                                          step1c={progress?.step_1c || 'not_in_queue'}
                                          step1d={progress?.step_1d || 'not_in_queue'}
                                        />
                                        <div
                                          className={`w-3 h-1 ${
                                            hasError ? 'bg-red-500' : step1Status === 'done' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'
                                          }`}
                                        />
                                        {[2, 3, 4].map((stepNum, idx) => {
                                          const status =
                                            stepNum === 2
                                              ? progress?.step_2 || 'not_in_queue'
                                              : stepNum === 3
                                                ? progress?.step_3 || 'not_in_queue'
                                                : progress?.step_4 || 'not_in_queue';
                                          return (
                                            <div key={stepNum} className="flex items-center">
                                              {idx > 0 && (
                                                <div
                                                  className={`w-3 h-1 ${
                                                    status === 'done'
                                                      ? 'bg-green-500'
                                                      : 'bg-gray-300 dark:bg-gray-700'
                                                  }`}
                                                />
                                              )}
                                              <div
                                                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                                  status === 'done'
                                                    ? 'bg-green-500'
                                                    : status === 'processing'
                                                      ? 'bg-blue-500'
                                                      : status === 'in_queue'
                                                        ? 'bg-purple-500'
                                                        : 'bg-gray-300 dark:bg-gray-700'
                                                }`}
                                                title={`Step ${stepNum}: ${status}`}
                                              >
                                                {status === 'done' ? '✓' : stepNum}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pagination && pagination.total > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4 gap-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span> results
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 mr-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Go to page:</span>
                    <input
                      type="number"
                      min={1}
                      max={pagination.totalPages}
                      defaultValue={pagination.page}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt((e.target as HTMLInputElement).value);
                          if (!isNaN(val)) {
                            pagination.goToPage(val);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          pagination.goToPage(val);
                        }
                      }}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => pagination.goToPage(pagination.page - 1)}
                      disabled={pagination.page === 1 || loading}
                      className="flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </button>
                    {[...Array(pagination.totalPages)].map((_, i) => {
                      const p = i + 1;
                      // Show strictly 1, last, and current +/- 1
                      if (
                        p === 1 ||
                        p === pagination.totalPages ||
                        (p >= pagination.page - 1 && p <= pagination.page + 1)
                      ) {
                        return (
                          <button
                            key={p}
                            onClick={() => pagination.goToPage(p)}
                            disabled={loading}
                            className={`px-3 py-1 text-sm font-medium rounded-md ${pagination.page === p
                              ? 'bg-indigo-600 text-white border border-indigo-600'
                              : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                              }`}
                          >
                            {p}
                          </button>
                        );
                      } else if (
                        (p === pagination.page - 2 && p > 1) ||
                        (p === pagination.page + 2 && p < pagination.totalPages)
                      ) {
                        return <span key={p} className="px-1 text-gray-400">...</span>
                      }
                      return null;
                    })}
                    <button
                      onClick={() => pagination.goToPage(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages || loading}
                      className="flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}