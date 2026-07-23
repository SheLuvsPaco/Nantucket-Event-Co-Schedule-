"use client";

import {
  useState,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CopyPlus,
  Sparkles,
  X,
  Tent,
  Mic,
} from "lucide-react";
import {
  businessLabels,
  defaultBusiness as fallbackBusiness,
  type Business,
} from "@/lib/businesses";
import styles from "./quick-add-modal.module.css";

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    0: {
      transcript: string;
    };
  }>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const loadingMessages = [
  "Reading your message...",
  "Extracting dates & times...",
  "Finding the right crew...",
  "Checking vehicles & inventory...",
  "Checking for duplicates...",
  "Drafting the master plan...",
  "Finalizing events...",
];

type QuickAddDraft = {
  title: string;
  eventDate: string;
  venue: string | null;
  address: string | null;
  business: Business;
  callTime: string | null;
  notes: string | null;
  timeline: Array<{
    time: string;
    endTime: string | null;
    label: string;
    details: string | null;
    sortOrder: number;
  }>;
  inventory: Array<{ inventoryItemId: string; quantity: number }>;
  staff: Array<{ userId: string }>;
  vehicles: Array<{ vehicleId: string }>;
};

type QuickAddPreviewRow = {
  rowId: string;
  status: "skip" | "create" | "needs_review";
  recommendedAction: "skip" | "create" | "update";
  draft: QuickAddDraft;
  matchedEvent: {
    id: string;
    title: string;
    eventDate: string;
    venue: string | null;
    callTime: string | null;
  } | null;
  candidates: Array<{
    id: string;
    title: string;
    eventDate: string;
    venue: string | null;
    callTime: string | null;
  }>;
  confidence: number;
  reason: string;
  differences: string[];
  warnings: string[];
};

type QuickAddPublishSummary = {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  reviewedCount: number;
};

type ReviewAction = "create" | "update" | "skip";

