//コレがないと生htmlみたいになる

/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: process.env.NODE_ENV === 'production' ? '/debates' : '',
    output: 'standalone',
    images: {
        domains: ['img.youtube.com', 'i.ytimg.com'],
    },
    experimental: {
        missingSuspenseWithCSRBailout: false,
    },
};

export default nextConfig;