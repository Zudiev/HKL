import { useState, useMemo, useRef } from "react";
import "./quiz.css";
import { CATEGORIES, SCALE } from "./questions.js";



// ─── HELPERS ─────────────────────────────────────────────────────────────────

const MAX_VAL = Math.max(...SCALE.map((s) => s.value));
const labelOf = (val) => SCALE.find((s) => s.value === val)?.label ?? "—";
const pctOf   = (val) => Math.round((val / MAX_VAL) * 100);

// ─── ENCODE / DECODE SHARE CODE ──────────────────────────────────────────────
const ALL_IDS = CATEGORIES.flatMap((c) => c.questions.map((q) => q.id))
    .sort((a, b) => a - b);

function encodeAnswers(answers) {
    const compact = ALL_IDS.map((id) => {
        const val = answers[id];
        return val !== undefined ? String(val) : "-";
    }).join("");
    return "v2:" + btoa(compact);
}

function decodeAnswers(code) {
    const trimmed = code.trim();
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
    try {
        const binary  = atob(trimmed);
        const bytes   = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const payload = new TextDecoder().decode(bytes);
        const parsed  = JSON.parse(payload);
        if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
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

async function exportAsPDF(answers, filename = "quiz-results.pdf", role = null) {
    const { jsPDF } = await import("jspdf");

    const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const PW     = 210;
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

    const labelColX = PW - margin - 40 - 30;

    addText("Quiz Results", 22, true, 15, 15, 15);
    y += 2;
    if (role) {
        addText(`Role: ${role.charAt(0).toUpperCase() + role.slice(1)}`, 10, false, 150, 110, 50);
        y += 2;
    }
    addText(`${Object.keys(answers).length} questions answered across ${CATEGORIES.length} categories`, 9, false, 120, 120, 120);
    y += 8;

    for (const cat of CATEGORIES) {
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

            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(40, 40, 40);
            const lines = doc.splitTextToSize(q.text, labelColX - margin - 4);
            doc.text(lines, margin, y);

            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            if (val !== null) {
                doc.setTextColor(150, 110, 50);
            } else {
                doc.setTextColor(160, 160, 160);
            }
            doc.text(label, labelColX + 24, y, { align: "right" });

            addBar(pct);
            y += lines.length * 4.2;

            // subtle centered separator line between questions
            y += 0.5;
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.15);
            doc.line(margin + 2, y, PW - margin - 2, y);
            y += 0.5;
        }
        y += 3;
    }

    // embed share code at the bottom of the PDF
    y += 6;
    if (y > 265) { doc.addPage(); y = margin; }
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, PW - margin, y);
    y += 5;
    addText("SHARE CODE", 8, true, 100, 100, 180);
    y += 2;
    addText("Use this code to import and edit these results on the site:", 7, false, 140, 140, 140);
    y += 2;
    const code = encodeAnswers(answers);
    doc.setFontSize(6);
    doc.setFont("courier", "normal");
    doc.setTextColor(80, 80, 80);
    const codeLines = doc.splitTextToSize(code, usable);
    codeLines.forEach((line) => {
        if (y > 285) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += 3;
    });

    doc.save(filename);
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function PreferenceQuiz() {
    const [role,          setRole]          = useState(null);   // "hypnotist" | "subject" | "switch"
    const [catIndex,      setCatIndex]      = useState(0);
    const [answers,       setAnswers]       = useState({});
    const [submitted,     setSubmitted]     = useState(false);
    const [exporting,     setExporting]     = useState(false);
    const [activeTooltip, setActiveTooltip] = useState(null);

    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importInput,     setImportInput]     = useState("");
    const [importError,     setImportError]     = useState("");
    const [copied,          setCopied]          = useState(false);

    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfName,      setPdfName]      = useState("");

    // compare states
    const [showCompareModal,   setShowCompareModal]   = useState(false);
    const [compareStep,        setCompareStep]        = useState(1);
    const [compareMyInput,     setCompareMyInput]     = useState("");
    const [compareTheirInput,  setCompareTheirInput]  = useState("");
    const [compareError,       setCompareError]       = useState("");
    const [compareView,        setCompareView]        = useState(false);
    const [compareMyAnswers,   setCompareMyAnswers]   = useState(null);
    const [compareTheirAnswers,setCompareTheirAnswers]= useState(null);
    const [openSections,       setOpenSections]       = useState({ 0: true, 1: false, 2: false, 3: false });
    const [helpVisible,        setHelpVisible]        = useState({});

    const bottomRef = useRef(null);

    const currentCategory    = CATEGORIES[catIndex];
    const isLastCategory     = catIndex === CATEGORIES.length - 1;
    const isFirstCategory    = catIndex === 0;

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

    const handleEditAnswers = () => {
        setCatIndex(0);
        setSubmitted(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const shareCode = encodeAnswers(answers);

    const handleCopy = () => {
        navigator.clipboard.writeText(shareCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleImport = (editMode = false) => {
        const decoded = decodeAnswers(importInput);
        if (!decoded) {
            setImportError("Invalid code — please check and try again.");
            return;
        }
        setAnswers(decoded);
        if (editMode) {
            setCatIndex(0);
            setSubmitted(false);
        } else {
            setSubmitted(true);
        }
        setShowImportModal(false);
        setImportInput("");
        setImportError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleExportPDF = () => {
        setPdfName("");
        setShowPdfModal(true);
    };

    const handleConfirmPDF = async () => {
        setShowPdfModal(false);
        setExporting(true);
        const slug     = pdfName.trim().replace(/\s+/g, "-");
        const filename = slug ? `quiz-result-${slug}.pdf` : "quiz-result.pdf";
        try { await exportAsPDF(answers, filename, role); }
        finally { setExporting(false); }
    };

    // ── COMPARE HANDLERS ────────────────────────────────────────────────────
    const handleOpenCompare = () => {
        setCompareStep(1);
        setCompareMyInput("");
        setCompareTheirInput("");
        setCompareError("");
        setShowCompareModal(true);
    };

    const handleCompareNext = () => {
        const decoded = decodeAnswers(compareMyInput);
        if (!decoded) {
            setCompareError("Invalid code — please check and try again.");
            return;
        }
        setCompareMyAnswers(decoded);
        setCompareError("");
        setCompareStep(2);
    };

    const handleCompareFinish = () => {
        const decoded = decodeAnswers(compareTheirInput);
        if (!decoded) {
            setCompareError("Invalid code — please check and try again.");
            return;
        }
        setCompareTheirAnswers(decoded);
        setShowCompareModal(false);
        setCompareError("");
        setOpenSections({ 0: true, 1: false, 2: false, 3: false });
        setHelpVisible({});
        setCompareView(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleCloseCompare = () => {
        setCompareView(false);
        setCompareMyAnswers(null);
        setCompareTheirAnswers(null);
    };

    const toggleSection = (i) =>
        setOpenSections((prev) => ({ ...prev, [i]: !prev[i] }));

    const toggleHelp = (i) =>
        setHelpVisible((prev) => ({ ...prev, [i]: !prev[i] }));

    const compareData = useMemo(() => {
        if (!compareMyAnswers || !compareTheirAnswers) return null;
        const allQs = CATEGORIES.flatMap((c) => c.questions);

        const bothLove = allQs.filter(
            (q) => compareMyAnswers[q.id] === 5 && compareTheirAnswers[q.id] === 5
        );
        const sharedInterest = allQs.filter((q) => {
            const my = compareMyAnswers[q.id];
            const their = compareTheirAnswers[q.id];
            return my >= 2 && my <= 4 && their >= 2 && their <= 4;
        });
        const theirCurious = allQs.filter((q) => compareTheirAnswers[q.id] === 1);
        const theirNo = allQs.filter((q) => compareTheirAnswers[q.id] === 0);

        return { bothLove, sharedInterest, theirCurious, theirNo };
    }, [compareMyAnswers, compareTheirAnswers]);

    const SECTIONS = [
        { title: "Both Love",               help: "Questions that both you and the other person answered as \"Love\" — your strongest shared interests." },
        { title: "Shared Interests",         help: "Questions where both of you answered Maybe, Okay, or Like (values 2–4) — things you're both moderately into." },
        { title: "They're Curious About",    help: "Questions the other person marked as \"Curious about\" — things they'd like to explore." },
        { title: "They Said No",             help: "Questions the other person answered \"No\" — their hard limits or disinterests." },
    ];

    const sectionItems = compareData
        ? [compareData.bothLove, compareData.sharedInterest, compareData.theirCurious, compareData.theirNo]
        : [[], [], [], []];

    const Topbar = () => (
        <div className="topbar">
            <button className="import-btn" onClick={() => setShowImportModal(true)}>
                ↑ Import results
            </button>
            <button className="compare-btn" onClick={handleOpenCompare}>
                ⇄ Compare
            </button>
            <a
                className="socials-btn"
                href="https://guns.lol/meltingg"
                target="_blank"
                rel="noreferrer"
            >
                ✦ Socials
            </a>
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

    // ── COMPARE MODAL (shared across all views) ─────────────────────────────
    const CompareModal = () => showCompareModal && (
        <div className="modal-overlay" onClick={() => setShowCompareModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                {compareStep === 1 ? (
                    <>
                        <h3 className="modal-title">Step 1: Your results</h3>
                        <p className="modal-sub">Paste your own share code below.</p>
                        <textarea
                            className="code-box"
                            value={compareMyInput}
                            onChange={(e) => { setCompareMyInput(e.target.value); setCompareError(""); }}
                            placeholder="Paste your code here…"
                        />
                        {compareError && <p className="import-error">{compareError}</p>}
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={handleCompareNext}>Next →</button>
                            <button className="action-btn" onClick={() => setShowCompareModal(false)}>Cancel</button>
                        </div>
                    </>
                ) : (
                    <>
                        <h3 className="modal-title">Step 2: Their results</h3>
                        <p className="modal-sub">Now paste the other person's share code.</p>
                        <textarea
                            className="code-box"
                            value={compareTheirInput}
                            onChange={(e) => { setCompareTheirInput(e.target.value); setCompareError(""); }}
                            placeholder="Paste their code here…"
                        />
                        {compareError && <p className="import-error">{compareError}</p>}
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={handleCompareFinish}>Compare</button>
                            <button className="action-btn" onClick={() => { setCompareStep(1); setCompareError(""); }}>← Back</button>
                            <button className="action-btn" onClick={() => setShowCompareModal(false)}>Cancel</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    // ── COMPARE VIEW ──────────────────────────────────────────────────────────
    if (compareView && compareData) {
        return (
            <div className="quiz-wrapper">
                <Topbar />
                <div className="results">
                    <div className="results-header">
                        <p className="results-eyebrow">Comparison</p>
                        <h2 className="results-title">Your Compatibility</h2>
                        <p className="results-sub">See what you have in common</p>
                    </div>

                    {SECTIONS.map((sec, i) => (
                        <div key={i} className="compare-section">
                            <div className="compare-section-header" onClick={() => toggleSection(i)}>
                                <span className={`compare-arrow${openSections[i] ? " open" : ""}`}>›</span>
                                <span className="compare-section-title">{sec.title}</span>
                                <span className="compare-count">{sectionItems[i].length}</span>
                                <button
                                    className="compare-help-btn"
                                    onClick={(e) => { e.stopPropagation(); toggleHelp(i); }}
                                >?</button>
                            </div>
                            {helpVisible[i] && (
                                <p className="compare-help-text">{sec.help}</p>
                            )}
                            {openSections[i] && (
                                <div className="compare-section-body">
                                    {sectionItems[i].length === 0 ? (
                                        <p className="compare-empty">No matching questions.</p>
                                    ) : (
                                        sectionItems[i].map((q) => (
                                            <p key={q.id} className="compare-item">{q.text}</p>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    <div className="results-actions">
                        <button className="action-btn" onClick={handleCloseCompare}>
                            ← Back
                        </button>
                    </div>
                </div>
                <CompareModal />
            </div>
        );
    }

    // ── ROLE SELECTOR ────────────────────────────────────────────────────────
    if (!role) {
        return (
            <div className="quiz-wrapper">
                <div className="role-selector">
                    <h1 className="role-title">Welcome</h1>
                    <p className="role-subtitle">What best describes you?</p>
                    <div className="role-options">
                        <button className="role-btn" onClick={() => setRole("hypnotist")}>
                            <span className="role-icon">✦</span>
                            <span className="role-name">Hypnotist</span>
                            <span className="role-desc">I guide others into trance</span>
                        </button>
                        <button className="role-btn" onClick={() => setRole("subject")}>
                            <span className="role-icon">◯</span>
                            <span className="role-name">Subject</span>
                            <span className="role-desc">I enjoy being hypnotized</span>
                        </button>
                        <button className="role-btn" onClick={() => setRole("switch")}>
                            <span className="role-icon">⇄</span>
                            <span className="role-name">Hypnoswitch</span>
                            <span className="role-desc">I enjoy both roles</span>
                        </button>
                    </div>

                    <div className="update-log">
                        <h3 className="update-log-title">Update Log</h3>
                        <div className="update-log-scroll">
                            <div className="update-entry">
                                <span className="update-date">v6 — Mar 15</span>
                                <ul className="update-list">
                                    <li>Topbar buttons now evenly spaced</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v5 — Mar 15</span>
                                <ul className="update-list">
                                    <li>Compare feature — import two share codes and see what you have in common</li>
                                    <li>4 dropdown sections: Both Love, Shared Interests, They're Curious About, They Said No</li>
                                    <li>Help buttons on each comparison dropdown explaining what it shows</li>
                                    <li>Fixed PDF separator lines — no longer push answers to the next page</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v4 — Mar 14</span>
                                <ul className="update-list">
                                    <li>Role selector on load — choose Hypnotist, Subject, or Hypnoswitch</li>
                                    <li>"Curious about" button now looks different (dashed purple border) and appears last</li>
                                    <li>PDF now has subtle lines between questions for readability</li>
                                    <li>Import &amp; Edit — import a share code and go back to the quiz to change answers</li>
                                    <li>Edit answers button on the results page</li>
                                    <li>Share code is now embedded at the bottom of exported PDFs</li>
                                    <li>Your selected role is printed on the PDF</li>
                                    <li>Removed "Diapering" and "Watersports" from suggestions</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v3</span>
                                <ul className="update-list">
                                    <li>You can name the PDF file (e.g. quiz-result-Alice.pdf)</li>
                                    <li>Added Socials button linking to guns.lol/meltingg</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v2</span>
                                <ul className="update-list">
                                    <li>Exported share codes are now much shorter (compact encoding)</li>
                                    <li>Backward compatibility — old share codes still work</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v1</span>
                                <ul className="update-list">
                                    <li>Fixed mobile layout</li>
                                    <li>Added skip question / category — all questions are optional</li>
                                    <li>Removed print-as-PNG (bad quality)</li>
                                    <li>Added code importing and exporting</li>
                                    <li>Fixed PDF export — no longer takes lots of space</li>
                                    <li>Added Ko-fi support button</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── QUIZ VIEW ─────────────────────────────────────────────────────────────
    if (!submitted) {
        const progressPct = answeredInCurrent / currentCategory.questions.length * 100;

        return (
            <div className="quiz-wrapper">
                <Topbar />

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

                <header className="quiz-header">
                    <p className="quiz-category-label">
                        Category {catIndex + 1} of {CATEGORIES.length}
                    </p>
                    <h1 className="quiz-title">{currentCategory.title}</h1>
                    <p className="quiz-subtitle">{currentCategory.description}</p>
                </header>

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
                                    className={`scale-btn${answers[q.id] === opt.value ? " selected" : ""}${opt.value === 1 ? " curious" : ""}`}
                                    onClick={() => pick(q.id, opt.value)}
                                >
                                    <span className="dot" />
                                    <span className="scale-label">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

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

                {showImportModal && (
                    <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <h3 className="modal-title">Import results</h3>
                            <p className="modal-sub">Paste a share code below to view or edit results.</p>
                            <textarea
                                className="code-box"
                                value={importInput}
                                onChange={(e) => { setImportInput(e.target.value); setImportError(""); }}
                                placeholder="Paste code here…"
                            />
                            {importError && <p className="import-error">{importError}</p>}
                            <div className="modal-actions">
                                <button className="action-btn primary" onClick={() => handleImport(false)}>Load results</button>
                                <button className="action-btn primary" onClick={() => handleImport(true)}>Import &amp; Edit</button>
                                <button className="action-btn" onClick={() => { setShowImportModal(false); setImportError(""); }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
                <CompareModal />
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

                    <button className="action-btn primary" onClick={handleEditAnswers}>
                        ✎ Edit answers
                    </button>

                    <button className="action-btn" onClick={handleRetake}>
                        ← Retake quiz
                    </button>
                </div>
            </div>

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

            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Import results</h3>
                        <p className="modal-sub">Paste a share code below to view or edit results.</p>
                        <textarea
                            className="code-box"
                            value={importInput}
                            onChange={(e) => { setImportInput(e.target.value); setImportError(""); }}
                            placeholder="Paste code here…"
                        />
                        {importError && <p className="import-error">{importError}</p>}
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={() => handleImport(false)}>Load results</button>
                            <button className="action-btn primary" onClick={() => handleImport(true)}>Import &amp; Edit</button>
                            <button className="action-btn" onClick={() => { setShowImportModal(false); setImportError(""); }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

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
            <CompareModal />
        </div>
    );
}
