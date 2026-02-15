//コレがないと生htmlみたいになる

/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: '',
    output: 'standalone',
    images: {
        domains: ['img.youtube.com', 'i.ytimg.com'],
    },
    experimental: {
        missingSuspenseWithCSRBailout: false,
    },
};

export default nextConfig;