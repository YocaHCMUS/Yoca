import { Hono } from "hono";

import { handleAnalyzeWallet } from "../controllers/walletAnalysis.controller.js";

const app = new Hono().post("/analyze", handleAnalyzeWallet);

export default app;
export type WalletAnalysisAppType = typeof app;