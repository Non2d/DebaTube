import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * バックグラウンド・バッチ処理のステップステータス
 * - not_in_queue: 処理がキューに登録されていない
 * - in_queue: キューに登録済み（処理待ち）
 * - processing: 処理中
 * - done: 完了
 * - error: エラー（前ステップが完了していない）
 */
export type BackgroundStepStatus = 'not_in_queue' | 'in_queue' | 'processing' | 'done' | 'error';

/**
 * バックエンド側のステータス文字列をフロント側の型に変換
 * バックエンド: "NOT_IN_QUEUE", "IN_QUEUE", "PROCESSING", "DONE"
 * フロント: 'not_in_queue', 'in_queue', 'processing', 'done'
 */
export function mapBackgroundStatus(backendStatus: string): BackgroundStepStatus {
  switch (backendStatus) {
    case 'NOT_IN_QUEUE':
      return 'not_in_queue';
    case 'IN_QUEUE':
      return 'in_queue';
    case 'PROCESSING':
      return 'processing';
    case 'DONE':
      return 'done';
    default:
      return 'not_in_queue';
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAPIRoot(): string {
    return process.env.NEXT_PUBLIC_API_ROOT || "http://localhost:8080";
}

export function calculateMode(numbers: number[]): number | null {
    const frequencyMap: { [key: number]: number } = {};

    // 出現回数をカウント
    for (const num of numbers) {
        frequencyMap[num] = (frequencyMap[num] || 0) + 1;
    }

    // 最頻値を求める
    const entries = Object.entries(frequencyMap) as [string, number][];
    const modeEntry = entries.reduce<[number | null, number]>((acc, [num, count]) => {
        return count > acc[1] ? [Number(num), count] : acc;
    }, [null, 0]);

    return modeEntry[0];
}

/**
 * Convert display format to internal model format (backward compatibility)
 * "gemini-2.5-flash (google ai studio)" → "gemini_2_5_flash_studio"
 * If already in internal format, returns as-is
 */
export function toInternalModelName(displayName: string): string {
    // Check if already in internal format
    const internalPattern = /^gemini_\d+_\d+_flash(_lite)?_(studio|vertex)$/;
    if (internalPattern.test(displayName)) {
        return displayName;
    }

    // Otherwise convert from display format (for localStorage backward compatibility)
    const reverseMap: { [key: string]: string } = {
        "gemini-2.5-flash (google ai studio)": "gemini_2_5_flash_studio",
        "gemini-2.5-flash (vertex ai)": "gemini_2_5_flash_vertex",
        "gemini-2.5-flash-lite (google ai studio)": "gemini_2_5_flash_lite_studio",
        "gemini-2.5-flash-lite (vertex ai)": "gemini_2_5_flash_lite_vertex",
        "gemini-3-flash (google ai studio)": "gemini_3_flash_studio",
    };
    return reverseMap[displayName] || displayName;
}
