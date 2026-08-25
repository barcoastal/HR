"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveTrainingEligibleJobTitles } from "@/lib/actions/company-settings";
import { Icon } from "@/components/ui/icon";

type JobTitle = { id: string; name: string };

function selectionKey(titles: string[]): string {
  return [...titles].sort((a, b) => a.localeCompare(b)).join("\u0000");
}

export function TrainingEligibilitySettings({
  jobTitles,
  initialTitles,
}: {
  jobTitles: JobTitle[];
  initialTitles: string[];
}) {
  const [selectedTitles, setSelectedTitles] = useState(initialTitles);
  const [savedTitles, setSavedTitles] = useState(initialTitles);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = selectionKey(selectedTitles) !== selectionKey(savedTitles);

  function toggleTitle(name: string) {
    setMessage(null);
    setError(null);
    setSelectedTitles((current) => current.includes(name)
      ? current.filter((title) => title !== name)
      : [...current, name]);
  }

  function saveSelection() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const saved = await saveTrainingEligibleJobTitles(selectedTitles);
        setSelectedTitles(saved);
        setSavedTitles(saved);
        setMessage("Training eligibility saved.");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Could not save Training eligibility.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
          <Icon name="school" size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Training eligibility</h3>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[var(--color-text-muted)]">
            Choose which job titles can be routed from Written Offer into Training. All other new hires move directly to Onboarding.
          </p>
        </div>
      </div>

      {jobTitles.length > 0 ? (
        <fieldset className="mt-4">
          <legend className="sr-only">Job titles eligible for Training</legend>
          <div className="grid gap-x-6 border-y border-[var(--color-border)] py-2 sm:grid-cols-2">
            {jobTitles.map((jobTitle) => {
              const checked = selectedTitles.includes(jobTitle.name);
              return (
                <label key={jobTitle.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-[var(--color-surface-hover)]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTitle(jobTitle.name)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
                  />
                  <span className="font-medium text-[var(--color-text-primary)]">{jobTitle.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <div className="mt-4 rounded-lg bg-[var(--color-background)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
          Add job titles under <Link href="/settings?section=organization&panel=job-titles" className="font-medium text-[var(--color-accent)] hover:underline">Organization settings</Link> before configuring Training.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="min-h-5 text-xs">
          {error ? (
            <span className="text-red-700">{error}</span>
          ) : message ? (
            <span className="text-emerald-700">{message}</span>
          ) : (
            <span className="text-[var(--color-text-muted)]">
              {selectedTitles.length === 0
                ? "No titles selected. Everyone will skip Training."
                : `${selectedTitles.length} job title${selectedTitles.length === 1 ? "" : "s"} selected.`}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={saveSelection}
          disabled={!dirty || isPending || jobTitles.length === 0}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending && <Icon name="progress_activity" size={14} className="animate-material-spin" />}
          {isPending ? "Saving..." : "Save eligibility"}
        </button>
      </div>
    </section>
  );
}
