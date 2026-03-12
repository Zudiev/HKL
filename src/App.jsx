import { useState, useMemo, useRef } from "react";
import "./quiz.css";
import { CATEGORIES, SCALE } from "./questions.js";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const MAX_VAL = SCALE[SCALE.length - 1].value;
const labelOf = (val) => SCALE.find((s) => s.value === val)?.label ?? "—";
const pctOf   = (val) => Math.round((val / MAX_VAL) * 100);

// ─── ENCODE / DECODE SHARE CODE ──────────────────────────────────────────────
//
// v2 format (new, compact):
//   Prefix "v2:" + base64 of a fixed-length string.
//   All question IDs across all categories are sorted numerically.
//   Each position = one character: '0'–'4' for answered, '-' for skipped.
//   Example for 169 questions fully answered: ~230 chars total.
//
// v1 format (old, JSON):
//   Plain base64 of JSON string {"1":2,"2":3,...}
//   Still decoded correctly so old codes keep working.

// Build sorted list of all question IDs once at module level.
const ALL_IDS = CATEGORIES.flatMap((c) => c.questions.map((q) => q.id))
    .sort((a, b) => a - b);

function encodeAnswers(answers) {
    // Build a compact string — one char per question in ID order
    const compact = ALL_IDS.map((id) => {
        const val = answers[id];
        return val !== undefined ? String(val) : "-";
    }).join("");

    // base64-encode the compact string (ASCII only, btoa is fine)
    return "v2:" + btoa(compact);
}

function decodeAnswers(code) {
    const trimmed = code.trim();

    // ── v2 format ──
    if (trimmed.startsWith("v2:")) {
        try {
            const compact = atob(trimmed.slice(3));
            const result  = {};
            for (let i = 0; i < ALL_IDS.length; i++) {
                const ch = compact[i];
                if (ch !== undefined && ch !== "-") {
                    const num = parseInt(ch, 10);
                    if (!isNaN(num)) result[ALL_IDS[i]] = num;
                }
            }
            return result;
        } catch {
            return null;
        }
    }

    // ── v1 format (old JSON base64) — kept for backward compatibility ──
    try {
        const binary  = atob(trimmed);
        const bytes   = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const payload = new TextDecoder().decode(bytes);
        const parsed  = JSON.parse(payload);
        if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
        // v1 stored string keys — normalise to number keys
        const result = {};
        for (const [k, v] of Object.entries(parsed)) {
            result[Number(k)] = v;
        }
        return result;
    } catch {
        return null;
    }
}

// ─── TEXT-BASED PDF ───────────────────────────────────────────────────────────

