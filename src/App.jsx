import { useState, useMemo, useRef } from "react";
import "./quiz.css";
import { CATEGORIES, SCALE } from "./questions.js";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const MAX_VAL = SCALE[SCALE.length - 1].value;
const labelOf = (val) => SCALE.find((s) => s.value === val)?.label ?? "";
const pctOf   = (val) => Math.round((val / MAX_VAL) * 100);

// ─── EXPORT HELPERS ───────────────────────────────────────────────────────────

/**
 * Captures the results DOM node and downloads it as a PNG image.
 * Requires: npm install html2canvas
 */
async function exportAsImage(element, filename = "quiz-results.png") {
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(element, {
        backgroundColor: "#0a0a0c",
        scale: 2,             // 2× for retina sharpness
        useCORS: true,
        logging: false,
    });
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
}

/**
 * Captures the results DOM node and downloads it as a PDF.
 * Requires: npm install html2canvas jspdf
 */
async function exportAsPDF(element, filename = "quiz-results.pdf") {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF }   = await import("jspdf");

    const canvas = await html2canvas(element, {
        backgroundColor: "#0a0a0c",
        scale: 2,
        useCORS: true,
        logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width / 2, canvas.height / 2],
    });

    pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
    pdf.save(filename);
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function PreferenceQuiz() {
    // Which category the user is currently on (0-indexed)
    const [catIndex,      setCatIndex]     = useState(0);
    const [answers,       setAnswers]      = useState({});
    const [submitted,     setSubmitted]    = useState(false);
    const [exporting,     setExporting]    = useState(null);
    // Which question id currently has its tooltip open (null = none)
    const [activeTooltip, setActiveTooltip] = useState(null);

    const resultsRef = useRef(null);

    const currentCategory = CATEGORIES[catIndex];
    const isLastCategory  = catIndex === CATEGORIES.length - 1;

    // How many questions in the current category are answered
    const answeredInCurrent = useMemo(
        () => currentCategory.questions.filter((q) => q.id in answers).length,
        [answers, currentCategory]
    );
    const allCurrentAnswered = answeredInCurrent === currentCategory.questions.length;

    const pick = (qid, val) =>
        setAnswers((prev) => ({ ...prev, [qid]: val }));

    // Advance to next category or show results
    const handleNext = () => {
        if (!allCurrentAnswered) return;
        if (isLastCategory) {
            setSubmitted(true);
        } else {
            setCatIndex((i) => i + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    // Export handlers
    const handleExportImage = async () => {
        if (!resultsRef.current) return;
        setExporting("image");
        try { await exportAsImage(resultsRef.current); }
        finally { setExporting(null); }
    };

    const handleExportPDF = async () => {
        if (!resultsRef.current) return;
        setExporting("pdf");
        try { await exportAsPDF(resultsRef.current); }
        finally { setExporting(null); }
    };

    const handleRetake = () => {
        setAnswers({});
        setCatIndex(0);
        setSubmitted(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ── QUIZ VIEW ──────────────────────────────────────────────────────────────
    if (!submitted) {
        const progressPct = (answeredInCurrent / currentCategory.questions.length) * 100;

        return (
            <div className="quiz-wrapper">

                {/* Top bar — Ko-fi button sits here, replace the href with your page */}
                <div className="topbar">
                    <a
                        className="kofi-btn"
                        href="https://ko-fi.com/lycheejuice"
                        target="_blank"
                        rel="noreferrer"
                    >
                        ☕ Support me on Ko-fi
                    </a>
                </div>

                {/* Category breadcrumb strip */}
                <nav className="category-strip" aria-label="Progress">
                    {CATEGORIES.map((cat, i) => {
                        const state =
                            i < catIndex  ? "done"   :
                                i === catIndex ? "active" : "";
                        return (
                            <span key={cat.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`category-pip ${state}`}>
                  <span className="pip-dot" />
                  <span className="category-pip-label">{cat.title}</span>
                </span>
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

                {/* Progress */}
                <p className="progress-label">
                    {answeredInCurrent} of {currentCategory.questions.length} answered
                </p>
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

                {/* Navigation */}
                <div className="nav-row">
                    <p className="answered-count">
                        <span>{answeredInCurrent}</span> / {currentCategory.questions.length} completed
                    </p>
                    <button
                        className={`next-btn${allCurrentAnswered ? " active" : ""}`}
                        onClick={handleNext}
                    >
                        {isLastCategory ? "See results →" : `Next: ${CATEGORIES[catIndex + 1].title} →`}
                    </button>
                </div>

            </div>
        );
    }

    // ── RESULTS VIEW ───────────────────────────────────────────────────────────
    return (
        <div className="quiz-wrapper">
            <div className="results">

                {/* This ref wraps everything that gets captured for export */}
                <div ref={resultsRef} style={{ padding: "0 0 32px" }}>

                    <div className="results-header">
                        <p className="results-eyebrow">Complete</p>
                        <h2 className="results-title">Your Results</h2>
                        <p className="results-sub">
                            {Object.keys(answers).length} questions across {CATEGORIES.length} categories
                        </p>
                    </div>

                    {CATEGORIES.map((cat) => (
                        <div key={cat.id} className="result-category">
                            <p className="result-category-title">{cat.title}</p>

                            {cat.questions.map((q) => {
                                const val = answers[q.id] ?? 0;
                                return (
                                    <div key={q.id} className="result-row">
                                        <p className="result-question">{q.text}</p>
                                        <div className="result-bar-track">
                                            <div
                                                className="result-bar-fill"
                                                style={{ width: `${pctOf(val)}%` }}
                                            />
                                        </div>
                                        <span className="result-value">{labelOf(val)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                </div>{/* end resultsRef */}

                {/* Export / retake actions */}
                <div className="results-actions">

                    <button
                        className="action-btn primary"
                        onClick={handleExportPDF}
                        disabled={!!exporting}
                    >
                        {exporting === "pdf"
                            ? <><span className="spinner" /> Generating…</>
                            : "↓ Save as PDF"
                        }
                    </button>

                    <button
                        className="action-btn primary"
                        onClick={handleExportImage}
                        disabled={!!exporting}
                    >
                        {exporting === "image"
                            ? <><span className="spinner" /> Generating…</>
                            : "↓ Save as Image"
                        }
                    </button>

                    <button className="action-btn" onClick={handleRetake}>
                        ← Retake quiz
                    </button>

                </div>
            </div>
        </div>
    );
}
