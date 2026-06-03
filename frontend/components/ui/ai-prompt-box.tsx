import React from "react";
import { Paperclip, Send, ArrowUp, BriefcaseBusiness, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AIPromptBoxProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onAttachFile?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  selectedJobId?: string;
  onJobIdChange?: (id: string) => void;
  jobs?: { id: string; title: string }[];
}

export function AIPromptBox({
  value,
  onChange,
  onSubmit,
  onAttachFile,
  isLoading = false,
  placeholder = "Ask Jobest to search, plan, or run an action...",
  selectedJobId = "",
  onJobIdChange,
  jobs = [],
}: AIPromptBoxProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Auto-resize input textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-3 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10 transition-all duration-150">
      <div className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex w-full bg-transparent border-none text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0 text-[14px] min-h-[40px] resize-none leading-relaxed"
        />

        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-1">
          <div className="flex items-center gap-2">
            {onAttachFile && (
              <button
                type="button"
                onClick={onAttachFile}
                title="Attach Resume PDF"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
              >
                <Paperclip className="h-4.5 w-4.5" />
              </button>
            )}

            {onJobIdChange && (
              <div className="relative inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <BriefcaseBusiness className="h-3.5 w-3.5 text-accent" />
                <select
                  value={selectedJobId}
                  onChange={(e) => onJobIdChange(e.target.value)}
                  className="bg-transparent border-none p-0 pr-5 text-xs font-semibold text-slate-700 focus:ring-0 focus:outline-none cursor-pointer appearance-none"
                >
                  <option value="">Workspace-wide</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 h-3 w-3 pointer-events-none text-slate-400" />
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isLoading || !value.trim()}
            onClick={onSubmit}
            className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center transition-all",
              value.trim()
                ? "bg-accent text-white hover:bg-blue-700 shadow-sm"
                : "bg-slate-50 text-slate-400 border border-slate-100"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
