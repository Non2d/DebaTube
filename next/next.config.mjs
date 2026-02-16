//コレがないと生htmlみたいになる

/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
    output: 'standalone',
    images: {
        domains: ['img.youtube.com', 'i.ytimg.com'],
    },
    experimental: {
        missingSuspenseWithCSRBailout: false,
    },
    async redirects() {
        return [
            {
                source: '/',
                destination: '/ja',
                permanent: false,
            },
        ];
    },
};

export default nextConfig;