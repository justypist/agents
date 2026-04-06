import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withWorkflow(nextConfig);
