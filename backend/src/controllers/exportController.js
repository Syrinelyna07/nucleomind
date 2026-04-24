/**
 * exportController.js
 *
 * Provides three endpoints:
 *   GET /api/organizer/export/stats/pdf          → PDF dashboard report
 *   GET /api/organizer/export/interactions/csv   → filtered interactions CSV
 *   GET /api/organizer/export/problems/csv       → problems + solutions CSV
 *
 * Dependencies:
 *   npm install pdfkit
 */

import PDFDocument from 'pdfkit';
import pool from '../config/dbConfig.js';

// ─────────────────────────────────────────────
// Colour palette (matches the dashboard UI)
// ─────────────────────────────────────────────
const COLORS = {
    navy:       '#1B2A4A',
    blue:       '#2563EB',
    teal:       '#0D9488',
    green:      '#16A34A',
    red:        '#DC2626',
    orange:     '#EA580C',
    yellow:     '#D97706',
    gray:       '#6B7280',
    lightGray:  '#F3F4F6',
    white:      '#FFFFFF',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Escape a value for CSV output */
function csvCell(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/** Build a CSV string from an array of row-objects and a column spec */
function buildCSV(rows, columns) {
    const header = columns.map(c => csvCell(c.label)).join(',');
    const body = rows.map(row =>
        columns.map(c => csvCell(row[c.key])).join(',')
    );
    return [header, ...body].join('\r\n');
}

/** Draw a filled rounded rectangle (PDFKit helper) */
function roundRect(doc, x, y, w, h, r, fillColor) {
    doc.roundedRect(x, y, w, h, r).fill(fillColor);
}

/** Draw a horizontal divider */
function divider(doc, y, color = COLORS.lightGray) {
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).stroke(color);
}

/** Stat card: box + big number + label */
function statCard(doc, x, y, w, h, label, value, unit = '', color = COLORS.blue) {
    roundRect(doc, x, y, w, h, 8, COLORS.lightGray);
    doc.rect(x, y, 4, h).fill(color);               // left accent bar

    doc.fillColor(color).fontSize(22).font('Helvetica-Bold')
       .text(`${value}${unit}`, x + 16, y + 12, { width: w - 20 });

    doc.fillColor(COLORS.gray).fontSize(9).font('Helvetica')
       .text(label, x + 16, y + 38, { width: w - 20 });
}

/** Section header */
function sectionHeader(doc, y, title) {
    doc.fillColor(COLORS.navy).fontSize(13).font('Helvetica-Bold')
       .text(title, 40, y);
    doc.moveTo(40, y + 18).lineTo(doc.page.width - 40, y + 18)
       .lineWidth(1.5).stroke(COLORS.blue);
    return y + 26;
}

/** Simple table (array of arrays) */
function drawTable(doc, startY, headers, rows, colWidths) {
    const rowH    = 22;
    const margin  = 40;
    let   y       = startY;
    const totalW  = colWidths.reduce((a, b) => a + b, 0);

    // Header row
    roundRect(doc, margin, y, totalW, rowH, 4, COLORS.navy);
    let cx = margin + 6;
    headers.forEach((h, i) => {
        doc.fillColor(COLORS.white).fontSize(8.5).font('Helvetica-Bold')
           .text(h, cx, y + 6, { width: colWidths[i] - 8, ellipsis: true });
        cx += colWidths[i];
    });
    y += rowH;

    // Data rows
    rows.forEach((row, ri) => {
        const bg = ri % 2 === 0 ? COLORS.white : COLORS.lightGray;
        doc.rect(margin, y, totalW, rowH).fill(bg);

        // thin border
        doc.rect(margin, y, totalW, rowH).lineWidth(0.3).stroke('#D1D5DB');

        cx = margin + 6;
        row.forEach((cell, ci) => {
            doc.fillColor(COLORS.navy).fontSize(8).font('Helvetica')
               .text(String(cell ?? ''), cx, y + 6, { width: colWidths[ci] - 8, ellipsis: true });
            cx += colWidths[ci];
        });
        y += rowH;

        // Page-break guard
        if (y > doc.page.height - 80) {
            doc.addPage();
            y = 60;
        }
    });

    return y;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PDF — General statistics report
// ─────────────────────────────────────────────────────────────────────────────
export const exportStatsPDF = async (req, res) => {
    try {
        // ── Fetch raw data ──────────────────────────────────────────────────
        const { startDate, endDate } = req.query;

        const [interactions] = await pool.execute(`SELECT * FROM interactions`);
        const [posts]        = await pool.execute(`SELECT * FROM posts`);
        const [keywords]     = await pool.execute(`SELECT keyword FROM keywords`);

        const total      = interactions.length;
        let positive     = 0, negative = 0, neutral = 0;
        let urgentCount  = 0;
        const sourceStats = { public_comment: 0, private_comment: 0, private_dm: 0 };
        const filteredByDate = [];
        const emotionMap = {};

        for (const i of interactions) {
            const sentiment = (i.sentiment_label || '').toLowerCase();
            if (sentiment === 'positive')       positive++;
            else if (sentiment === 'negative')  negative++;
            else                                neutral++;

            if (i.is_urgent === 1 || i.is_urgent === true) urgentCount++;

            if (sourceStats[i.source_type] !== undefined) sourceStats[i.source_type]++;

            const emotion = i.emotion_label || 'Unknown';
            emotionMap[emotion] = (emotionMap[emotion] || 0) + 1;

            if (startDate && endDate) {
                const d = new Date(i.created_at);
                if (new Date(startDate) <= d && d <= new Date(endDate)) filteredByDate.push(i);
            }
        }

        const urgencyRate    = total ? ((urgentCount / total) * 100).toFixed(1) : '0.0';
        const positiveRate   = total ? ((positive / total) * 100).toFixed(1) : '0.0';
        const negativeRate   = total ? ((negative / total) * 100).toFixed(1) : '0.0';
        const neutralRate    = total ? ((neutral / total) * 100).toFixed(1) : '0.0';

        // Top 5 keywords
        const [kwRows] = await pool.execute(`
            SELECT k.keyword, COUNT(ik.interactionId) AS cnt
            FROM keywords k
            JOIN interaction_keywords ik ON ik.keywordId = k.id
            GROUP BY k.id, k.keyword
            ORDER BY cnt DESC
            LIMIT 5
        `);

        // Urgent list (last 10)
        const urgentList = interactions
            .filter(i => i.is_urgent === 1 || i.is_urgent === true)
            .slice(0, 10);

        // ── Build PDF ───────────────────────────────────────────────────────
        const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition',
            `attachment; filename="canbebe-stats-${new Date().toISOString().slice(0,10)}.pdf"`);
        doc.pipe(res);

        const pageW = doc.page.width;   // 595
        const now   = new Date().toLocaleString('fr-DZ', { timeZone: 'Africa/Algiers' });

        // ── HEADER BANNER ───────────────────────────────────────────────────
        roundRect(doc, 0, 0, pageW, 75, 0, COLORS.navy);
        doc.fillColor(COLORS.white).fontSize(22).font('Helvetica-Bold')
           .text('CANBÉBÉ', 40, 18);
        doc.fillColor('#93C5FD').fontSize(9).font('Helvetica')
           .text('SENTIMENT INTELLIGENCE — Rapport Statistique', 40, 44);
        doc.fillColor(COLORS.white).fontSize(8)
           .text(`Généré le : ${now}`, pageW - 220, 30, { width: 180, align: 'right' });
        if (startDate && endDate) {
            doc.text(`Période : ${startDate} → ${endDate}`, pageW - 220, 44, { width: 180, align: 'right' });
        }

        let y = 95;

        // ── OVERVIEW STAT CARDS ─────────────────────────────────────────────
        y = sectionHeader(doc, y, 'Vue d\'ensemble');
        y += 6;

        const cardW = (pageW - 80 - 30) / 4;   // 4 cards in a row, 10px gap each
        const cardH = 60;
        const gap   = 10;

        statCard(doc, 40,                 y, cardW, cardH, 'Interactions totales',  total,        '',  COLORS.blue);
        statCard(doc, 40 + cardW + gap,   y, cardW, cardH, 'Taux d\'urgence',       urgencyRate,  '%', COLORS.red);
        statCard(doc, 40 + (cardW+gap)*2, y, cardW, cardH, 'Interactions filtrées', startDate ? filteredByDate.length : '—', '', COLORS.teal);
        statCard(doc, 40 + (cardW+gap)*3, y, cardW, cardH, 'Posts analysés',        posts.length, '',  COLORS.orange);
        y += cardH + 20;

        // ── SENTIMENT ───────────────────────────────────────────────────────
        y = sectionHeader(doc, y, 'Analyse du Sentiment');
        y += 8;

        // Horizontal bar chart (manual)
        const bars = [
            { label: 'Positif',  value: positive, rate: positiveRate, color: COLORS.green  },
            { label: 'Négatif',  value: negative, rate: negativeRate, color: COLORS.red    },
            { label: 'Neutre',   value: neutral,  rate: neutralRate,  color: COLORS.gray   },
        ];
        const barMaxW = pageW - 40 - 130 - 60;   // available bar width

        bars.forEach(bar => {
            doc.fillColor(COLORS.navy).fontSize(9).font('Helvetica-Bold').text(bar.label, 40, y + 3, { width: 60 });
            const bw = Math.max((bar.value / (total || 1)) * barMaxW, 4);
            roundRect(doc, 105, y, bw, 16, 4, bar.color);
            doc.fillColor(bar.color).fontSize(9).font('Helvetica')
               .text(`${bar.value}  (${bar.rate}%)`, 105 + bw + 8, y + 2);
            y += 26;
        });

        y += 10;

        // ── SOURCE DISTRIBUTION ─────────────────────────────────────────────
        y = sectionHeader(doc, y, 'Distribution par Source');
        y += 8;

        const sourceLabels = {
            public_comment:  { label: 'Commentaires publics',  color: COLORS.blue   },
            private_comment: { label: 'Commentaires privés',   color: COLORS.teal   },
            private_dm:      { label: 'Messages directs',      color: COLORS.orange },
        };

        Object.entries(sourceStats).forEach(([key, count]) => {
            const { label, color } = sourceLabels[key];
            doc.fillColor(COLORS.navy).fontSize(9).font('Helvetica-Bold').text(label, 40, y + 3, { width: 140 });
            const bw = Math.max((count / (total || 1)) * barMaxW, 4);
            roundRect(doc, 185, y, bw, 16, 4, color);
            doc.fillColor(color).fontSize(9).font('Helvetica')
               .text(`${count}  (${total ? ((count / total) * 100).toFixed(1) : 0}%)`, 185 + bw + 8, y + 2);
            y += 26;
        });

        y += 10;

        // ── TOP KEYWORDS ────────────────────────────────────────────────────
        if (kwRows.length) {
            y = sectionHeader(doc, y, 'Top Catégories / Mots-clés');
            y += 8;

            const kwHeaders = ['Mot-clé', 'Occurrences', 'Part (%)'];
            const kwData    = kwRows.map(k => [
                k.keyword,
                k.cnt,
                total ? ((k.cnt / total) * 100).toFixed(1) + '%' : '0%'
            ]);
            y = drawTable(doc, y, kwHeaders, kwData, [280, 120, 115]);
            y += 16;
        }

        // ── URGENT INTERACTIONS ─────────────────────────────────────────────
        if (urgentList.length) {
            if (y > doc.page.height - 140) { doc.addPage(); y = 60; }

            y = sectionHeader(doc, y, `Interactions Urgentes (${urgentCount} au total)`);
            y += 8;

            const uHeaders = ['Auteur', 'Sentiment', 'Source', 'Raison d\'urgence'];
            const uData    = urgentList.map(i => [
                i.author_username || '—',
                i.sentiment_label || '—',
                i.source_type     || '—',
                (i.urgency_reason || '—').slice(0, 60),
            ]);
            y = drawTable(doc, y, uHeaders, uData, [110, 80, 110, 215]);
            y += 16;
        }

        // ── FOOTER on every page ────────────────────────────────────────────
        const totalPages = doc.bufferedPageRange().count;
        for (let p = 0; p < totalPages; p++) {
            doc.switchToPage(p);
            divider(doc, doc.page.height - 38, '#D1D5DB');
            doc.fillColor(COLORS.gray).fontSize(7.5)
               .text(`CanBébé Sentiment Intelligence  ·  Page ${p + 1} / ${totalPages}`,
                     40, doc.page.height - 28, { align: 'center', width: pageW - 80 });
        }

        doc.end();

    } catch (error) {
        console.error('exportStatsPDF error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. CSV — Interactions (with optional filters)
//
// Query params:
//   status        = 'traited' | 'not_traited'
//   source_type   = 'public_comment' | 'private_comment' | 'private_dm'
//   is_urgent     = 'true' | 'false'
//   startDate     = 'YYYY-MM-DD'
//   endDate       = 'YYYY-MM-DD'
//   sentiment     = 'positive' | 'negative' | 'neutral'
// ─────────────────────────────────────────────────────────────────────────────
export const exportInteractionsCSV = async (req, res) => {
    try {
        const { status, source_type, is_urgent, startDate, endDate, sentiment } = req.query;

        // Build dynamic WHERE clause
        const conditions = [];
        const params     = [];

        if (status)      { conditions.push(`status = ?`);          params.push(status); }
        if (source_type) { conditions.push(`source_type = ?`);     params.push(source_type); }
        if (sentiment)   { conditions.push(`sentiment_label = ?`); params.push(sentiment); }
        if (is_urgent !== undefined && is_urgent !== '') {
            conditions.push(`is_urgent = ?`);
            params.push(is_urgent === 'true' || is_urgent === '1' ? 1 : 0);
        }
        if (startDate)   { conditions.push(`created_at >= ?`);     params.push(startDate); }
        if (endDate)     { conditions.push(`created_at <= ?`);     params.push(endDate + ' 23:59:59'); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const [rows] = await pool.execute(`SELECT * FROM interactions ${where} ORDER BY created_at DESC`, params);

        const columns = [
            { key: 'id',              label: 'ID' },
            { key: 'author_username', label: 'Auteur' },
            { key: 'source_type',     label: 'Source' },
            { key: 'sentiment_label', label: 'Sentiment' },
            { key: 'emotion_label',   label: 'Émotion' },
            { key: 'content_text',    label: 'Contenu' },
            { key: 'status',          label: 'Statut' },
            { key: 'is_urgent',       label: 'Urgent' },
            { key: 'urgency_reason',  label: 'Raison urgence' },
            { key: 'suggested_reply', label: 'Réponse suggérée' },
            { key: 'description',     label: 'Problèmes' },
            { key: 'content_lg',      label: 'Langue' },
            { key: 'created_at',      label: 'Date' },
        ];

        const csv = buildCSV(rows, columns);

        const filename = `interactions-${new Date().toISOString().slice(0,10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csv);   // BOM for Excel UTF-8

    } catch (error) {
        console.error('exportInteractionsCSV error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. CSV — Problems + solutions
// ─────────────────────────────────────────────────────────────────────────────
export const exportProblemsCSV = async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                p.id            AS problem_id,
                p.problem_summary,
                p.createdAt     AS problem_created_at,
                s.id            AS solution_id,
                s.solution,
                s.solution_summary,
                k.keyword,
                COUNT(DISTINCT ip.interactionId) AS interaction_count
            FROM problems p
            LEFT JOIN problem_solution  ps ON ps.problemId  = p.id
            LEFT JOIN solutions         s  ON s.id          = ps.solutionId
            LEFT JOIN interaction_problems ip ON ip.problemId = p.id
            LEFT JOIN interactions       i  ON i.id         = ip.interactionId
            LEFT JOIN interaction_keywords ik ON ik.interactionId = i.id
            LEFT JOIN keywords           k  ON k.id         = ik.keywordId
            GROUP BY p.id, s.id, k.id
            ORDER BY p.id
        `);

        const columns = [
            { key: 'problem_id',         label: 'ID Problème' },
            { key: 'problem_summary',    label: 'Problème' },
            { key: 'problem_created_at', label: 'Date création' },
            { key: 'interaction_count',  label: 'Nb interactions liées' },
            { key: 'keyword',            label: 'Catégorie' },
            { key: 'solution_id',        label: 'ID Solution' },
            { key: 'solution',           label: 'Solution' },
            { key: 'solution_summary',   label: 'Résumé solution' },
        ];

        const csv = buildCSV(rows, columns);

        const filename = `problems-solutions-${new Date().toISOString().slice(0,10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csv);

    } catch (error) {
        console.error('exportProblemsCSV error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

export default { exportStatsPDF, exportInteractionsCSV, exportProblemsCSV };