'use client';

import Link from "next/link";

export default function Header() {
    return (
        <header className="bg-white shadow-md p-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold">Debate Structure Vizualiser</h1>
            <div>
                <Link href="/registration">
                    <span className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-700 transition-colors duration-300 cursor-pointer">
                        試合登録
                    </span>
                </Link>
                {/* Cancelボタン */}
                <Link href="https://github.com/Non2d/DebateVizSystem">
                    <button className="ml-4 px-4 py-2 text-blue-500">
                        使い方
                    </button>
                </Link>
            </div>
        </header>
    );
}