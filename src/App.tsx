import { useState, type KeyboardEvent } from "react";
import { ArrowRight, Trash2, History } from "lucide-react";
import { SvgPreviewStage } from "./components/SvgPreviewStage.tsx";
import type {
  AspectRatio,
  GenerateSvgApiResponse,
  SvgGenerationResult,
  SvgStyle,
} from "./types/svg.ts";

const STYLE_OPTIONS: { id: SvgStyle; label: string; hint: string }[] = [
  { id: "flat", label: "扁平插畫", hint: "乾淨色塊與柔和陰影" },
  { id: "line", label: "極簡線條", hint: "統一線寬與留白輪廓" },
  { id: "geometric", label: "幾何構成", hint: "俐落多邊形與對稱比例" },
  { id: "gradient", label: "漸層立體", hint: "平滑光影與層次過渡" },
];

const ASPECT_OPTIONS: { id: AspectRatio; label: string; sizeText: string }[] = [
  { id: "1:1", label: "1:1 正方", sizeText: "512×512" },
  { id: "4:3", label: "4:3 橫式", sizeText: "640×480" },
  { id: "16:9", label: "16:9 寬景", sizeText: "800×450" },
];

const QUICK_PROMPTS: string[] = [
  "一隻可愛的橘色貓咪，戴著藍色小領巾",
  "極簡風格的富士山與旭日東昇",
  "復古黑膠唱片機與飄動的音符",
  "太空人在繁星點點的宇宙中漂浮",
  "一杯冒著熱氣的手沖咖啡與可頌麵包",
];

export default function App() {
  const [prompt, setPrompt] = useState<string>("");
  const [style, setStyle] = useState<SvgStyle>("flat");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [currentSvg, setCurrentSvg] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<SvgGenerationResult[]>([]);

  const generateSvg = async (overridePrompt?: string) => {
    const activePrompt = (overridePrompt ?? prompt).trim();
    if (!activePrompt) {
      setErrorMessage("請先輸入圖形文字描述再開始生成。");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/generate-svg", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: activePrompt,
          style,
          aspectRatio,
        }),
      });

      const rawText = await response.text();
      let data: Partial<GenerateSvgApiResponse> = {};
      try {
        data = JSON.parse(rawText) as Partial<GenerateSvgApiResponse>;
      } catch {
        throw new Error(
          response.status === 502 || response.status === 503 || response.status === 504
            ? "伺服器暫時忙碌或連線中斷，請稍候幾秒後再試一次。"
            : `伺服器回傳非預期格式（HTTP ${response.status}），請稍後再試。`
        );
      }

      if (!response.ok || data.error || !data.svg || !data.metrics) {
        throw new Error(data.error || "生成失敗，請稍後再試。");
      }

      const generatedTitle = data.title || activePrompt.slice(0, 16);
      setCurrentTitle(generatedTitle);
      setCurrentSvg(data.svg);

      const newItem: SvgGenerationResult = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prompt: activePrompt,
        title: generatedTitle,
        svg: data.svg,
        style,
        aspectRatio,
        metrics: data.metrics,
        createdAt: new Date().toLocaleTimeString("zh-Hant", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setHistory((prev) => [newItem, ...prev].slice(0, 8));
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "無法連線至生成服務，請檢查網路狀態後重試。";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isLoading) {
      e.preventDefault();
      void generateSvg();
    }
  };

  const handleQuickStart = () => {
    const sample = "一隻可愛的貓咪";
    setPrompt(sample);
    void generateSvg(sample);
  };

  const handleResetWorkspace = () => {
    setPrompt("");
    setCurrentTitle("");
    setCurrentSvg("");
    setErrorMessage(null);
  };

  const handleSelectHistory = (item: SvgGenerationResult) => {
    setPrompt(item.prompt);
    setStyle(item.style);
    setAspectRatio(item.aspectRatio);
    setCurrentTitle(item.title);
    setCurrentSvg(item.svg);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              向量工坊
            </span>
            <span className="text-slate-300 select-none" aria-hidden="true">
              /
            </span>
            <span className="text-sm text-slate-500 truncate">
              SVG 向量圖生成器
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleResetWorkspace}
              disabled={!prompt && !currentSvg && !errorMessage}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              清空畫布
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-stretch">
          {/* Left Panel: Prompt & Controls */}
          <aside className="flex flex-col gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
              {/* Title */}
              <div className="space-y-1">
                <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
                  描述你想生成的圖形
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  輸入物件、場景與色彩細節，AI 將以可無限縮放的純向量 SVG 格式繪製。
                </p>
              </div>

              {/* Prompt Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="svg-prompt"
                    className="text-xs font-semibold text-slate-700"
                  >
                    文字描述
                  </label>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {prompt.length} / 1000
                  </span>
                </div>
                <textarea
                  id="svg-prompt"
                  rows={4}
                  maxLength={1000}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="例如：一隻可愛的貓咪坐在窗邊看月亮，暖色調插畫風格..."
                  className="w-full px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50/70 border border-slate-200 rounded-lg resize-y focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-slate-500">
                  提示：按下 Ctrl + Enter（Mac 為 Cmd + Enter）可快速生成
                </p>
              </div>

              {/* Quick Prompts */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-700">
                  快速靈感範例
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPrompt(item)}
                      className="px-2.5 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Selector */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-700">
                  視覺風格
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_OPTIONS.map((opt) => {
                    const active = style === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setStyle(opt.id)}
                        className={`p-2.5 text-left rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                          active
                            ? "border-blue-700 bg-blue-50/70 text-slate-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-xs font-semibold">{opt.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {opt.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aspect Ratio Selector */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-700">
                  畫布比例
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_OPTIONS.map((opt) => {
                    const active = aspectRatio === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAspectRatio(opt.id)}
                        className={`px-2.5 py-2 text-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                          active
                            ? "border-blue-700 bg-blue-50/70 text-slate-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-xs font-medium whitespace-nowrap">
                          {opt.label}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                          {opt.sizeText}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary CTA */}
              <button
                type="button"
                onClick={() => void generateSvg()}
                disabled={isLoading || !prompt.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:pointer-events-none rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    <span>正在生成 SVG...</span>
                  </>
                ) : (
                  <>
                    <span>生成 SVG 向量圖</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>

            {/* Session History (only displayed when items exist) */}
            {history.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <History className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span>本次生成紀錄</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistory([])}
                    className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    清除紀錄
                  </button>
                </div>

                <ul className="divide-y divide-slate-100">
                  {history.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectHistory(item)}
                        className="w-full py-2.5 px-2 text-left rounded-md hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 focus-visible:outline-2 focus-visible:outline-blue-600"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-900 truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item.prompt}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                          {item.createdAt}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          {/* Right Panel: Live Preview & Export Stage */}
          <SvgPreviewStage
            title={currentTitle}
            svgCode={currentSvg}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onSvgCodeChange={setCurrentSvg}
            onQuickStart={handleQuickStart}
          />
        </div>
      </main>
    </div>
  );
}
