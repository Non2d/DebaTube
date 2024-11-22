//コレがないと生htmlみたいになる

/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: process.env.NODE_ENV === 'production' ? '/debates' : '',
    images: {
        domains: ['img.youtube.com'],
    },
};

export default nextConfig;