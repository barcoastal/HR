"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { createPulseSurvey, closePulseSurvey, getPulseSurveyResults } from "@/lib/actions/pulse";
import { useRouter } from "next/navigation";
import { Plus, BarChart3, X, Activity } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

type Survey = {
  id: string;
  question: string;
  status: string;
  createdAt: Date;
  _count: { responses: number };
};

const moodEmojis = ["😫", "😟", "😐", "😊", "🤩"];

export function PulseSurveyManager({ surveys: initialSurveys }: { surveys: Survey[] }) {
  const [surveys, setSurveys] = useState(initialSurveys);
  const [question, setQuestion] = useState("");
  const [creating, setCreating] = useState(false);
  const [resultsDialog, setResultsDialog] = useState<{
    question: string;
    totalResponses: number;
    avgMood: number;
    moodDistribution: number[];
  } | null>(null);
  const router = useRouter();

  async function handleCreate() {
    if (!question.trim()) return;
    setCreating(true);
    const survey = await createPulseSurvey(question.trim());
    setSurveys((s) => [{ ...survey, _count: { responses: 0 } }, ...s.map((x) => ({ ...x, status: "CLOSED" }))]);
    setQuestion("");
    setCreating(false);
    router.refresh();
  }

  async function handleClose(id: string) {
    await closePulseSurvey(id);
    setSurveys((s) => s.map((x) => x.id === id ? { ...x, status: "CLOSED" } : x));
    router.refresh();
  }

  async function handleViewResults(id: string) {
    const results = await getPulseSurveyResults(id);
    if (results) {
      setResultsDialog({
        question: results.survey.question,
        totalResponses: results.totalResponses,
        avgMood: results.avgMood,
        moodDistribution: results.moodDistribution,
      });
    }
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  return (
    <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-purple-500" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Pulse Surveys</h2>
      </div>

      {/* Create new survey */}
      <div className="flex gap-2 mb-4">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="How are you feeling about your workload this week?"
          className={cn(inputClass, "flex-1")}
        />
        <button
          onClick={handleCreate}
          disabled={!question.trim() || creating}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap",
            "bg-[var(--color-accent)] text-white",
            "hover:bg-[var(--color-accent-hover)] transition-colors",
            "disabled:opacity-50"
          )}
        >
          <Plus className="h-4 w-4" />{creating ? "..." : "Create"}
        </button>
      </div>

      {/* Survey list */}
      {surveys.length > 0 && (
        <div className="space-y-2">
          {surveys.map((s) => (
            <div key={s.id} className={cn("flex items-center justify-between p-3 rounded-lg", "bg-[var(--color-background)] border border-[var(--color-border)]")}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text-primary)] truncate">{s.question}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", s.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-500" : "bg-gray-500/15 text-gray-400")}>
                    {s.status}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{s._count.responses} responses</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleViewResults(s.id)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors" title="View results">
                  <BarChart3 className="h-4 w-4" />
                </button>
                {s.status === "ACTIVE" && (
                  <button onClick={() => handleClose(s.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors" title="Close survey">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results Dialog */}
      <Dialog open={!!resultsDialog} onClose={() => setResultsDialog(null)} title="Survey Results">
        {resultsDialog && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-primary)] font-medium">{resultsDialog.question}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className={cn("rounded-lg p-4 text-center", "bg-[var(--color-background)]")}>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{resultsDialog.totalResponses}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Responses</p>
              </div>
              <div className={cn("rounded-lg p-4 text-center", "bg-[var(--color-background)]")}>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{resultsDialog.avgMood}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Avg Mood (1-5)</p>
              </div>
            </div>
            <div className="space-y-2">
              {resultsDialog.moodDistribution.map((count, i) => {
                const pct = resultsDialog.totalResponses > 0 ? (count / resultsDialog.totalResponses) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-lg w-8 text-center">{moodEmojis[i]}</span>
                    <div className="flex-1 h-6 rounded-full bg-[var(--color-background)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--color-accent)] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)] w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
