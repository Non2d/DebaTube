"use client";

import { useRounds } from '../../dashboard/hooks/useRoundsSummary';
import { useTranslation } from '../../../../context/LanguageContext';
import { useRouter } from 'next/navigation';

interface RecordListProps {
    onSelectRound: (roundName: string, tryCount: number) => void;
}

export default function RecordList({ onSelectRound }: RecordListProps) {
    const { rounds, loading, error } = useRounds();
    const { t, language } = useTranslation();

    // Only count record-type rounds (exclude external_video etc.)
    const recordRounds = rounds.filter(r => r.type === 'record');
    const totalRounds = new Set(recordRounds.map(r => r.title)).size;
    const totalPois = recordRounds.reduce((sum, round) => sum + round.poi_count, 0);
    const totalRebuttals = recordRounds.reduce((sum, round) => sum + round.rebuttal_count, 0);
    const totalArgumentUnits = recordRounds.reduce((sum, round) => sum + round.total_argument_units, 0);

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                {/* 
                <div>
                    <h1 className="text-3xl font-bold mb-2">{t('dashboard.title')}</h1>
                    <p className="text-gray-600 dark:text-gray-300">
                        {t('dashboard.description')}
                    </p>
                </div>
                */}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    <h3 className="text-lg font-semibold mb-4">{t('dashboard.stats.totalPois')}</h3>
                    <div className="text-3xl font-bold text-green-600">
                        {loading ? (
                            <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-9 w-16 rounded"></div>
                        ) : (
                            totalPois
                        )}
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4">{t('dashboard.stats.totalRebuttals')}</h3>
                    <div className="text-3xl font-bold text-purple-600">
                        {loading ? (
                            <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-9 w-16 rounded"></div>
                        ) : (
                            totalRebuttals
                        )}
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4">{t('dashboard.stats.argumentUnits')}</h3>
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
                                    <th className="text-left py-2 px-4 w-[80px]">{t('dashboard.table.headers.style')}</th>
                                    <th className="text-left py-2 px-4">{t('dashboard.table.headers.motion')}</th>
                                    <th className="text-left py-2 px-4 w-[80px]">{t('dashboard.table.headers.pois')}</th>
                                    <th className="text-left py-2 px-4 w-[80px]">{t('dashboard.table.headers.rebuttals')}</th>
                                    <th className="text-left py-2 px-4 w-[100px]">{t('dashboard.table.headers.arguments')}</th>
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
                                        // Filter for Non-External Video (i.e. Records)
                                        const filteredRounds = rounds.filter(round => {
                                            return round.type !== 'external_video';
                                        });

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
                                            // e.g. remove bottom border for all but last in group, add left border indicator
                                            let rowClass = "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700";
                                            if (isGrouped) {
                                                if (isSameTitleAsNext) rowClass = "border-b-0 border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"; // Lighter separator
                                                else rowClass = "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"; // End of group
                                            }

                                            return (
                                                <tr
                                                    key={round.id}
                                                    className={`${rowClass} cursor-pointer`}
                                                    onClick={() => {
                                                        // Pass selection up to parent instead of navigating
                                                        onSelectRound(round.title, round.try_count || 1);
                                                    }}
                                                >
                                                    <td className="py-2 px-4 max-w-xs">
                                                        <div className="flex items-center gap-2">
                                                            {isGrouped && isSameTitleAsPrev ? (
                                                                <div className="font-medium truncate opacity-0 select-none" aria-hidden="true">{round.title}</div>
                                                            ) : (
                                                                <div className="font-medium truncate" title={round.title}>{round.title}</div>
                                                            )}
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 flex-shrink-0">
                                                                v{round.try_count || 1}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-4 whitespace-nowrap">
                                                        {(() => {
                                                            // Normalize display of debate styles
                                                            const style = round.style;
                                                            if (!style) return '-';
                                                            if (style === 'british_parliamentary' || style === 'BP') return 'BP';
                                                            if (style === 'north_american' || style === 'NA') return 'NA';
                                                            if (style === 'asian' || style === 'ASIAN') return 'Asian';
                                                            if (style === 'bp_opening_half' || style === 'OPENING_HALF_BP_ORDER') return 'BP Opening Half';
                                                            return style;
                                                        })()}
                                                    </td>
                                                    <td className="py-2 px-4 max-w-xs truncate" title={round.motion}>
                                                        {round.motion}
                                                    </td>
                                                    <td className="py-2 px-4">{round.poi_count}</td>
                                                    <td className="py-2 px-4">{round.rebuttal_count}</td>
                                                    <td className="py-2 px-4">{round.total_argument_units}</td>
                                                </tr>
                                            );
                                        });
                                    })()
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
