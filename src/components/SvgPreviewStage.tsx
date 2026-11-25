import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  PenTool,
} from "lucide-react";
import type { CanvasBackdrop, StageTab } from "../types/svg.ts";
import { extractSvgMetrics, sanitizeSvg } from "../utils/svgSanitizer.ts";

interface SvgPreviewStageProps {
  title: string;
  svgCode: string;
  isLoading: boolean;
  errorMessage: string | null;
  onSvgCodeChange: (nextCode: string) => void;
  onQuickStart: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function makeDownloadFilename(title: string): string {
  const sanitized = title
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-");
  return `${sanitized || "vector-artwork"}.svg`;
}

export function SvgPreviewStage({
  title,
  svgCode,
  isLoading,
  errorMessage,
  onSvgCodeChange,
  onQuickStart,
}: SvgPreviewStageProps) {
  const [activeTab, setActiveTab] = useState<StageTab>("preview");
  const [backdrop, setBackdrop] = useState<CanvasBackdrop>("checkerboard");
  const [zoom, setZoom] = useState<number>(100);
  const [copied, setCopied] = useState<boolean>(false);
  const [previewLoadError, setPreviewLoadError] = useState<boolean>(false);

  const safeSvg = useMemo(() => {
    if (!svgCode.trim()) return "";
    return sanitizeSvg(svgCode);
  }, [svgCode]);

  const metrics = useMemo(() => {
    if (!safeSvg) return null;
    return extractSvgMetrics(safeSvg);
  }, [safeSvg]);

  const previewDimensions = useMemo(() => {
    const rawW = metrics?.width && metrics.width > 0 ? metrics.width : 512;
    const rawH = metrics?.height && metrics.height > 0 ? metrics.height : 512;
    const fitScale = Math.min(560 / rawW, 440 / rawH, 1);
    const scale = fitScale * (zoom / 100);
    return {
      width: Math.round(rawW * scale),
      height: Math.round(rawH * scale),
    };
  }, [metrics, zoom]);

  const previewUrl = useMemo(() => {
    if (!safeSvg) return null;
    const blob = new Blob([safeSvg], { type: "image/svg+xml;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [safeSvg]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    setCopied(false);
    setPreviewLoadError(false);
  }, [svgCode]);

  const handleCopyCode = async () => {
    if (!safeSvg) return;
    try {
      await navigator.clipboard.writeText(safeSvg);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = safeSvg;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadSvg = () => {
    if (!safeSvg) return;
    const blob = new Blob([safeSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = makeDownloadFilename(title);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(200, prev + 25));
  const handleZoomOut = () => setZoom((prev) => Math.max(50, prev - 25));
  const handleZoomReset = () => setZoom(100);

  const stageBgClass =
    backdrop === "checkerboard"
      ? "checkerboard-bg"
      : backdrop === "dark"
      ? "bg-slate-900"
      : "bg-white";

  const hasSvg = Boolean(safeSvg && previewUrl);

  return (
    <section
      aria-label="向量圖預覽與匯出區"
      className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden min-h-[580px] lg:h-full"
    >
      {/* Top Workspace Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/70">
        {/* View Mode Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          <div
            role="tablist"
            aria-label="檢視模式"
            className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "preview"}
              onClick={() => setActiveTab("preview")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                activeTab === "preview"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              即時預覽
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "code"}
              onClick={() => setActiveTab("code")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                activeTab === "code"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
              SVG 程式碼
            </button>
          </div>

          {activeTab === "preview" && (
            <>
              {/* Canvas Backdrop Controls */}
              <div
                aria-label="畫布底色切換"
                className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg"
              >
                <button
                  type="button"
                  onClick={() => setBackdrop("checkerboard")}
                  className={`px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    backdrop === "checkerboard"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  透明網格
                </button>
                <button
                  type="button"
                  onClick={() => setBackdrop("light")}
                  className={`px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    backdrop === "light"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  純白
                </button>
                <button
                  type="button"
                  onClick={() => setBackdrop("dark")}
                  className={`px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    backdrop === "dark"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  深色
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="inline-flex items-center border border-slate-200 bg-white rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  aria-label="縮小預覽"
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  title="重設縮放比例"
                  className="px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-700 hover:bg-slate-50 border-x border-slate-200 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  {zoom}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  aria-label="放大預覽"
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Export Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyCode}
            disabled={!hasSvg || isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span className="text-emerald-700">已複製程式碼</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <span>複製 SVG 程式碼</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadSvg}
            disabled={!hasSvg || isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>下載 SVG 檔案</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 px-4 py-3 bg-red-50 border-b border-red-200 text-red-800 text-sm"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Main Viewport Stage */}
      <div className="relative flex-1 flex flex-col min-h-[440px]">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50">
            <div className="w-64 h-64 rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center gap-4 p-6">
              <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-blue-700 animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-slate-800">
                  正在繪製 SVG 向量圖形
                </p>
                <p className="text-xs text-slate-500">
                  透過 Gemini 4 Flash 建構向量路徑與配色
                </p>
              </div>
            </div>
          </div>
        ) : !hasSvg && activeTab === "preview" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center checkerboard-bg">
            <div className="max-w-sm bg-white/95 border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="w-11 h-11 mx-auto rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                <PenTool className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-semibold text-slate-900">
                  向量畫布準備就緒
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  在左側輸入任何圖形描述（例如「一隻可愛的貓咪」），按下生成後即可於此處即時預覽、檢視原始碼並匯出 SVG 檔案。
                </p>
              </div>
              <button
                type="button"
                onClick={onQuickStart}
                className="inline-flex items-center justify-center px-4 py-2 min-h-[40px] text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                試試範例：一隻可愛的貓咪
              </button>
            </div>
          </div>
        ) : activeTab === "preview" && previewUrl ? (
          <div
            className={`flex-1 min-h-0 flex overflow-auto p-8 transition-colors ${stageBgClass}`}
          >
            {previewLoadError ? (
              <div className="m-auto max-w-sm bg-white border border-red-200 rounded-xl p-5 text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-red-600 mx-auto" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-900">
                  無法解析目前的 SVG 語法
                </p>
                <p className="text-xs text-slate-600">
                  請切換至「SVG 程式碼」分頁檢查標籤是否完整，或重新生成圖形。
                </p>
              </div>
            ) : (
              <div
                className="m-auto shrink-0 flex items-center justify-center transition-all duration-150 ease-out"
                style={{
                  width: `${previewDimensions.width}px`,
                  height: `${previewDimensions.height}px`,
                }}
              >
                <img
                  src={previewUrl}
                  alt={title || "生成的 SVG 向量圖預覽"}
                  width={previewDimensions.width}
                  height={previewDimensions.height}
                  referrerPolicy="no-referrer"
                  onLoad={() => setPreviewLoadError(false)}
                  onError={() => setPreviewLoadError(true)}
                  className="w-full h-full object-contain select-none block"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col bg-slate-950 text-slate-100">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 text-xs text-slate-400">
              <span>可直接編輯下方 SVG 原始碼，切換回「即時預覽」將自動套用修改</span>
              {zoom !== 100 && (
                <button
                  type="button"
                  onClick={handleZoomReset}
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  重設縮放
                </button>
              )}
            </div>
            <textarea
              value={svgCode}
              onChange={(e) => onSvgCodeChange(e.target.value)}
              spellCheck={false}
              aria-label="SVG 程式碼編輯區"
              placeholder="生成後的 SVG 程式碼將顯示於此處..."
              className="flex-1 w-full p-4 bg-slate-950 text-slate-100 font-mono text-xs leading-6 resize-none focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Bottom Clean Metadata Strip (Unboxed text with typographic separators) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-200 bg-slate-50/70 text-xs text-slate-500">
        {metrics ? (
          <div className="flex flex-wrap items-center gap-2 tabular-nums">
            <span className="font-medium text-slate-800">{title}</span>
            <span aria-hidden="true">·</span>
            <span>
              畫布 {metrics.width} × {metrics.height} px
            </span>
            <span aria-hidden="true">·</span>
            <span>{metrics.elementCount} 個向量元素</span>
            <span aria-hidden="true">·</span>
            <span>{formatBytes(metrics.byteSize)}</span>
          </div>
        ) : (
          <span>尚未載入向量圖形</span>
        )}
        <div className="text-slate-500 font-mono text-[11px]">
          model: gemini-4-hydrogen
        </div>
      </div>
    </section>
  );
}
