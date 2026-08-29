import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Pin the workspace root to this app.
   *
   * Next infers the root by walking up for lockfiles, and an unrelated
   * `package-lock.json` in a parent directory makes it choose that instead. The
   * inferred root decides which files are traced into the deployment bundle, so
   * getting it wrong produces a build that works locally and is missing files once
   * deployed.
   */
  outputFileTracingRoot: path.join(__dirname),

  /**
   * Security headers.
   *
   * These defend the *frontend* origin. They are not the access-control model — that
   * lives in Strapi — but they close the browser-side gaps that backend policies
   * cannot reach, principally clickjacking and MIME sniffing.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
