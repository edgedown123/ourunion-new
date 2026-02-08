import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
  /** If true, toolbar can be collapsed/expanded (useful on small mobile screens). */
  collapsibleToolbar?: boolean;
  /** Initial open state when collapsibleToolbar=true. If omitted, defaults to desktop open / mobile closed. */
  toolbarDefaultOpen?: boolean;
};

/**
 * Lightweight rich-text editor for mobile-friendly PWA.
 * Uses document.execCommand for broad compatibility (Android WebView/Chrome).
 * Supports: font size(3 steps), bold, italic, underline, strike-through, text color.
 */
const RichTextEditor = React.forwardRef<HTMLDivElement, Props>(
  (
    {
      value,
      onChange,
      placeholder = "내용을 입력하세요.",
      minHeightClassName = "min-h-[220px]",
      collapsibleToolbar = false,
      toolbarDefaultOpen,
    },
    forwardedRef
  ) => {
    const innerRef = useRef<HTMLDivElement | null>(null);
    const editorEl = () => (forwardedRef && typeof forwardedRef !== "function"
      ? (forwardedRef.current || innerRef.current)
      : innerRef.current);

    const [isFocused, setIsFocused] = useState(false);

    const [toolbarOpen, setToolbarOpen] = useState<boolean>(() => {
      // default: open on desktop, closed on small screens
      if (typeof window === 'undefined') return true;
      return window.innerWidth >= 768;
    });

    useEffect(() => {
      if (typeof toolbarDefaultOpen === 'boolean') {
        setToolbarOpen(toolbarDefaultOpen);
      }
    }, [toolbarDefaultOpen]);

    const colors = useMemo(
      () => ["#111827", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7"],
      []
    );

    const focusEditor = () => {
      editorEl()?.focus();
    };

    const exec = (command: string, arg?: string) => {
      focusEditor();
      try {
        // @ts-ignore
        document.execCommand(command, false, arg);
      } catch {
        // ignore
      }
      const html = editorEl()?.innerHTML ?? "";
      onChange(html);
    };

    const applyFontSize = (size: "normal" | "large" | "xlarge") => {
      const map: Record<typeof size, string> = { normal: "3", large: "4", xlarge: "5" };
      exec("fontSize", map[size]);
    };

    const handleInput = () => {
      const html = editorEl()?.innerHTML ?? "";
      onChange(html);
    };

    useEffect(() => {
      const el = editorEl();
      if (!el) return;
      if (el.innerHTML !== (value ?? "")) {
        el.innerHTML = value ?? "";
      }
    }, [value]);

    // keep forwardedRef in sync (when it's a function ref)
    useEffect(() => {
      if (!forwardedRef) return;
      if (typeof forwardedRef === "function") {
        forwardedRef(innerRef.current);
      } else {
        forwardedRef.current = innerRef.current;
      }
    }, [forwardedRef]);

    const showPlaceholder =
      !isFocused && (!value || value === "<br>" || value === "<div><br></div>");

    return (
      <div className="w-full">
        {/* Toolbar */}
        {collapsibleToolbar && (
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setToolbarOpen(v => !v)}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white shadow-sm text-sm font-bold flex items-center gap-2"
              aria-label="편집 도구 열기/닫기"
              title="편집 도구"
            >
              편집도구
              <span className="text-gray-400">{toolbarOpen ? "▲" : "▼"}</span>
            </button>
            {!toolbarOpen && (
              <span className="text-[11px] text-gray-500">필요할 때만 펼쳐서 사용하세요</span>
            )}
          </div>
        )}

        {(toolbarOpen || !collapsibleToolbar) && (
          <div className="sticky top-[56px] z-10 bg-white/95 backdrop-blur border border-gray-100 rounded-2xl px-3 py-2 mb-3 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => applyFontSize("normal")}
                className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200 hover:bg-gray-50"
              >
                보통
              </button>
              <button
                type="button"
                onClick={() => applyFontSize("large")}
                className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200 hover:bg-gray-50"
              >
                크게
              </button>
              <button
                type="button"
                onClick={() => applyFontSize("xlarge")}
                className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200 hover:bg-gray-50"
              >
                더 크게
              </button>

              <div className="w-px h-6 bg-gray-200 mx-1" />

              <button
                type="button"
                onClick={() => exec("bold")}
                className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 font-black"
                aria-label="굵게"
                title="굵게"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => exec("italic")}
                className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 italic font-black"
                aria-label="기울기"
                title="기울기"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => exec("underline")}
                className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 underline font-black"
                aria-label="밑줄"
                title="밑줄"
              >
                U
              </button>
              <button
                type="button"
                onClick={() => exec("strikeThrough")}
                className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 line-through font-black"
                aria-label="가운데줄"
                title="가운데줄"
              >
                S
              </button>

              <div className="w-px h-6 bg-gray-200 mx-1" />

              <div className="flex items-center gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => exec("foreColor", c)}
                    className="w-7 h-7 rounded-lg border border-gray-200"
                    style={{ backgroundColor: c }}
                    aria-label={`색상 ${c}`}
                    title="글자색"
                  />
                ))}
              </div>

              <div className="flex-1" />

              <button
                type="button"
                onClick={() => exec("removeFormat")}
                className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200 hover:bg-gray-50"
                title="서식 제거"
              >
                서식삭제
              </button>
            </div>
          </div>
        )}
            <div className="flex-1" />

            <button
              type="button"
              onClick={() => exec("removeFormat")}
              className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200 hover:bg-gray-50"
              title="서식 제거"
            >
              서식삭제
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="relative">
          <div
            ref={innerRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={[
              "w-full rounded-2xl border px-4 py-4 text-base leading-7",
              "border-gray-200 bg-white shadow-sm",
              minHeightClassName,
              "focus:outline-none focus:ring-2 focus:ring-sky-primary/30",
              "[&_font[size='1']]:text-xs [&_font[size='2']]:text-sm [&_font[size='3']]:text-base [&_font[size='4']]:text-xl [&_font[size='5']]:text-2xl [&_font[size='6']]:text-3xl [&_font[size='7']]:text-4xl",
              "[&_*]:break-words",
            ].join(" ")}
          />
          {showPlaceholder && (
            <div className="pointer-events-none absolute top-0 left-0 right-0 px-4 py-4 text-gray-400 select-none">
              {placeholder}
            </div>
          )}
        </div>
      </div>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";
export default RichTextEditor;
