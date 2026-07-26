import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { attachSession } from "./lib/auth.js";
import authRoutes from "./routes/auth.js";
import complaintRoutes from "./routes/complaints.js";
import assignmentRoutes from "./routes/assignment.js";
import dataRoutes from "./routes/data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(attachSession);

// Uploaded photos and annotated outputs are served statically.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/assignment", assignmentRoutes);
app.use("/api", dataRoutes);

app.get("/api/ping", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`LUMEN backend on http://localhost:${PORT} (CORS origin ${ORIGIN})`);
});
