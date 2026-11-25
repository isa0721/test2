import type { SvgMetrics } from "../utils/svgSanitizer.ts";

export type SvgStyle = "flat" | "line" | "geometric" | "gradient";
export type AspectRatio = "1:1" | "4:3" | "16:9";
export type CanvasBackdrop = "checkerboard" | "light" | "dark";
export type StageTab = "preview" | "code";

export interface SvgGenerationResult {
  id: string;
  prompt: string;
  title: string;
  svg: string;
  style: SvgStyle;
  aspectRatio: AspectRatio;
  metrics: SvgMetrics;
  createdAt: string;
}

export interface GenerateSvgApiResponse {
  title: string;
  svg: string;
  metrics: SvgMetrics;
  model: string;
  error?: string;
}
