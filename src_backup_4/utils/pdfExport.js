import { CATEGORIES as CATEGORIES_DEFAULT } from "../questions/questions.js";
import { CATEGORIES as CATEGORIES_TIST } from "../questions/questionsTist.js";
import { labelOf, pctOf } from "./helpers.js";
import { encodeAnswers } from "./shareCode.js";

export async function exportAsPDF(answers, filename = "quiz-results.pdf", role = null, categories = CATEGORIES_DEFAULT, tistAnswers = null) {
    const { jsPDF } = await import("jspdf");

    // build tist question text lookup for switch mode
    const tistQText = {};
    if (tistAnswers) {
        CATEGORIES_TIST.flatMap((c) => c.questions).forEach((q) => {
            tistQText[q.id] = q.text;
        });
    }

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

    const addBar = (pct, tist = false) => {
        const barW  = 40;
        const barH  = tist ? 2 : 2.5;
        const barX  = PW - margin - barW;
        if (y > 280) { doc.addPage(); y = margin; }
        doc.setFillColor(220, 220, 220);
        doc.roundedRect(barX, y - 2.5, barW, barH, 1, 1, "F");
        if (pct > 0) {
            if (tist) {
                doc.setFillColor(150, 130, 200);
            } else {
                doc.setFillColor(201, 169, 110);
            }
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
    addText(`${Object.keys(answers).length} questions answered across ${categories.length} categories`, 9, false, 120, 120, 120);
    y += 8;

    for (const cat of categories) {
        if (y > 265) { doc.addPage(); y = margin; }
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, PW - margin, y);
        y += 5;
        addText(cat.title.toUpperCase(), 9, true, 100, 100, 180);
        y += 3;

        for (let qi = 0; qi < cat.questions.length; qi++) {
            const q = cat.questions[qi];
            if (y > 278) { doc.addPage(); y = margin; }
            const val   = answers[q.id] !== undefined ? answers[q.id] : null;
            const label = val !== null ? labelOf(val) : "Skipped";
            const pct   = val !== null ? pctOf(val) : 0;

            const rowH = 5.2;
            if (qi % 2 === 1) {
                doc.setFillColor(245, 245, 245);
                doc.rect(margin - 2, y - 3.5, usable + 4, rowH, "F");
            }

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
            y += lines.length * 4.2 + 1;

            // switch mode: show tist answer if it differs
            if (tistAnswers && val !== null) {
                const tistVal = tistAnswers[q.id] !== undefined ? tistAnswers[q.id] : val;
                if (tistVal !== val) {
                    if (y > 280) { doc.addPage(); y = margin; }
                    const tistLabel = labelOf(tistVal);
                    const tistPct   = pctOf(tistVal);
                    const tistText  = tistQText[q.id] || q.text;

                    doc.setFontSize(7);
                    doc.setFont("helvetica", "italic");
                    doc.setTextColor(130, 115, 170);
                    const tLines = doc.splitTextToSize(`\u21C4 ${tistText}`, labelColX - margin - 12);
                    doc.text(tLines[0] || tistText, margin + 8, y);

                    doc.setFontSize(7);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(130, 115, 170);
                    doc.text(tistLabel, labelColX + 24, y, { align: "right" });

                    addBar(tistPct, true);
                    y += 4;
                }
            }
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
    const code = encodeAnswers(answers, tistAnswers);
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