export function QuickAddModal({
  defaultBusiness = fallbackBusiness,
  onClose,
}: {
  defaultBusiness?: Business;
  onClose: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successSummary, setSuccessSummary] =
    useState<QuickAddPublishSummary | null>(null);
  const [reviewRows, setReviewRows] = useState<QuickAddPreviewRow[] | null>(null);
  const [reviewActions, setReviewActions] = useState<Record<string, ReviewAction>>({});
  const [messageIndex, setMessageIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [loading, onClose]);

  useEffect(() => {
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        // The browser may already have stopped the recognition session.
      }
      recognitionRef.current = null;
    };
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) {
      alert("Voice input is not supported in this browser. Please use Chrome or Safari.");
      return;
    }
    try {
      recognitionRef.current.start();
      setIsListening(true);
      recognitionRef.current.onresult = (event) => {
        let newTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          newTranscript += event.results[i][0].transcript;
        }
        if (newTranscript) {
          setText((prev) => (prev ? prev + "\n" + newTranscript : newTranscript));
        }
      };
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    } catch {
      // Ignore if already started
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1 < loadingMessages.length ? i + 1 : i));
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleParse() {
    if (!text.trim()) return;
    setMessageIndex(0);
    setLoading(true);
    setError("");
    setReviewRows(null);

    try {
      const response = await fetch("/api/events/parse/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business: defaultBusiness, text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse events");
      }

      const rows = data.rows as QuickAddPreviewRow[];
      const needsReview = rows.filter((row) => row.status === "needs_review");
      const initialActions = Object.fromEntries(
        rows.map((row) => [row.rowId, row.recommendedAction]),
      ) as Record<string, ReviewAction>;
      setReviewActions(initialActions);

      if (!needsReview.length) {
        await publishRows(rows, initialActions);
        return;
      }

      setReviewRows(rows);

    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "The schedule could not be parsed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function publishRows(
    rows = reviewRows ?? [],
    actionOverrides = reviewActions,
  ) {
    if (!rows.length) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/events/parse/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rows.map((row) => {
            const action = actionOverrides[row.rowId] ?? row.recommendedAction;
            return {
              rowId: row.rowId,
              originalStatus: row.status,
              action,
              matchedEventId:
                action === "update" ? row.matchedEvent?.id ?? null : null,
              draft: row.draft,
            };
          }),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to publish Quick Add changes");
      }

      setSuccessSummary({
        createdCount: data.createdCount ?? 0,
        updatedCount: data.updatedCount ?? 0,
        skippedCount: data.skippedCount ?? 0,
        reviewedCount: data.reviewedCount ?? 0,
      });
      setText("");
      setReviewRows(null);
      router.refresh();

      setTimeout(() => {
        onClose();
      }, 2400);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "The reviewed events could not be published. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const reviewGroups = reviewRows
    ? {
        create: reviewRows.filter((row) => row.status === "create"),
        skip: reviewRows.filter((row) => row.status === "skip"),
        review: reviewRows.filter((row) => row.status === "needs_review"),
      }
    : null;

  return (
    <div
      aria-labelledby="quick-add-title"
      aria-modal="true"
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
      role="dialog"
    >
      <div className={styles.modal}>
        <button
          aria-label="Close Quick Add"
          className={styles.closeButton}
          disabled={loading}
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" />
        </button>

        <h2 className={styles.title} id="quick-add-title">
          <Sparkles aria-hidden="true" />
          AI Quick Add
        </h2>

        <p className={styles.description}>
          Paste your unstructured schedule here (e.g., from WhatsApp). The AI
          will extract dates, times, crew, trucks, and items, then check for
          duplicates before anything risky is changed.
        </p>
        <p
          className={styles.businessHint}
          data-business={defaultBusiness.toLowerCase()}
        >
          Adding to {businessLabels[defaultBusiness]}
        </p>

        {successSummary !== null ? (
          <div className={styles.success}>
            Quick Add finished: {successSummary.createdCount} created,{" "}
            {successSummary.updatedCount} updated, {successSummary.skippedCount}{" "}
            skipped, {successSummary.reviewedCount} reviewed. Refreshing
            schedule...
          </div>
        ) : reviewRows ? (
          <div className={styles.reviewFlow}>
            <div className={styles.reviewSummary}>
              <span>
                <CopyPlus aria-hidden="true" />
                {reviewGroups?.create.length ?? 0} will create
              </span>
              <span>
                <CheckCircle2 aria-hidden="true" />
                {reviewGroups?.skip.length ?? 0} already exists
              </span>
              <span>
                <AlertTriangle aria-hidden="true" />
                {reviewGroups?.review.length ?? 0} needs review
              </span>
            </div>

            {reviewGroups && reviewGroups.create.length > 0 && (
              <ReviewSection
                title="Will create"
                rows={reviewGroups.create}
                reviewActions={reviewActions}
                setReviewActions={setReviewActions}
                readonly
              />
            )}

            {reviewGroups && reviewGroups.skip.length > 0 && (
              <ReviewSection
                title="Already exists — skipped"
                rows={reviewGroups.skip}
                reviewActions={reviewActions}
                setReviewActions={setReviewActions}
                readonly
              />
            )}

            {reviewGroups && reviewGroups.review.length > 0 && (
              <ReviewSection
                title="Needs review"
                rows={reviewGroups.review}
                reviewActions={reviewActions}
                setReviewActions={setReviewActions}
              />
            )}

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <div className={styles.actions}>
              <button
                className="button"
                disabled={loading}
                onClick={() => {
                  setReviewRows(null);
                  setError("");
                }}
                type="button"
              >
                Back to text
              </button>
              <button
                className="button button-primary"
                disabled={loading}
                onClick={() => publishRows()}
                type="button"
              >
                <Sparkles aria-hidden="true" />
                Publish selected
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.composer}>
            {loading && (
              <div className={styles.loadingOverlay}>
                <div className={styles.loadingTent}>
                  <Tent aria-hidden="true" strokeWidth={1.5} />
                </div>
                <div
                  key={messageIndex}
                  className={styles.loadingMessage}
                >
                  {loadingMessages[messageIndex]}
                </div>
              </div>
            )}

            <div className={styles.content} data-loading={loading}>
              <textarea
                aria-label="Schedule message"
                className={styles.textarea}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="June 19th Friday&#10;Warehouse call 7AM:&#10;Depart for galley 715AM&#10;- 730AM-1030AM Install at Galley Beach..."
              />

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <div className={styles.actions}>
                <button
                  type="button"
                  onPointerDown={startListening}
                  onPointerUp={stopListening}
                  onPointerCancel={stopListening}
                  onPointerLeave={stopListening}
                  className={`button ${styles.voiceButton}`}
                  data-listening={isListening}
                >
                  <Mic aria-hidden="true" />
                  {isListening ? "Listening..." : "Hold to Speak"}
                </button>
                <button
                  className="button button-primary"
                  onClick={handleParse}
                  disabled={loading || !text.trim()}
                  type="button"
                >
                  <Sparkles aria-hidden="true" />
                  Magic Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  rows,
  reviewActions,
  setReviewActions,
  readonly = false,
}: {
  title: string;
  rows: QuickAddPreviewRow[];
  reviewActions: Record<string, ReviewAction>;
  setReviewActions: Dispatch<SetStateAction<Record<string, ReviewAction>>>;
  readonly?: boolean;
}) {
  return (
    <section className={styles.reviewSection}>
      <h3>{title}</h3>
      <div className={styles.reviewList}>
        {rows.map((row) => (
          <article className={styles.reviewCard} key={row.rowId}>
            <div className={styles.reviewCardHeader}>
              <div>
                <p className={styles.reviewEyebrow}>
                  {row.draft.eventDate}
                  {row.draft.callTime ? ` · Warehouse ${row.draft.callTime}` : ""}
                </p>
                <h4>{row.draft.title}</h4>
              </div>
              <span className={styles.reviewBadge} data-status={row.status}>
                {row.status === "create"
                  ? "New"
                  : row.status === "skip"
                    ? "Skipped"
                    : "Review"}
              </span>
            </div>

            <p className={styles.reviewReason}>
              <Clock aria-hidden="true" />
              {row.reason}
            </p>

            {row.matchedEvent && (
              <p className={styles.matchText}>
                Match: {row.matchedEvent.title} · {row.matchedEvent.eventDate}
              </p>
            )}

            {row.differences.length > 0 && (
              <ul className={styles.diffList}>
                {row.differences.map((difference) => (
                  <li key={difference}>{difference}</li>
                ))}
              </ul>
            )}

            {row.warnings.length > 0 && (
              <ul className={styles.warningList}>
                {row.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}

            <div className={styles.miniStats}>
              <span>{row.draft.timeline.length} timeline</span>
              <span>{row.draft.staff.length} crew</span>
              <span>{row.draft.vehicles.length} vehicles</span>
              <span>{row.draft.inventory.length} pack items</span>
            </div>

            {!readonly && (
              <div className={styles.reviewActions}>
                {row.matchedEvent && (
                  <button
                    className={styles.choiceButton}
                    data-selected={reviewActions[row.rowId] === "update"}
                    onClick={() =>
                      setReviewActions((current) => ({
                        ...current,
                        [row.rowId]: "update",
                      }))
                    }
                    type="button"
                  >
                    Update matched event
                  </button>
                )}
                <button
                  className={styles.choiceButton}
                  data-selected={reviewActions[row.rowId] === "skip"}
                  onClick={() =>
                    setReviewActions((current) => ({
                      ...current,
                      [row.rowId]: "skip",
                    }))
                  }
                  type="button"
                >
                  Skip
                </button>
                <button
                  className={styles.choiceButton}
                  data-selected={reviewActions[row.rowId] === "create"}
                  onClick={() =>
                    setReviewActions((current) => ({
                      ...current,
                      [row.rowId]: "create",
                    }))
                  }
                  type="button"
                >
                  Create separate
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
