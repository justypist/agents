import { config } from "@/config";
import { tavily } from "@tavily/core";

export const tvly = tavily({ apiKey: config.tavily.apiKey });
