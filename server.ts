import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { sanitizeSvg, extractSvgMetrics } from "./src/utils/svgSanitizer.ts";

const PORT = 3000;

const STYLE_INSTRUCTIONS: Record<string, string> = {
  flat: "Modern flat vector illustration with clean geometric forms, balanced negative space, harmonious color palette, and subtle layered shadows.",
  line: "Minimalist monoline vector icon/illustration with consistent stroke weights, crisp rounded line caps, clean geometry, and minimal or no fills.",
  geometric: "Bold geometric vector artwork composed of crisp triangles, circles, arcs, and grid-aligned shapes with striking visual contrast.",
  gradient: "Polished dimensional vector artwork utilizing smooth SVG linearGradient and radialGradient fills inside <defs>, layered depth, and soft highlights.",
};

const ASPECT_RATIO_VIEWBOX: Record<string, string> = {
  "1:1": "0 0 512 512",
  "4:3": "0 0 640 480",
  "16:9": "0 0 800 450",
};

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function parseApiError(err: unknown): { status: number; message: string } {
  if (err instanceof Error && err.message === "MISSING_API_KEY") {
    return {
      status: 500,
      message: "伺服器尚未設定 GEMINI_API_KEY，請在 Settings > Secrets 面板確認金鑰設定。",
    };
  }

  const rawMessage = err instanceof Error ? err.message : String(err);
  console.error("[generate-svg error]", rawMessage);
  const statusMatch = rawMessage.match(/\b(400|401|403|404|429|500|503)\b/);
  const statusCode = statusMatch ? Number(statusMatch[1]) : 500;

  if (
    rawMessage.includes("API_KEY_INVALID") ||
    rawMessage.includes("PERMISSION_DENIED") ||
    statusCode === 403
  ) {
    return {
      status: 401,
      message: "Gemini API 金鑰無效或權限不足，請在 Settings > Secrets 面板檢查您的 API 金鑰。",
    };
  }

  if (rawMessage.includes("RESOURCE_EXHAUSTED") || statusCode === 429) {
    return {
      status: 429,
      message: "已達到目前免費配額上限或請求過於頻繁，請稍候片刻再試，或檢查 API 配額設定。",
    };
  }

  if (rawMessage.includes("NOT_FOUND") || statusCode === 404) {
    return {
      status: 404,
      message: "找不到指定的 Gemini 模型，請確認模型名稱或服務可用性。",
    };
  }

  if (rawMessage.includes("UNAVAILABLE") || statusCode === 503) {
    return {
      status: 500,
      message: "目前 AI 服務請求量較高，請稍候幾秒後再重試一次。",
    };
  }

  return {
    status: 500,
    message: "生成 SVG 時發生伺服器錯誤，請稍後再試或調整描述內容。",
  };
}

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes("503") || msg.includes("UNAVAILABLE");
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 700 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.post("/api/generate-svg", async (req, res) => {
    try {
      const body = req.body ?? {};
      const rawPrompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      const styleKey =
        typeof body.style === "string" && body.style in STYLE_INSTRUCTIONS
          ? body.style
          : "flat";
      const aspectKey =
        typeof body.aspectRatio === "string" && body.aspectRatio in ASPECT_RATIO_VIEWBOX
          ? body.aspectRatio
          : "1:1";

      if (!rawPrompt) {
        res.status(400).json({ error: "請輸入要生成的圖形文字描述。" });
        return;
      }

      if (rawPrompt.length > 1000) {
        res.status(400).json({ error: "文字描述請勿超過 1000 個字元。" });
        return;
      }

      const viewBox = ASPECT_RATIO_VIEWBOX[aspectKey];
      const styleGuide = STYLE_INSTRUCTIONS[styleKey];
      const ai = getGeminiClient();

      const systemInstruction = [
        "You are an expert vector graphic designer and SVG engineer.",
        "Your task is to generate high-quality, visually appealing, self-contained SVG vector artwork matching the user's description.",
        `Always output a valid <svg> root element with xmlns="http://www.w3.org/2000/svg" and viewBox="${viewBox}".`,
        `Visual Style Direction: ${styleGuide}`,
        "Design & Technical Rules:",
        "1. Compose rich, well-proportioned vector illustrations using clean <path>, <circle>, <rect>, <ellipse>, <polygon>, <polyline>, <line>, <g>, and <defs> (<linearGradient>, <radialGradient>, <clipPath>).",
        "2. Center the main subject nicely inside the viewBox with comfortable visual margins (at least 8-12% padding around edges).",
        "3. Use harmonious, tasteful color palettes and clear figure-ground contrast. Include tasteful framing or subtle background shapes inside the SVG when appropriate.",
        "4. NEVER include <script>, <foreignObject>, external image URLs, http/https links, or inline event handlers (onclick, onload, etc.).",
        "5. Output format MUST be strictly:",
        "TITLE: <2 to 12 Traditional Chinese characters>",
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">...</svg>`,
        "Do not wrap in markdown code blocks and do not include any extra commentary.",
      ].join("\n");

      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: `請根據以下描述設計並輸出完整的 SVG 向量圖程式碼：\n${rawPrompt}`,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      const responseText = response.text?.trim() ?? "";
      const titleMatch = responseText.match(/^TITLE:\s*(.+)$/im);
      const title = titleMatch?.[1]?.trim().slice(0, 24) || rawPrompt.slice(0, 16);

      const safeSvg = sanitizeSvg(responseText, viewBox);
      if (!safeSvg) {
        console.error("[generate-svg invalid output]", responseText.slice(0, 400));
        res.status(500).json({
          error: "模型回傳的內容無法解析為有效的 SVG 圖形，請試著補充更具體的描述後重新生成。",
        });
        return;
      }

      const metrics = extractSvgMetrics(safeSvg);
      res.json({
        title,
        svg: safeSvg,
        metrics,
        model: "gemini-4-hydrogen",
      });
    } catch (err) {
      const { status, message } = parseApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "找不到請求的 API 端點。" });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      const indexPath = path.join(distDir, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Build artifacts not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
