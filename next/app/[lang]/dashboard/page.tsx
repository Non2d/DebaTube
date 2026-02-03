"use client";

import { Plus, ChevronLeft, ChevronRight, Play, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import Header from '../../../components/shared/Header';
import { useRounds } from './hooks/useRoundsSummary';
import { useTranslation } from '../../../context/LanguageContext';
import { type BackgroundStepStatus, formatModelName, getAPIRoot, toInternalModelName } from '../../../components/lib/utils';
import Step1ProgressCircle from './components/Step1ProgressCircle';
import { useStepActions } from '../../../hooks/useStepActions';
import type { ProcessingStepStatus } from '../../../components/shared/ProcessingSteps';
import { TRANSCRIPTION_MODELS } from '../../../constants/models';

export default function VideoDashboard() {
  const { rounds, loading, error, pagination, jobProgress, refetch } = useRounds('external_video');
  const { t, language } = useTranslation();
  const router = useRouter();
  const [processingRounds, setProcessingRounds] = useState<Set<number>>(new Set());
  const [activeSteps, setActiveSteps] = useState<Set<string>>(new Set()); // Track active steps: "roundId-stepNum"
  const { runStep1 } = useStepActions({ roundId: 0, t, is_background: true, showRoundIdInToast: true });

  // LLM Model (初期値関数で localStorage から読み込み)
  const [llmModel, setLlmModel] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('llmModel') || "gemini-2.5-flash (google ai studio)";
    }
    return "gemini-2.5-flash (google ai studio)";
  });

  // Transcription Model (初期値関数で localStorage から読み込み)
  const [transcriptionModel, setTranscriptionModel] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('transcriptionModel') || "groq-whisper-large-v3-turbo";
    }
    return "groq-whisper-large-v3-turbo";
  });

  // Colab URL (初期値関数で localStorage から読み込み)
  const [colabUrl, setColabUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('colabUrl') || "";
    }
    return "";
  });

  // Gemini モデル一覧
  const [geminiModels, setGeminiModels] = useState<string[]>([
    "gemini-2.5-flash (google ai studio)",
    "gemini-3-flash (google ai studio)"
  ]);

  // Settings panel collapsed/expanded
  const [showSettings, setShowSettings] = useState(false);

  // 実行モード選択 ('step1' | 'all')
  const [executeMode, setExecuteMode] = useState<'step1' | 'all'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('dashboardExecuteMode') as 'step1' | 'all') || 'step1';
    }
    return 'step1';
  });

  // Gemini モデル一覧をバックエンドから取得
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch(getAPIRoot() + '/audio2adu/gemini-models');
        if (res.ok) {
          const data = await res.json();
          if (data && data.models) {
            let formattedModels = data.models.map((m: string) => formatModelName(m));
            // 本番環境では Vertex AI モデルを除外
            if (process.env.NODE_ENV === 'production') {
              formattedModels = formattedModels.filter((m: string) => !m.includes('vertex ai'));
            }
            setGeminiModels(formattedModels);
            localStorage.setItem('geminiModels', JSON.stringify(formattedModels));
          }
        }
      } catch (e) {
        console.error("Failed to fetch Gemini models", e);
      }
    };
    fetchModels();
  }, []);

  // localStorage に自動保存
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('llmModel', llmModel);
    }
  }, [llmModel]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('transcriptionModel', transcriptionModel);
    }
  }, [transcriptionModel]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('colabUrl', colabUrl);
    }
  }, [colabUrl]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboardExecuteMode', executeMode);
    }
  }, [executeMode]);

  // Auto-continue: Step 1-A → 1-B, Step 1-B → 1-C, 1-D (Dashboard version)
  const prevJobProgressMapRef = useRef<Map<number, any>>(new Map());
  const allModeRoundsRef = useRef<Set<number>>(new Set()); // Track rounds started in 'all' mode

  useEffect(() => {
    if (jobProgress.size === 0) {
      prevJobProgressMapRef.current = jobProgress;
      return;
    }

    // Check each round for step completion
    jobProgress.forEach(async (curr, roundId) => {
      const prev = prevJobProgressMapRef.current.get(roundId);
      if (!prev) return;

      const round = rounds.find(r => r.id === roundId);
      if (!round) return;

      // Check if Step 1-A just completed
      if (prev.step_1a !== 'done' && curr.step_1a === 'done') {
        // Step 1-A just completed, continue with 1-B via runStep1
        console.log(`[Dashboard] Round ${roundId}: Step 1-A completed, starting 1-B`);
        const dummyStepsStatus: ProcessingStepStatus[] = ['pending', 'pending', 'pending', 'pending'];
        const dummySetStepsStatus = () => { };
        runStep1(
          round,
          dummySetStepsStatus as any,
          dummyStepsStatus,
          async () => {
            await refetch();
          },
          round.video_id ? `https://www.youtube.com/watch?v=${round.video_id}` : undefined
        );
      }

      // Check if Step 1-B just completed
      if (prev.step_1b !== 'done' && curr.step_1b === 'done') {
        // Step 1-B just completed, continue with 1-C and 1-D via runStep1
        console.log(`[Dashboard] Round ${roundId}: Step 1-B completed, starting 1-C and 1-D`);
        const dummyStepsStatus: ProcessingStepStatus[] = ['pending', 'pending', 'pending', 'pending'];
        const dummySetStepsStatus = () => { };
        runStep1(
          round,
          dummySetStepsStatus as any,
          dummyStepsStatus,
          async () => {
            await refetch();
          },
          round.video_id ? `https://www.youtube.com/watch?v=${round.video_id}` : undefined
        );
      }

      // Check if Step 1-D just completed AND this round was started in 'all' mode
      if (prev.step_1d !== 'done' && curr.step_1d === 'done' && allModeRoundsRef.current.has(roundId)) {
        console.log(`[Dashboard] Round ${roundId}: Step 1 fully completed, starting Steps 2-4`);

        // Run Steps 2-4 sequentially
        try {
          // Step 2
          if (curr.step_2 !== 'done') {
            const stepKey = `${roundId}-2`;
            setActiveSteps(prev => new Set(prev).add(stepKey));
            toast.loading(`[${roundId}] Running Step 2...`, { id: `step2-${roundId}` });
            await runStep2(roundId, llmModel);
            toast.success(`[${roundId}] Step 2 Complete`, { id: `step2-${roundId}` });
            await refetch();
            setActiveSteps(prev => {
              const next = new Set(prev);
              next.delete(stepKey);
              return next;
            });
          }

          // Refresh progress
          await refetch();
          const progressAfterStep2 = jobProgress.get(roundId);

          // Step 3
          if (progressAfterStep2?.step_3 !== 'done') {
            const stepKey = `${roundId}-3`;
            setActiveSteps(prev => new Set(prev).add(stepKey));
            toast.loading(`[${roundId}] Running Step 3...`, { id: `step3-${roundId}` });
            await runStep3(roundId, llmModel);
            toast.success(`[${roundId}] Step 3 Complete`, { id: `step3-${roundId}` });
            await refetch();
            setActiveSteps(prev => {
              const next = new Set(prev);
              next.delete(stepKey);
              return next;
            });
          }

          // Refresh progress
          await refetch();
          const progressAfterStep3 = jobProgress.get(roundId);

          // Step 4
          if (progressAfterStep3?.step_4 !== 'done') {
            const stepKey = `${roundId}-4`;
            setActiveSteps(prev => new Set(prev).add(stepKey));
            toast.loading(`[${roundId}] Running Step 4...`, { id: `step4-${roundId}` });
            await runStep4(roundId, llmModel);
            toast.success(`[${roundId}] Step 4 Complete`, { id: `step4-${roundId}` });
            await refetch();
            setActiveSteps(prev => {
              const next = new Set(prev);
              next.delete(stepKey);
              return next;
            });
          }

          toast.success(`[${roundId}] All Steps Completed!`);
          // Remove from allModeRounds tracking
          allModeRoundsRef.current.delete(roundId);
        } catch (e: any) {
          console.error(`[Dashboard] Round ${roundId}: Error in Steps 2-4:`, e);
          toast.error(`[${roundId}] Error: ${e.message}`);
          allModeRoundsRef.current.delete(roundId);
        }
      }
    });

    prevJobProgressMapRef.current = jobProgress;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobProgress, rounds, refetch]);

  const runStep2 = async (roundId: number, llmModel: string) => {
    const res = await fetch(getAPIRoot() + `/auto/diarization/${roundId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: toInternalModelName(llmModel) })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Step 2 failed");
    }
  };

  const runStep3 = async (roundId: number, llmModel: string) => {
    const res = await fetch(getAPIRoot() + `/auto/adus/${roundId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: toInternalModelName(llmModel) })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Step 3 failed");
    }
  };

  const runStep4 = async (roundId: number, llmModel: string) => {
    const res = await fetch(getAPIRoot() + `/auto/rebuttals/${roundId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: toInternalModelName(llmModel) })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Step 4 failed");
    }
  };

  const executeStep = async (round: any, mode: 'step1' | 'all') => {
    setProcessingRounds(prev => new Set(prev).add(round.id));

    try {
      const progress = jobProgress.get(round.id);

      if (mode === 'step1') {
        // Step 1 Only
        if (progress?.step_1 !== 'done') {
          toast.loading(`[${round.id}] Running Step 1...`, { id: `step1-${round.id}` });
          const dummyStepsStatus: ProcessingStepStatus[] = ['pending', 'pending', 'pending', 'pending'];
          const dummySetStepsStatus = () => { };
          await runStep1(
            round,
            dummySetStepsStatus as any,
            dummyStepsStatus,
            async () => {
              await refetch();
            },
            round.video_id ? `https://www.youtube.com/watch?v=${round.video_id}` : undefined
          );
          toast.success(`[${round.id}] Step 1 Complete`, { id: `step1-${round.id}` });
        }
      } else if (mode === 'all') {
        // Steps 1-4
        // Check if Step 1 is already fully complete
        const step1Complete = progress?.step_1a === 'done' &&
          progress?.step_1b === 'done' &&
          progress?.step_1c === 'done' &&
          progress?.step_1d === 'done';

        if (!step1Complete) {
          // Step 1 not complete - start it and let auto-transition handle the rest
          // Mark this round as 'all' mode so Step 2-4 will run after Step 1 completes
          allModeRoundsRef.current.add(round.id);

          toast.loading(`[${round.id}] Running Step 1...`, { id: `step1-${round.id}` });
          const dummyStepsStatus: ProcessingStepStatus[] = ['pending', 'pending', 'pending', 'pending'];
          const dummySetStepsStatus = () => { };
          await runStep1(
            round,
            dummySetStepsStatus as any,
            dummyStepsStatus,
            async () => {
              await refetch();
            },
            round.video_id ? `https://www.youtube.com/watch?v=${round.video_id}` : undefined
          );

          // Always return after starting Step 1 in 'all' mode
          // Auto-transition will handle Steps 2-4 after Step 1 completes
          toast.success(`[${round.id}] Step 1 processing started. Steps 2-4 will run automatically after completion.`, { id: `step1-${round.id}`, duration: 5000 });
          return;
        } else {
          // Step 1 already complete - mark for tracking and let auto-transition handle Steps 2-4
          allModeRoundsRef.current.add(round.id);
          toast.success(`[${round.id}] Step 1 already complete. Starting Steps 2-4...`, { duration: 3000 });
          // Trigger auto-transition by simulating Step 1-D completion
          // The useEffect will detect this and run Steps 2-4
          return;
        }
      }

    } catch (e: any) {
      console.error("Workflow Stopped:", e);
      toast.error(`[${round.id}] Error: ${e.message}`);
    } finally {
      setProcessingRounds(prev => {
        const next = new Set(prev);
        next.delete(round.id);
        return next;
      });
      // Clear all active steps for this round
      setActiveSteps(prev => {
        const next = new Set(prev);
        [2, 3, 4].forEach(stepNum => {
          next.delete(`${round.id}-${stepNum}`);
        });
        return next;
      });
    }
  };

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
            {/* Advanced Settings Panel - Top of card */}
            <div className="pb-4 mb-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600"
              >
                <span className={`transition-transform ${showSettings ? 'rotate-90' : ''}`}>▸</span>
                <span>Advanced Settings</span>
              </button>

              {showSettings && (
                <div className="mt-4 space-y-4">
                  {/* Execute Mode Selection */}
                  <div className="flex gap-4 p-3 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="step1"
                        checked={executeMode === 'step1'}
                        onChange={(e) => setExecuteMode(e.target.value as 'step1' | 'all')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Step 1 Only</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="all"
                        checked={executeMode === 'all'}
                        onChange={(e) => setExecuteMode(e.target.value as 'step1' | 'all')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">All Steps</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Transcription Model */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                        Audio Model
                      </label>
                      <select
                        value={transcriptionModel}
                        onChange={(e) => setTranscriptionModel(e.target.value)}
                        className="h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {TRANSCRIPTION_MODELS.map((model) => (
                          <option
                            key={model.value}
                            value={model.value}
                            disabled={!model.enabled}
                          >
                            {model.label}
                            {!model.enabled && ' (Coming Soon)'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* LLM Model */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                        LLM Model (Gemini)
                      </label>
                      <select
                        value={llmModel}
                        onChange={(e) => setLlmModel(e.target.value)}
                        className="h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {geminiModels.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Colab URL (条件付き表示) */}
                    {transcriptionModel === 'colab-faster-whisper-large-v2' && (
                      <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                          Cloudflare Tunnel URL
                        </label>
                        <input
                          type="text"
                          value={colabUrl}
                          onChange={(e) => setColabUrl(e.target.value)}
                          placeholder="https://xxxx.trycloudflare.com"
                          className="h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                      <th className="text-left py-2 px-4 w-[60px]">ID</th>
                      <th className="text-left py-2 px-4 w-[280px]">{t('dashboard.table.headers.title')}</th>
                      <th className="text-left py-2 px-4 w-[60px]">{t('dashboard.table.headers.style')}</th>
                      <th className="text-left py-2 px-4">{t('dashboard.table.headers.motion')}</th>
                      <th className="text-left py-2 px-4 w-[120px]">Progress</th>
                      <th className="text-left py-2 px-4 w-[100px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                          <td className="py-2 px-4">
                            <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-4 w-12 rounded"></div>
                          </td>
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
                            <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-4 w-24 rounded"></div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-4 w-16 rounded"></div>
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
                              <td className="py-2 px-4">
                                <div className="font-medium">{round.id}</div>
                              </td>
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

                                    // 1-B以降の依存関係エラー（1-Aを無視）
                                    const laterStepsError = progress ? (
                                      (progress.step_1c !== 'not_in_queue' && progress.step_1b !== 'done') ||
                                      (progress.step_1d !== 'not_in_queue' && progress.step_1c !== 'done')
                                    ) : false;

                                    // 警告チェック：1-A だけが not_in_queue で、1-B 以降が進んでいて、1-B以降の依存関係は正しい（キャッシュ削除）
                                    const hasWarning = progress ? (
                                      progress.step_1a === 'not_in_queue' &&
                                      (progress.step_1b !== 'not_in_queue' || progress.step_1c !== 'not_in_queue' || progress.step_1d !== 'not_in_queue') &&
                                      !laterStepsError
                                    ) : false;

                                    // エラーチェック：1-B以降の依存エラー、または1-Aの依存エラー（警告でない場合）
                                    const hasError = progress ? (
                                      laterStepsError ||
                                      (progress.step_1b !== 'not_in_queue' && progress.step_1a !== 'done' && !hasWarning)
                                    ) : false;

                                    const step1Status =
                                      (progress?.step_1a === 'done' &&
                                        progress?.step_1b === 'done' &&
                                        progress?.step_1c === 'done' &&
                                        progress?.step_1d === 'done')
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
                                          className={`w-3 h-1 ${hasError ? 'bg-red-500' : (progress?.step_1b === 'done' && progress?.step_1c === 'done' && progress?.step_1d === 'done') ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'
                                            }`}
                                        />
                                        {[2, 3, 4].map((stepNum, idx) => {
                                          const stepKey = `${round.id}-${stepNum}`;
                                          const isActiveInFrontend = activeSteps.has(stepKey);
                                          const status =
                                            stepNum === 2
                                              ? progress?.step_2 || 'not_in_queue'
                                              : stepNum === 3
                                                ? progress?.step_3 || 'not_in_queue'
                                                : progress?.step_4 || 'not_in_queue';
                                          // Override status if frontend knows it's processing
                                          const displayStatus = isActiveInFrontend ? 'processing' : status;
                                          return (
                                            <div key={stepNum} className="flex items-center">
                                              {idx > 0 && (
                                                <div
                                                  className={`w-3 h-1 ${displayStatus === 'done'
                                                    ? 'bg-green-500'
                                                    : 'bg-gray-300 dark:bg-gray-700'
                                                    }`}
                                                />
                                              )}
                                              <div className="relative w-5 h-5">
                                                <div
                                                  className={`absolute inset-0 rounded-full flex items-center justify-center text-xs font-bold text-white ${displayStatus === 'done'
                                                    ? 'bg-green-500'
                                                    : displayStatus === 'processing'
                                                      ? 'bg-blue-500'
                                                      : displayStatus === 'in_queue'
                                                        ? 'bg-purple-500'
                                                        : 'bg-gray-300 dark:bg-gray-700'
                                                    }`}
                                                  title={`Step ${stepNum}: ${displayStatus}`}
                                                >
                                                  {displayStatus === 'done' ? '✓' : stepNum}
                                                </div>
                                                {(displayStatus === 'processing' || displayStatus === 'in_queue') && (
                                                  <div
                                                    className="absolute inset-0 rounded-full border-[3px] border-transparent animate-spin pointer-events-none"
                                                    style={{
                                                      borderTopColor: displayStatus === 'processing' ? '#60a5fa' : '#c084fc',
                                                      borderRightColor: displayStatus === 'processing' ? 'rgba(96, 165, 250, 0.3)' : 'rgba(192, 132, 252, 0.3)',
                                                    }}
                                                  />
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="py-2 px-4">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    executeStep(round, executeMode);
                                  }}
                                  disabled={processingRounds.has(round.id)}
                                  className={`flex items-center gap-1 px-3 py-1 text-xs font-medium text-white rounded transition-colors ${executeMode === 'step1'
                                    ? 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500'
                                    } disabled:cursor-not-allowed`}
                                  title={executeMode === 'step1' ? 'Run Step 1 Only' : 'Run All Steps'}
                                >
                                  <Play className="w-3 h-3" />
                                  {executeMode === 'step1' ? '1' : 'All'}
                                </button>
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