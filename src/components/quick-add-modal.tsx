"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Tent, Mic } from "lucide-react";
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
  "Drafting the master plan...",
  "Finalizing events..."
];

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
  const [successCount, setSuccessCount] = useState<number | null>(null);
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

    try {
      const response = await fetch("/api/events/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business: defaultBusiness, text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse events");
      }

      setSuccessCount(data.createdCount);
      setText("");
      router.refresh();

      setTimeout(() => {
        onClose();
      }, 2000);

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
          Paste your unstructured schedule here (e.g., from WhatsApp). The AI will extract dates, times, crew, trucks, and items to automatically create your events.
        </p>
        <p
          className={styles.businessHint}
          data-business={defaultBusiness.toLowerCase()}
        >
          Adding to {businessLabels[defaultBusiness]}
        </p>

        {successCount !== null ? (
          <div className={styles.success}>
            Successfully created {successCount} events! Refreshing schedule...
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
