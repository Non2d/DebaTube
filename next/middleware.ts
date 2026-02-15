import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['en', 'ja']
const defaultLocale = 'en'

function getLocale(request: NextRequest) {
    const acceptLanguage = request.headers.get('accept-language')
    if (acceptLanguage) {
        // Basic parsing of accept-language
        // Example: "ja,en-US;q=0.9,en;q=0.8"
        const preferredLocales = acceptLanguage.split(',')
        for (const locale of preferredLocales) {
            const cleanLocale = locale.split(';')[0].trim().substring(0, 2).toLowerCase();
            if (locales.includes(cleanLocale)) {
                return cleanLocale;
            }
        }
    }
    return defaultLocale
}

export function middleware(request: NextRequest) {
    // Check if there is any supported locale in the pathname
    const { pathname } = request.nextUrl
    const pathnameHasLocale = locales.some(
        (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    )

    if (pathnameHasLocale) return

    // Redirect if there is no locale
    const locale = getLocale(request)
    request.nextUrl.pathname = `/${locale}${pathname}`
    // e.g. incoming request is /products
    // The new URL is now /en/products
    return NextResponse.redirect(request.nextUrl)
}

export const config = {
    matcher: [
        // Skip all internal paths (_next)
        '/((?!_next|api|favicon.ico).*)',
    ],
}
