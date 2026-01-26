import React from 'react';
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
  // エラーチェック（依存関係）
  const hasError =
    (step1b !== 'not_in_queue' && step1a !== 'done') ||
    (step1c !== 'not_in_queue' && step1b !== 'done') ||
    (step1d !== 'not_in_queue' && step1c !== 'done');

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

  // 円グラフの色を決定
  const getGradientColor = (): string => {
    // 何か処理が進んでいれば緑
    if (step1b !== 'not_in_queue' || step1c !== 'not_in_queue' || step1d !== 'not_in_queue') {
      return '#10b981'; // green-500
    }
    // デフォルト
    return '#d1d5db'; // gray-300
  };

  const gradientColor = getGradientColor();
  const progressDeg = (totalProgress / 100) * 360;

  const errorColor = '#ef4444'; // red-500

  return (
    <div className="relative w-5 h-5">
      {/* ベース：暗い灰色 */}
      <div className="absolute inset-0 rounded-full bg-gray-700" />

      {/* 進捗部分：緑またはエラー色 */}
      {!hasError && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${gradientColor} 0deg, ${gradientColor} ${progressDeg}deg, transparent ${progressDeg}deg)`,
            transition: 'background 0.3s ease',
          }}
        />
      )}

      {hasError && (
        <div className="absolute inset-0 rounded-full bg-red-500" />
      )}

      {/* テキスト */}
      <div className="absolute inset-0 rounded-full flex items-center justify-center font-bold text-white text-xs">
        {hasError ? '!' : step1d === 'done' ? '✓' : '1'}
      </div>

      {/* 処理中のアニメーション */}
      {(step1a === 'processing' ||
        step1b === 'processing' ||
        step1c === 'processing' ||
        step1d === 'processing') && (
        <div
          className="absolute inset-0 rounded-full border border-transparent animate-spin z-10"
          style={{
            borderTopColor: hasError ? errorColor : gradientColor,
          }}
        />
      )}
    </div>
  );
}
