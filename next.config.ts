import type { NextConfig } from "next";

const githubPagesBasePath = "/Profit-Doctor-WB-Ozon";
const isGithubPagesBuild = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  ...(isGithubPagesBuild
    ? {
        basePath: githubPagesBasePath,
        images: {
          unoptimized: true,
        },
        output: "export" as const,
        trailingSlash: true,
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: isGithubPagesBuild ? githubPagesBasePath : "",
  },
};

export default nextConfig;
