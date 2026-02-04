"use client";

import { Plus, ChevronLeft, ChevronRight, Play, ChevronDown, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useTheme } from 'next-themes';
import toast from 'react-hot-toast';
import Header from '../../../components/shared/Header';
import { useRounds } from './hooks/useRoundsSummary';
import { useTranslation } from '../../../context/LanguageContext';
import { type BackgroundStepStatus, getAPIRoot, toInternalModelName } from '../../../components/lib/utils';
import Step1ProgressCircle from './components/Step1ProgressCircle';
import type { ProcessingStepStatus } from '../../../components/shared/ProcessingSteps';
import { TRANSCRIPTION_MODELS, NLP_LLMS, NLPLLMValue } from '../../../constants/models';
import { useCancelTranscription } from './hooks/useCancelTranscription';

export default function VideoDashboard() {
  const { rounds, loading, error, pagination, jobProgress, refetch } = useRounds('external_video');
  const { t, language } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const [processingRounds, setProcessingRounds] = useState<Set<number>>(new Set());
  const [activeSteps, setActiveSteps] = useState<Set<string>>(new Set()); // Track active steps: "roundId-stepNum"
  const cancellationTargetsRef = useRef<Map<number, 'external-bg-task' | 'sync-task' | null>>(new Map());
  const [cancellationTargetsTrigger, setCancellationTargetsTrigger] = useState(0); // Trigger for re-renders
  const [threadStatus, setThreadStatus] = useState<{ active_tasks: string[]; zombie_tasks: string[] } | null>(null);
  const { cancelTranscription } = useCancelTranscription();

  // LLM Model (初期値関数で localStorage から読み込み)
  const [llmModel, setLlmModel] = useState<NLPLLMValue>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('llmModel');
      if (stored) {
        // 表示形式の場合は内部形式に変換
        const converted = toInternalModelName(stored);
        // 現在の環境で有効か確認
        const isValid = NLP_LLMS.available().some(m => m.value === converted);
        return isValid ? (converted as NLPLLMValue) : NLP_LLMS.default();
      }
    }
    return NLP_LLMS.default();
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


  // Settings panel collapsed/expanded
  const [showSettings, setShowSettings] = useState(false);

  // 実行モード選択 ('step1' | 'all')
  const [executeMode, setExecuteMode] = useState<'step1' | 'all'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('dashboardExecuteMode') as 'step1' | 'all') || 'step1';
    }
    return 'step1';
  });


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

  // Fetch thread status on mount
  useEffect(() => {
    const fetchThreadStatus = async () => {
      try {
        const res = await fetch(getAPIRoot() + '/thread/status');
        if (res.ok) {
          const data = await res.json();
          setThreadStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch thread status:', error);
      }
    };

    fetchThreadStatus();
  }, []);

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
        // Step 1-A just completed, continue with 1-B via runStep1Dashboard
        console.log(`[Dashboard] Round ${roundId}: Step 1-A completed, starting 1-B`);
        // Auto-continue must preserve cancellation target
        await runStep1Dashboard(
          round,
          round.video_id ? `https://www.youtube.com/watch?v=${round.video_id}` : undefined,
          true // keepCancellationTarget = true
        );
      }

      // Check if Step 1-B just completed
      if (prev.step_1b !== 'done' && curr.step_1b === 'done') {
        // Step 1-B just completed, continue with 1-C and 1-D via runStep1Dashboard
        console.log(`[Dashboard] Round ${roundId}: Step 1-B completed, starting 1-C and 1-D`);
        // Auto-continue must preserve cancellation target
        await runStep1Dashboard(
          round,
          round.video_id ? `https://www.youtube.com/watch?v=${round.video_id}` : undefined,
          true // keepCancellationTarget = true
        );
      }

      // Check if Step 1-D just completed AND this round was started in 'all' mode
      if (prev.step_1d !== 'done' && curr.step_1d === 'done' && allModeRoundsRef.current.has(roundId)) {
        console.log(`[Dashboard] Round ${roundId}: Step 1 fully completed, starting Steps 2-4`);

        // CRITICAL: Ensure cancellation target is set to sync-task immediately after Step 1-D completion
        cancellationTargetsRef.current.set(roundId, 'sync-task');
        setCancellationTargetsTrigger(t => t + 1);

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
            cancellationTargetsRef.current.set(roundId, 'sync-task');
            setCancellationTargetsTrigger(t => t + 1);
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
            cancellationTargetsRef.current.set(roundId, 'sync-task');
            setCancellationTargetsTrigger(t => t + 1);
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
          // Clear cancellation target
          cancellationTargetsRef.current.delete(roundId);
          setCancellationTargetsTrigger(t => t + 1);
          // Remove from allModeRounds tracking
          allModeRoundsRef.current.delete(roundId);
        } catch (e: any) {
          console.error(`[Dashboard] Round ${roundId}: Error in Steps 2-4:`, e);
          toast.error(`[${roundId}] Error: ${e.message}`);
          // Clear cancellation target on error
          cancellationTargetsRef.current.delete(roundId);
          setCancellationTargetsTrigger(t => t + 1);
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

  // Dashboard-specific runStep1 with proper cancellation target handling for auto-continue
  const runStep1Dashboard = async (
    roundData: any,
    videoUrl: string | undefined,
    keepCancellationTarget: boolean = false
  ) => {
    const toastPrefix = `[Round ${roundData.id}] `;

    if (!roundData?.video_id && !videoUrl) {
      toast.error(toastPrefix + "Error: No video_id found");
      return;
    }

    const effectiveVideoId = roundData?.video_id || (videoUrl ? (videoUrl.match(/(?:v=|youtu\.be\/)([^&]+)/)?.[1] || null) : null);
    const targetUrl = videoUrl || `https://www.youtube.com/watch?v=${effectiveVideoId}`;

    try {
      let progress = await fetch(getAPIRoot() + `/job-progress-background/${roundData.id}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);

      const audioDone = progress?.step_1a === 'DONE';
      const transDone = progress?.step_1b === 'DONE';

      // Step 1-A: Download Audio
      if (!audioDone && !transDone) {
        cancellationTargetsRef.current.set(roundData.id, 'external-bg-task');
        setCancellationTargetsTrigger(t => t + 1);

        const res = await fetch(getAPIRoot() + `/download-audio/${roundData.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Audio download failed');
        }

        toast.success(toastPrefix + 'Step 1-A: Background audio download registered', { id: `step1a-${roundData.id}` });
        await refetch();
        return;
      }

      // Step 1-B: Transcription
      const needsResultRetrieval = transDone && progress?.step_1c !== 'DONE';

      if (needsResultRetrieval) {
        toast.loading(toastPrefix + 'Step 1-B: Retrieving result...', { id: `step1b-result-${roundData.id}` });

        const resultRes = await fetch(getAPIRoot() + `/transcription-result?round_id=${roundData.id}`);
        if (!resultRes.ok) {
          const err = await resultRes.json();
          throw new Error(err.detail || 'Failed to get transcription result');
        }

        toast.success(toastPrefix + 'Step 1-B: Result saved to DB', { id: `step1b-result-${roundData.id}` });
        cancellationTargetsRef.current.set(roundData.id, 'sync-task');
        setCancellationTargetsTrigger(t => t + 1);
        await refetch();
        progress = await fetch(getAPIRoot() + `/job-progress-background/${roundData.id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null);
      } else if (!transDone) {
        // Set cancellation target for 1-B operations
        cancellationTargetsRef.current.set(roundData.id, 'external-bg-task');
        setCancellationTargetsTrigger(t => t + 1);

        toast.loading(toastPrefix + 'Step 1-B: Checking transcription status...', { id: `step1b-${roundData.id}` });

        const statusRes = await fetch(getAPIRoot() + `/transcription-status?round_id=${roundData.id}`);
        let status = 'NOT_IN_QUEUE';

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          status = statusData.status;
        }

        if (status !== 'DONE' && status !== 'COMPLETED') {
          const startRes = await fetch(getAPIRoot() + `/start-background-transcription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              round_id: roundData.id,
              url: targetUrl,
              num_chunks: 4,
              max_workers: 2,
              is_forced: true
            }),
          });

          if (!startRes.ok) {
            const err = await startRes.json();
            if (startRes.status !== 409) {
              throw new Error(err.detail || 'Background transcription start failed');
            }
          }

          toast.success(toastPrefix + 'Step 1-B: Background transcription in progress', { id: `step1b-${roundData.id}`, duration: 3000 });
          await refetch();
          return;
        }
      }

      // Step 1-C: Words
      if (progress?.step_1c !== 'DONE') {
        cancellationTargetsRef.current.set(roundData.id, 'sync-task');
        setCancellationTargetsTrigger(t => t + 1);

        toast.loading(toastPrefix + 'Step 1-C: Extracting words...', { id: `step1c-${roundData.id}` });

        const res = await fetch(getAPIRoot() + `/extract-words-from-transcript/${roundData.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Word extraction failed');
        }

        toast.success(toastPrefix + 'Step 1-C: Completed', { id: `step1c-${roundData.id}` });
        await refetch();
        progress = await fetch(getAPIRoot() + `/job-progress-background/${roundData.id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null);

        // Step 1-D: Group Sentences
        if (progress?.step_1d !== 'DONE') {
          toast.loading(toastPrefix + 'Step 1-D: Grouping sentences...', { id: `step1d-${roundData.id}` });

          const res1d = await fetch(getAPIRoot() + `/group-sentences-from-words/${roundData.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!res1d.ok) {
            const err = await res1d.json();
            throw new Error(err.detail || 'Sentence grouping failed');
          }

          const data = await res1d.json();
          toast.success(toastPrefix + `Step 1-D: ${data.total_sentences} sentences`, { id: `step1d-${roundData.id}` });

          await refetch();
        }
      }
    } catch (error: any) {
      console.error(`[Dashboard] runStep1Dashboard error:`, error);
      toast.dismiss(`step1a-${roundData.id}`);
      toast.dismiss(`step1b-${roundData.id}`);
      toast.dismiss(`step1c-${roundData.id}`);
      toast.dismiss(`step1d-${roundData.id}`);

      cancellationTargetsRef.current.delete(roundData.id);
      setCancellationTargetsTrigger(t => t + 1);

      toast.error(toastPrefix + error.message);
    }
  };

  const handleCancelRound = async (roundId: number, cancellationTarget?: 'external-bg-task' | 'sync-task' | null) => {
    const round = rounds.find(r => r.id === roundId);
    if (!round?.video_id) {
      toast.error(`[${roundId}] Video ID not available`);
      return;
    }

    // Use passed cancellationTarget if available, otherwise get from ref
    const target = cancellationTarget ?? cancellationTargetsRef.current.get(roundId);
    if (!target) {
      toast.error(`[${roundId}] No process running to cancel`);
      return;
    }

    const toastId = toast.loading(`[${roundId}] Cancelling process...`);

    try {
      if (target === 'external-bg-task') {
        // Cancel backend operations (Step 1-A/1-B)
        const result = await cancelTranscription(round.video_id);
        toast.dismiss(toastId);

        if (result.success) {
          toast.success(`[${roundId}] ${result.message}`);
          cancellationTargetsRef.current.delete(roundId);
          setCancellationTargetsTrigger(t => t + 1);
          allModeRoundsRef.current.delete(roundId);
          setActiveSteps(prev => {
            const next = new Set(prev);
            [2, 3, 4].forEach(stepNum => next.delete(`${roundId}-${stepNum}`));
            return next;
          });
          await refetch();
        } else {
          toast.error(`[${roundId}] ${result.message}`);
        }
      } else if (target === 'sync-task') {
        // For frontend-only operations (Steps 2-4)
        toast.dismiss(toastId);
        toast.success(`[${roundId}] Process cancelled - reloading page...`);
        cancellationTargetsRef.current.delete(roundId);
        setCancellationTargetsTrigger(t => t + 1);
        allModeRoundsRef.current.delete(roundId);
        window.location.reload(); // Force stop frontend processing
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(`[${roundId}] ${error.message || 'Failed to cancel process'}`);
      cancellationTargetsRef.current.delete(roundId);
      setCancellationTargetsTrigger(t => t + 1);
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
          await runStep1Dashboard(
            round,
            round.video_id ? `https://www.youtube.com/watch?v=${round.video_id}` : undefined,
            false // keepCancellationTarget = false (no auto-continue to Step 2-4)
          );
          toast.success(`[${round.id}] Step 1 Complete`, { id: `step1-${round.id}` });
          // Clear cancellation target for step1-only mode
          cancellationTargetsRef.current.delete(round.id);
          setCancellationTargetsTrigger(t => t + 1);
        }
      } else if (mode === 'all') {
        // Steps 1-4: Start from the first incomplete step
        const step1Complete = progress?.step_1a === 'done' &&
          progress?.step_1b === 'done' &&
          progress?.step_1c === 'done' &&
          progress?.step_1d === 'done';

        if (!step1Complete) {
          // Step 1 not complete - start it and let auto-transition handle the rest
          allModeRoundsRef.current.add(round.id);
          toast.loading(`[${round.id}] Running Step 1...`, { id: `step1-${round.id}` });
          await runStep1Dashboard(
            round,
            round.video_id ? `https://www.youtube.com/watch?v=${round.video_id}` : undefined,
            true // keepCancellationTarget = true (for auto-continue to Step 2-4)
          );
          toast.success(`[${round.id}] Step 1 processing started. Steps 2-4 will run automatically after completion.`, { id: `step1-${round.id}`, duration: 5000 });
          return;
        }

        // Step 1 is complete - run remaining steps
        toast.success(`[${round.id}] Starting remaining steps...`, { duration: 3000 });

        // Step 2
        if (progress?.step_2 !== 'done') {
          cancellationTargetsRef.current.set(round.id, 'sync-task');
          setCancellationTargetsTrigger(t => t + 1);
          const stepKey = `${round.id}-2`;
          setActiveSteps(prev => new Set(prev).add(stepKey));
          toast.loading(`[${round.id}] Running Step 2...`, { id: `step2-${round.id}` });
          await runStep2(round.id, llmModel);
          toast.success(`[${round.id}] Step 2 Complete`, { id: `step2-${round.id}` });
          await refetch();
          setActiveSteps(prev => {
            const next = new Set(prev);
            next.delete(stepKey);
            return next;
          });
        }

        // Step 3
        const refreshedProgress2 = jobProgress.get(round.id);
        if (refreshedProgress2?.step_3 !== 'done') {
          cancellationTargetsRef.current.set(round.id, 'sync-task');
          setCancellationTargetsTrigger(t => t + 1);
          const stepKey = `${round.id}-3`;
          setActiveSteps(prev => new Set(prev).add(stepKey));
          toast.loading(`[${round.id}] Running Step 3...`, { id: `step3-${round.id}` });
          await runStep3(round.id, llmModel);
          toast.success(`[${round.id}] Step 3 Complete`, { id: `step3-${round.id}` });
          await refetch();
          setActiveSteps(prev => {
            const next = new Set(prev);
            next.delete(stepKey);
            return next;
          });
        }

        // Step 4
        const refreshedProgress3 = jobProgress.get(round.id);
        if (refreshedProgress3?.step_4 !== 'done') {
          cancellationTargetsRef.current.set(round.id, 'sync-task');
          setCancellationTargetsTrigger(t => t + 1);
          const stepKey = `${round.id}-4`;
          setActiveSteps(prev => new Set(prev).add(stepKey));
          toast.loading(`[${round.id}] Running Step 4...`, { id: `step4-${round.id}` });
          await runStep4(round.id, llmModel);
          toast.success(`[${round.id}] Step 4 Complete`, { id: `step4-${round.id}` });
          await refetch();
          setActiveSteps(prev => {
            const next = new Set(prev);
            next.delete(stepKey);
            return next;
          });
        }

        toast.success(`[${round.id}] All Steps Completed!`);
        // Clear cancellation target
        cancellationTargetsRef.current.delete(round.id);
        setCancellationTargetsTrigger(t => t + 1);
      }

    } catch (e: any) {
      console.error("Workflow Stopped:", e);
      toast.error(`[${round.id}] Error: ${e.message}`);
      // Clear cancellation target on error
      cancellationTargetsRef.current.delete(round.id);
      setCancellationTargetsTrigger(t => t + 1);
      allModeRoundsRef.current.delete(round.id);
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
            {/* Advanced Settings Panel - Top of card */}
            <div className="pb-4 mb-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600"
              >
                <span className={`transition-transform ${showSettings ? 'rotate-90' : ''}`}>▸</span>
                <span>{t('dashboard.settings.advancedSettings')}</span>
              </button>

              {showSettings && (
                <div className="mt-4 space-y-4">
                  {/* Execute Mode Selection */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                      {t('dashboard.settings.executionStepLabel')}
                    </label>
                    <div className="flex gap-4 p-3 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="step1"
                        checked={executeMode === 'step1'}
                        onChange={(e) => setExecuteMode(e.target.value as 'step1' | 'all')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">{t('dashboard.settings.step1Only')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="all"
                        checked={executeMode === 'all'}
                        onChange={(e) => setExecuteMode(e.target.value as 'step1' | 'all')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">{t('dashboard.settings.allSteps')}</span>
                    </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Transcription Model */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                        {t('dashboard.settings.audioModel')}
                      </label>
                      <select
                        value={transcriptionModel}
                        onChange={(e) => setTranscriptionModel(e.target.value)}
                        className="h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {TRANSCRIPTION_MODELS.list.map((model) => (
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
                        {t('dashboard.settings.llmModel')}
                      </label>
                      <select
                        value={llmModel}
                        onChange={(e) => setLlmModel(e.target.value as NLPLLMValue)}
                        className="h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {NLP_LLMS.available().map((model) => (
                          <option key={model.value} value={model.value}>
                            {model.label}
                          </option>
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
              <div>
                {/* Thread Status Info */}
                {threadStatus && (
                  <div className="mb-4">
                    <div className="text-sm mb-2 text-right">
                      <div className={`${threadStatus.zombie_tasks.length > 6 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"}`}>
                        {t('dashboard.thread.activeProcesses')}: <span className="font-semibold">{threadStatus.active_tasks.length}</span> / {t('dashboard.thread.zombieTasks')}: <span className="font-semibold">{threadStatus.zombie_tasks.length}</span>
                      </div>
                    </div>
                    {threadStatus.zombie_tasks.length > 6 && (
                      <div className="text-red-600 dark:text-red-400 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                        キャンセルが完了していないプロセスが多く，文字起こしのパフォーマンスが低下しています．STEP1-Aおよび1-Bの実行はしばらく控えることを推奨します．
                      </div>
                    )}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-4 w-[60px]">ID</th>
                        <th className="text-left py-2 px-4 w-[280px]">{t('dashboard.table.headers.title')}</th>
                        <th className="text-left py-2 px-4 w-[60px]">{t('dashboard.table.headers.style')}</th>
                        <th className="text-left py-2 px-4">{t('dashboard.table.headers.motion')}</th>
                        <th className="text-left py-2 px-4 w-[120px]">{t('dashboard.table.headers.progress')}</th>
                        <th className="text-left py-2 px-4 w-[100px]">{t('dashboard.table.headers.actions')}</th>
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
                                                  {/* Base circle */}
                                                  <div className={`absolute inset-0 rounded-full ${displayStatus === 'done' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`} />

                                                  {/* Text/Status */}
                                                  <div
                                                    className={`absolute inset-0 rounded-full flex items-center justify-center text-xs font-bold text-white ${displayStatus === 'done'
                                                      ? 'bg-green-500'
                                                      : 'bg-gray-300 dark:bg-gray-700'
                                                      }`}
                                                    title={`Step ${stepNum}: ${displayStatus}`}
                                                  >
                                                    {displayStatus === 'done' ? '✓' : stepNum}
                                                  </div>

                                                  {/* Spinning border - green when processing */}
                                                  {(displayStatus === 'processing' || displayStatus === 'in_queue') && (
                                                    <div
                                                      className="absolute inset-0 rounded-full border-2 border-transparent animate-spin z-10"
                                                      style={{
                                                        borderTopColor: '#16a34a',
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
                                  {(() => {
                                    // Trigger re-renders when cancellationTargetsTrigger changes
                                    void cancellationTargetsTrigger;
                                    const cancellationTarget = cancellationTargetsRef.current.get(round.id);
                                    const hasActiveJob = cancellationTarget !== null && cancellationTarget !== undefined;
                                    const progress = jobProgress.get(round.id);
                                    const isAllStepsCompleted = progress?.step_4 === 'done';

                                    // Show stop button if has active cancellation target
                                    if (hasActiveJob) {
                                      return (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCancelRound(round.id, cancellationTarget);
                                          }}
                                          className="flex items-center justify-center gap-1 w-16 px-3 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                                          title="Stop Process"
                                        >
                                          <X className="w-3 h-3" />
                                          Stop
                                        </button>
                                      );
                                    }

                                    // Show done button if all steps completed
                                    if (isAllStepsCompleted) {
                                      return (
                                        <button
                                          disabled
                                          className="flex items-center justify-center gap-1 w-16 px-3 py-1 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-300 dark:bg-gray-700 rounded transition-colors cursor-not-allowed opacity-60"
                                          title="All Steps Completed"
                                        >
                                          Done
                                        </button>
                                      );
                                    }

                                    // Show execute button
                                    return (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          executeStep(round, executeMode);
                                        }}
                                        disabled={hasActiveJob}
                                        className="flex items-center justify-center gap-1 w-16 px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 rounded transition-colors disabled:cursor-not-allowed"
                                        title={executeMode === 'step1' ? 'Run Step 1 Only' : 'Run All Steps'}
                                      >
                                        <Play className="w-3 h-3" />
                                        {executeMode === 'step1' ? '1' : 'All'}
                                      </button>
                                    );
                                  })()}
                                </td>
                              </tr>
                            );
                          });
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
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