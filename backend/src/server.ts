// Loads backend/.env if present. The file is gitignored and optional — the
// only key it carries is ANTHROPIC_API_KEY, and the assistant falls back to
// its local query engine when that is absent.
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { attachSession } from "./lib/auth.js";
import authRoutes from "./routes/auth.js";
import complaintRoutes from "./routes/complaints.js";
import assistantRoutes from "./routes/assistant.js";
import dataRoutes from "./routes/data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT ?? 4000);
// Comma-separated, so the deployed web app and a local one can both be served
// without a rebuild. The mobile app is not affected either way: a native
// request carries no Origin header, so CORS never applies to it.
const ORIGINS = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
  .split(",").map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ORIGINS.includes(origin)),
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(attachSession);

// Uploaded photos and annotated outputs are served statically.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api", dataRoutes);

app.get("/api/ping", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`LUMEN backend on http://localhost:${PORT} (CORS origins ${ORIGINS.join(", ")})`);
});
