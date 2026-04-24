"use client";

import { useCallback, useEffect, useState } from "react";

import { HeroSection } from "@/components/landing/hero-section";
import { StepsSection } from "@/components/landing/steps-section";
import { AudienceSection } from "@/components/landing/audience-section";
import { PrivacySection } from "@/components/landing/privacy-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { CtaSection } from "@/components/landing/cta-section";
import { RecentNotesSection } from "@/components/landing/recent-notes-section";
import {
  listNotes,
  deleteNote,
  deleteOldestNote,
  QuotaExceededError,
} from "@/lib/note/store";
import type { Note } from "@/lib/note/types";

export default function HomePage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    listNotes()
      .then((all) => {
        if (cancelled) return;
        setNotes(all);
        setError(null);
        setIsQuotaError(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load notes from local storage.";
        setError(message);
        setIsQuotaError(err instanceof QuotaExceededError);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm("Delete this note? This cannot be undone.")) return;
      await deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [],
  );

  const handleDeleteOldest = useCallback(async () => {
    const deletedId = await deleteOldestNote();
    if (deletedId) {
      setNotes((prev) => prev.filter((n) => n.id !== deletedId));
      setError(null);
      setIsQuotaError(false);
    }
  }, []);

  const hasNotes = !loading && notes.length > 0;

  return (
    <div className="relative isolate overflow-x-clip">
      <HeroSection />
      <StepsSection />
      <AudienceSection />
      <PrivacySection />
      <FeaturesSection />
      {hasNotes && (
        <RecentNotesSection
          notes={notes}
          loading={loading}
          error={error}
          isQuotaError={isQuotaError}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onDelete={handleDelete}
          onDeleteOldest={handleDeleteOldest}
        />
      )}
      <CtaSection />
    </div>
  );
}