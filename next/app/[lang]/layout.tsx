import { Suspense } from 'react';
import { AppProvider } from '../../context/context';
import { LanguageProvider } from '../../context/LanguageContext';

export async function generateStaticParams() {
    return [{ lang: 'en' }, { lang: 'ja' }]
}

export default function Layout({
    children,
    params,
}: {
    children: React.ReactNode
    params: { lang: string }
}) {
    // Validate lang param
    const lang = (params.lang === 'ja') ? 'ja' : 'en';

    return (
        <Suspense>
            <LanguageProvider lang={lang}>
                <AppProvider>
                    {children}
                </AppProvider>
            </LanguageProvider>
        </Suspense>
    )
}
