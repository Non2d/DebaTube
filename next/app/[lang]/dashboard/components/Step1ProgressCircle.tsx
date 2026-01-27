import React from 'react';
import { useTheme } from 'next-themes';
import { BackgroundStepStatus } from '@/components/lib/utils';

interface Step1ProgressCircleProps {
  step1a: BackgroundStepStatus;
  step1b: BackgroundStepStatus;
  step1c: BackgroundStepStatus;
  step1d: BackgroundStepStatus;
}

/**
 * Step 1 (1-A～1-D) の進捗を円グラフで表示するコンポーネント
 * - 1-A: 25% (90°)
 * - 1-B: 50% (180°)
 * - 1-C: 75% (270°)
 * - 1-D: 100% (チェックマーク表示)
 */
export default function Step1ProgressCircle({
  step1a,
  step1b,
  step1c,
  step1d,
}: Step1ProgressCircleProps) {
  const { theme } = useTheme();

  // 1-B以降の依存関係エラー（1-Aを無視）
  const laterStepsError =
    (step1c !== 'not_in_queue' && step1b !== 'done') ||
    (step1d !== 'not_in_queue' && step1c !== 'done');

  // 警告チェック：1-A だけが not_in_queue で、1-B 以降が進んでいて、1-B以降の依存関係は正しい（キャッシュ削除）
  const hasWarning =
    step1a === 'not_in_queue' &&
    (step1b !== 'not_in_queue' || step1c !== 'not_in_queue' || step1d !== 'not_in_queue') &&
    !laterStepsError;

  // エラーチェック：1-B以降の依存エラー、または1-Aの依存エラー（警告でない場合）
  const hasError =
    laterStepsError ||
    (step1b !== 'not_in_queue' && step1a !== 'done' && !hasWarning);

  // Step 1 全体の進捗率を計算
  // エラーがなければ、最後に done になったステップの位置に基づいて進捗率を決定
  let totalProgress = 0;
  if (!hasError) {
    if (step1d === 'done') {
      totalProgress = 100;
    } else if (step1c === 'done') {
      totalProgress = 75;
    } else if (step1b === 'done') {
      totalProgress = 50;
    } else if (step1a === 'done') {
      totalProgress = 25;
    }
  }

  const progressDeg = (totalProgress / 100) * 360;

  const progressColor = '#22c55e'; // bg-green-500
  const warningColor = '#f59e0b'; // amber-500
  const errorColor = '#ef4444'; // red-500
  const baseColor = theme === 'dark' ? '#374151' : '#d1d5db'; // gray-700 dark, gray-300 light
  const gradientColor = hasError
    ? errorColor
    : hasWarning
    ? warningColor
    : step1a !== 'not_in_queue' || step1b !== 'not_in_queue' || step1c !== 'not_in_queue' || step1d !== 'not_in_queue'
    ? progressColor
    : baseColor;

  return (
    <div className="relative w-5 h-5">
      {/* ベース：明るい灰色（ライト）/ 暗い灰色（ダーク） */}
      <div className="absolute inset-0 rounded-full bg-gray-300 dark:bg-gray-700" />

      {/* 進捗部分：緑、警告色、またはエラー色 */}
      {!hasError && !hasWarning && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${gradientColor} 0deg, ${gradientColor} ${progressDeg}deg, transparent ${progressDeg}deg)`,
            transition: 'background 0.3s ease',
          }}
        />
      )}

      {hasWarning && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${warningColor} 0deg, ${warningColor} ${progressDeg}deg, transparent ${progressDeg}deg)`,
            transition: 'background 0.3s ease',
          }}
        />
      )}

      {hasError && (
        <div className="absolute inset-0 rounded-full bg-red-500" />
      )}

      {/* テキスト */}
      <div className="absolute inset-0 rounded-full flex items-center justify-center text-white text-sm font-black">
        {hasError || hasWarning ? '!' : step1d === 'done' ? '✓' : '1'}
      </div>

      {/* 処理中のアニメーション */}
      {(hasError ||
        step1a === 'processing' || step1a === 'in_queue' ||
        step1b === 'processing' || step1b === 'in_queue' ||
        step1c === 'processing' || step1c === 'in_queue' ||
        step1d === 'processing' || step1d === 'in_queue') && (
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent animate-spin z-10"
          style={{
            borderTopColor: hasError ? errorColor : gradientColor,
          }}
        />
      )}
    </div>
  );
}
