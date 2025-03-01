'use client';

import Link from "next/link";
import { FaGithub } from 'react-icons/fa';

export default function Header() {
    return (
        <header className="bg-blue-500 p-4 flex justify-between items-center z-1100">
            <Link href="/">
                <h1 className="mr-5 px-4 py-2 text-white font-bold hover:text-blue-700 transition-colors duration-300 cursor-pointer text-xl">
                    DebaTube
                </h1>
            </Link>
            <div className="flex items-center">
                <Link href="/registration">
                    <span className="mr-5 px-4 py-2 text-white font-bold hover:text-blue-700 transition-colors duration-300 cursor-pointer">
                        Add Round
                    </span>
                </Link>
                <Link href="/diarization">
                    <span className="px-4 py-2 text-white font-bold hover:text-blue-700 transition-colors duration-300 cursor-pointer">
                        Diarization
                    </span>
                </Link>
                <Link href="https://github.com/Non2d/DebateVizSystem">
                    <button className="rounded-full ml-4 text-white flex items-center justify-center hover:bg-black transition-colors duration-300 cursor-pointer">
                        <FaGithub size={32} />
                    </button>
                </Link>
            </div>
        </header>
    );
}