async function exportAsPDF(answers, filename = "quiz-results.pdf") {
    const { jsPDF } = await import("jspdf");

    const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const PW     = 210; // page width mm
    const margin = 16;
    const usable = PW - margin * 2;
    let   y      = margin;

    const addText = (text, size, bold = false, r = 20, g = 20, b = 20) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(r, g, b);
        const lines = doc.splitTextToSize(text, usable);
        lines.forEach((line) => {
            if (y > 280) { doc.addPage(); y = margin; }
            doc.text(line, margin, y);
            y += size * 0.45;
        });
    };

    const addBar = (pct) => {
        const barW  = 40;
        const barH  = 2.5;
        const barX  = PW - margin - barW;
        if (y > 280) { doc.addPage(); y = margin; }
        doc.setFillColor(220, 220, 220);
        doc.roundedRect(barX, y - 2.5, barW, barH, 1, 1, "F");
        if (pct > 0) {
            doc.setFillColor(201, 169, 110);
            doc.roundedRect(barX, y - 2.5, barW * (pct / 100), barH, 1, 1, "F");
        }
    };

    // column boundary — question text stops here, label sits between here and bar
    const labelColX = PW - margin - 40 - 30;

    // Title
    addText("Quiz Results", 22, true, 15, 15, 15);
    y += 4;
    addText(`${Object.keys(answers).length} questions answered across ${CATEGORIES.length} categories`, 9, false, 120, 120, 120);
    y += 8;

    for (const cat of CATEGORIES) {
        // Category heading
        if (y > 265) { doc.addPage(); y = margin; }
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, PW - margin, y);
        y += 5;
        addText(cat.title.toUpperCase(), 9, true, 100, 100, 180);
        y += 3;

        for (const q of cat.questions) {
            if (y > 278) { doc.addPage(); y = margin; }
            const val   = answers[q.id] !== undefined ? answers[q.id] : null;
            const label = val !== null ? labelOf(val) : "Skipped";
            const pct   = val !== null ? pctOf(val) : 0;

            // question text — constrained to left column only
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(40, 40, 40);
            const lines = doc.splitTextToSize(q.text, labelColX - margin - 4);
            doc.text(lines, margin, y);

            // label — sits in middle column, right-aligned
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            if (val !== null) {
                doc.setTextColor(150, 110, 50);
            } else {
                doc.setTextColor(160, 160, 160);
            }
            doc.text(label, labelColX + 24, y, { align: "right" });

            // bar — rightmost column
            addBar(pct);

            y += lines.length * 4.2 + 1;
        }
        y += 4;
    }

    doc.save(filename);
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function PreferenceQuiz() {
    const [catIndex,      setCatIndex]      = useState(0);
    const [answers,       setAnswers]       = useState({});
    const [submitted,     setSubmitted]     = useState(false);
    const [exporting,     setExporting]     = useState(false);
    const [activeTooltip, setActiveTooltip] = useState(null);

    // Share code modals
    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importInput,     setImportInput]     = useState("");
    const [importError,     setImportError]     = useState("");
    const [copied,          setCopied]          = useState(false);

    // PDF name prompt
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfName,      setPdfName]      = useState("");

    const bottomRef = useRef(null);

    const currentCategory    = CATEGORIES[catIndex];
    const isLastCategory     = catIndex === CATEGORIES.length - 1;
    const isFirstCategory    = catIndex === 0;

    // Questions are now always skippable — count only answered (not required)
    const answeredInCurrent = useMemo(
        () => currentCategory.questions.filter((q) => q.id in answers).length,
        [answers, currentCategory]
    );

    const pick = (qid, val) =>
        setAnswers((prev) => ({ ...prev, [qid]: val }));

    const goToCategory = (index) => {
        setCatIndex(index);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleNext = () => {
        if (isLastCategory) {
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            goToCategory(catIndex + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstCategory) goToCategory(catIndex - 1);
    };

    const handleScrollToBottom = () =>
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });

    const handleRetake = () => {
        setAnswers({});
        setCatIndex(0);
        setSubmitted(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ── Export share code ──
    const shareCode = encodeAnswers(answers);

    const handleCopy = () => {
        navigator.clipboard.writeText(shareCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // ── Import share code ──
    const handleImport = () => {
        const decoded = decodeAnswers(importInput);
        if (!decoded) {
            setImportError("Invalid code — please check and try again.");
            return;
        }
        setAnswers(decoded);
        setSubmitted(true);
        setShowImportModal(false);
        setImportInput("");
        setImportError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ── PDF export ──
    const handleExportPDF = () => {
        setPdfName("");
        setShowPdfModal(true);
    };

    const handleConfirmPDF = async () => {
        setShowPdfModal(false);
        setExporting(true);
        const slug     = pdfName.trim().replace(/\s+/g, "-");
        const filename = slug ? `quiz-result-${slug}.pdf` : "quiz-result.pdf";
        try { await exportAsPDF(answers, filename); }
        finally { setExporting(false); }
    };

    // ── Shared topbar (rendered in both views) ──
    const Topbar = () => (
        <div className="topbar">
            <button className="import-btn" onClick={() => setShowImportModal(true)}>
                ↑ Import results
            </button>
            <a
                className="kofi-btn"
                href="https://ko-fi.com/lycheejuice"
                target="_blank"
                rel="noreferrer"
            >
                ☕ Support me on Ko-fi
            </a>
        </div>
    );

    // ── QUIZ VIEW ─────────────────────────────────────────────────────────────
    if (!submitted) {
        const progressPct = answeredInCurrent / currentCategory.questions.length * 100;

        return (
            <div className="quiz-wrapper">
                <Topbar />

                {/* Clickable category breadcrumb */}
                <nav className="category-strip" aria-label="Progress">
                    {CATEGORIES.map((cat, i) => {
                        const state =
                            i < catIndex   ? "done"   :
                                i === catIndex ? "active" : "";
                        return (
                            <span key={cat.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                    className={`category-pip ${state}`}
                    onClick={() => goToCategory(i)}
                    title={cat.title}
                >
                  <span className="pip-dot" />
                  <span className="category-pip-label">{cat.title}</span>
                </button>
                                {i < CATEGORIES.length - 1 && (
                                    <span className="pip-arrow">›</span>
                                )}
              </span>
                        );
                    })}
                </nav>

                {/* Header */}
                <header className="quiz-header">
                    <p className="quiz-category-label">
                        Category {catIndex + 1} of {CATEGORIES.length}
                    </p>
                    <h1 className="quiz-title">{currentCategory.title}</h1>
                    <p className="quiz-subtitle">{currentCategory.description}</p>
                </header>

                {/* Progress + scroll to bottom */}
                <div className="progress-row">
                    <p className="progress-label">
                        {answeredInCurrent} of {currentCategory.questions.length} answered
                        <span className="skip-hint"> — questions are optional</span>
                    </p>
                    <button className="scroll-bottom-btn" onClick={handleScrollToBottom}>
                        ↓ Jump to bottom
                    </button>
                </div>
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                </div>

                {/* Questions */}
                {currentCategory.questions.map((q, i) => (
                    <div
                        key={q.id}
                        className="question-card"
                        style={{ animationDelay: `${i * 0.05}s` }}
                    >
                        <p className="question-number">Q{String(i + 1).padStart(2, "0")}</p>
                        <div className="question-text-wrapper">
                            <p className="question-text">{q.text}</p>
                            {q.desc && (
                                <span
                                    className="tooltip-anchor"
                                    onMouseEnter={() => setActiveTooltip(q.id)}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                >
                  ?
                                    {activeTooltip === q.id && (
                                        <span className="tooltip-box">{q.desc}</span>
                                    )}
                </span>
                            )}
                        </div>

                        <div className="scale-options">
                            {SCALE.map((opt) => (
                                <button
                                    key={opt.value}
                                    className={`scale-btn${answers[q.id] === opt.value ? " selected" : ""}`}
                                    onClick={() => pick(q.id, opt.value)}
                                >
                                    <span className="dot" />
                                    <span className="scale-label">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Bottom navigation */}
                <div className="nav-row" ref={bottomRef}>
                    <button
                        className="nav-btn prev-btn"
                        onClick={handlePrev}
                        disabled={isFirstCategory}
                    >
                        {!isFirstCategory && `← ${CATEGORIES[catIndex - 1].title}`}
                    </button>

                    <p className="answered-count">
                        <span>{answeredInCurrent}</span> / {currentCategory.questions.length}
                    </p>

                    <button className="nav-btn next-btn active" onClick={handleNext}>
                        {isLastCategory ? "See results →" : `${CATEGORIES[catIndex + 1].title} →`}
                    </button>
                </div>

                {/* Import modal — available during quiz too */}
                {showImportModal && (
                    <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <h3 className="modal-title">Import results</h3>
                            <p className="modal-sub">Paste a share code below to view someone else's results.</p>
                            <textarea
                                className="code-box"
                                value={importInput}
                                onChange={(e) => { setImportInput(e.target.value); setImportError(""); }}
                                placeholder="Paste code here…"
                            />
                            {importError && <p className="import-error">{importError}</p>}
                            <div className="modal-actions">
                                <button className="action-btn primary" onClick={handleImport}>Load results</button>
                                <button className="action-btn" onClick={() => { setShowImportModal(false); setImportError(""); }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── RESULTS VIEW ──────────────────────────────────────────────────────────
    return (
        <div className="quiz-wrapper">
            <Topbar />

            <div className="results">
                <div className="results-header">
                    <p className="results-eyebrow">Complete</p>
                    <h2 className="results-title">Your Results</h2>
                    <p className="results-sub">
                        {Object.keys(answers).length} questions answered across {CATEGORIES.length} categories
                    </p>
                </div>

                {CATEGORIES.map((cat) => (
                    <div key={cat.id} className="result-category">
                        <p className="result-category-title">{cat.title}</p>
                        {cat.questions.map((q) => {
                            const val     = answers[q.id];
                            const skipped = val === undefined;
                            return (
                                <div key={q.id} className={`result-row${skipped ? " skipped" : ""}`}>
                                    <p className="result-question">{q.text}</p>
                                    <div className="result-bar-track">
                                        {!skipped && (
                                            <div className="result-bar-fill" style={{ width: `${pctOf(val)}%` }} />
                                        )}
                                    </div>
                                    <span className="result-value">{skipped ? "—" : labelOf(val)}</span>
                                </div>
                            );
                        })}
                    </div>
                ))}

                {/* Actions */}
                <div className="results-actions">
                    <button
                        className="action-btn primary"
                        onClick={handleExportPDF}
                        disabled={exporting}
                    >
                        {exporting ? <><span className="spinner" /> Generating…</> : "↓ Save as PDF"}
                    </button>

                    <button className="action-btn primary" onClick={() => setShowExportModal(true)}>
                        ⬡ Export share code
                    </button>

                    <button className="action-btn" onClick={handleRetake}>
                        ← Retake quiz
                    </button>
                </div>
            </div>

            {/* Export modal */}
            {showExportModal && (
                <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Share your results</h3>
                        <p className="modal-sub">Copy this code and send it to someone. They can paste it using the Import button.</p>
                        <textarea className="code-box" readOnly value={shareCode} />
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={handleCopy}>
                                {copied ? "✓ Copied!" : "Copy code"}
                            </button>
                            <button className="action-btn" onClick={() => setShowExportModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import modal */}
            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Import results</h3>
                        <p className="modal-sub">Paste a share code below to view someone else's results.</p>
                        <textarea
                            className="code-box"
                            value={importInput}
                            onChange={(e) => { setImportInput(e.target.value); setImportError(""); }}
                            placeholder="Paste code here…"
                        />
                        {importError && <p className="import-error">{importError}</p>}
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={handleImport}>Load results</button>
                            <button className="action-btn" onClick={() => { setShowImportModal(false); setImportError(""); }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* PDF name prompt modal */}
            {showPdfModal && (
                <div className="modal-overlay" onClick={() => setShowPdfModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Save as PDF</h3>
                        <p className="modal-sub">
                            Optionally add a name to identify whose results these are.
                            The file will be saved as <strong>quiz-result-NAME.pdf</strong>.
                        </p>
                        <input
                            className="code-box name-input"
                            type="text"
                            value={pdfName}
                            onChange={(e) => setPdfName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleConfirmPDF()}
                            placeholder="e.g. Alice (leave blank to skip)"
                            autoFocus
                        />
                        <p className="privacy-note">🔒 The name is not stored anywhere — it is only used to label the file.</p>
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={handleConfirmPDF}>
                                ↓ Download PDF
                            </button>
                            <button className="action-btn" onClick={() => setShowPdfModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
