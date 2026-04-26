/* eslint-disable @typescript-eslint/no-require-imports */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@devconsole/soroban-utils", "@devconsole/ui"],
    turbopack: {},
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.performance = {
                hints: 'warning',
                maxAssetSize: 300000,
                maxEntrypointSize: 400000,
            };
        }
        return config;
    },
};

module.exports = withBundleAnalyzer(nextConfig);
