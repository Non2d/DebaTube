import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAPIRoot(): string {
    const host = typeof window !== "undefined" ? window.location.host : "";
    return host.endsWith(".ts.net")
        ? `https://${host}/v1`
        : process.env.NODE_ENV === "production"
        ? "https://vps4.nkmr.io/debates/v1"
        : "http://localhost:8080";
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
