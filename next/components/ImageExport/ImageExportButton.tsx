"use client";

import React, { useState } from 'react';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';

interface ImageExportButtonProps {
    targetRef: React.RefObject<HTMLDivElement>;
    fileName?: string;
    className?: string;
    disabled?: boolean;
}

export default function ImageExportButton({ 
    targetRef, 
    fileName = 'graph', 
    className = '',
    disabled = false 
}: ImageExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false);

    const exportImage = async () => {
        if (!targetRef.current) {
            toast.error('エクスポート対象が見つかりません');
            return;
        }

        setIsExporting(true);
        toast.loading('画像をエクスポート中...', { id: 'export-toast' });

        try {
            // 少し待機してDOMが安定するのを待つ
            await new Promise(resolve => setTimeout(resolve, 300));

            const dataUrl = await toPng(targetRef.current, {
                backgroundColor: '#ffffff',
                width: 800,
                height: 600,
                pixelRatio: 2, // 高解像度
                filter: (node) => {
                    // ReactFlowのコントロールやミニマップを除外
                    return !node?.classList?.contains('react-flow__controls') &&
                           !node?.classList?.contains('react-flow__minimap');
                }
            });

            // ファイル名を生成（不正な文字を除去）
            const cleanFileName = fileName
                .replace(/[<>:"/\\|?*]/g, '') // 不正な文字を除去
                .replace(/\s+/g, '_') // スペースをアンダースコアに
                .substring(0, 100); // 長すぎる場合は切り詰め

            // ダウンロード
            const link = document.createElement('a');
            link.download = `${cleanFileName}_graph.png`;
            link.href = dataUrl;
            link.click();

            toast.success('画像をエクスポートしました！', { id: 'export-toast' });

        } catch (error) {
            console.error('Export error:', error);
            toast.error('エクスポート中にエラーが発生しました', { id: 'export-toast' });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <button
            onClick={exportImage}
            disabled={disabled || isExporting}
            className={`px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors ${className}`}
        >
            {isExporting ? '📥 エクスポート中...' : '📥 画像保存'}
        </button>
    );
}
