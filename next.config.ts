import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** Avoid wrong workspace root when another package-lock exists on the drive (Next 15 warning). */
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
