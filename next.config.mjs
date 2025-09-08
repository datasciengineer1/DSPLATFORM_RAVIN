/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.externals = config.externals || [];
    if (isServer) config.externals.push("onnxruntime-node");
    config.resolve.alias = { ...(config.resolve.alias || {}), "onnxruntime-node": false };
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ["@xenova/transformers", "onnxruntime-web"],
  },
};
export default nextConfig;
