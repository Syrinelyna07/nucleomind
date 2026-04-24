import fs from 'fs';
import csv from 'csv-parser';
import pool from '../config/dbConfig.js';
import Interaction from '../models/Interaction.js';
import Post from '../models/Post.js';
import Problem from '../models/Problem.js';
import { sendUrgentEmail } from "../services/emailService.js";

const STATUS_MAP = {
    'non-treated': 'not_traited',
    non_treated: 'not_traited',
    not_traited: 'not_traited',
    treated: 'traited',
    traited: 'traited'
};

const SENTIMENT_MAP = {
    positif: 'positive',
    positive: 'positive',
    negatif: 'negative',
    negative: 'negative',
    neutre: 'neutral',
    neutral: 'neutral'
};

const splitMultiValue = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value !== 'string') {
        return [];
    }
    return value
        .split(/\s*\|\s*|\s*;\s*/)
        .map((item) => item.trim())
        .filter(Boolean);
};

const parseBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value !== 'string') return false;
    return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
};

const normalizeStatus = (value) => {
    if (!value) return 'not_traited';
    return STATUS_MAP[String(value).trim().toLowerCase()] || 'not_traited';
};

const normalizeSentiment = (value) => {
    if (!value) return 'neutral';
    return SENTIMENT_MAP[String(value).trim().toLowerCase()] || 'neutral';
};

const toNullable = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
    }
    return value;
};

const normalizeRow = (row) => {
    const problemLabels = splitMultiValue(row.problem_labels);
    const recommendedSolutions = splitMultiValue(row.recommended_solution);
    const isUrgent = parseBoolean(row.is_urgent);

    return {
        status: normalizeStatus(row.status),
        description: toNullable(row.problem_summary) || problemLabels.join(' | ') || null,
        source_type: toNullable(row.source_type),
        author_username: toNullable(row.author_username),
        content_text: toNullable(row.content_text),
        sentiment_label: normalizeSentiment(row.sentiment_label),
        emotion_label: toNullable(row.emotion_label),
        suggested_reply: toNullable(row.suggested_reply),
        urgency_reason: toNullable(row.urgency_reason),
        is_urgent: isUrgent,
        content_lg: toNullable(row.content_language),
        created_at: toNullable(row.created_at),
        comment_link: toNullable(row.comment_link),
        post_link: toNullable(row.post_link),
        post_description: toNullable(row.post_description),
        nb_comments: toNullable(row.nb_comments),
        category_labels: toNullable(row.category_labels),
        problem_labels: problemLabels,
        recommended_solution: recommendedSolutions
    };
};

const sendUrgentNotification = async (row) => {
    if (!row.is_urgent) return;

    try {
        await sendUrgentEmail("admin@gmail.com", {
            author: row.author_username,
            content: row.content_text,
            sentiment: row.sentiment_label,
            reason: row.urgency_reason,
            reply: row.suggested_reply,
            link: row.comment_link || row.post_link || null
        });
        console.log("Urgent email sent");
    } catch (emailErr) {
        console.error("Email failed:", emailErr.message);
    }
};

const attachKeyword = async (interactionId, keyword) => {
    if (!keyword) return;

    const [result] = await pool.execute(
        `INSERT INTO keywords (keyword) VALUES (?)`,
        [keyword]
    );
    await pool.execute(
        `INSERT INTO interaction_keywords (interactionId, keywordId) VALUES (?, ?)`,
        [interactionId, result.insertId]
    );
};

const attachPost = async (interactionId, row) => {
    if (!row.post_link) return null;

    const postId = await Post.create({
        post_description: row.post_description,
        nbComments: row.nb_comments,
        post_link: row.post_link
    });

    if (postId) {
        await Interaction.linkInteractionPost(interactionId, postId);
    }

    return postId;
};

const attachProblemsAndSolutions = async (interactionId, row) => {
    const problemIds = [];
    const solutionIds = [];

    for (let i = 0; i < row.problem_labels.length; i++) {
        const problemId = await Problem.create({
            problem_summary: row.problem_labels[i]
        });
        await Interaction.linkInteractionProblem(interactionId, problemId);
        problemIds.push(problemId);

        if (row.recommended_solution[i]) {
            const solutionId = await Problem.createSolution({
                solution: row.recommended_solution[i],
                solution_summary: row.urgency_reason || null
            });
            await Problem.createProblemSolution(problemId, solutionId);
            solutionIds.push(solutionId);
        }
    }

    return { problemIds, solutionIds };
};

const ingestSingleRow = async (rawRow) => {
    const row = normalizeRow(rawRow);

    const interactionId = await Interaction.create({
        status: row.status,
        description: row.description,
        source_type: row.source_type,
        author_username: row.author_username,
        content_text: row.content_text,
        sentiment_label: row.sentiment_label,
        emotion_label: row.emotion_label,
        suggested_reply: row.suggested_reply,
        urgency_reason: row.urgency_reason,
        is_urgent: row.is_urgent,
        content_lg: row.content_lg,
        created_at: row.created_at
    });

    await sendUrgentNotification(row);
    const postId = await attachPost(interactionId, row);
    const { problemIds, solutionIds } = await attachProblemsAndSolutions(interactionId, row);
    await attachKeyword(interactionId, row.category_labels);

    return {
        external_id: rawRow.id || null,
        interaction_id: interactionId,
        post_id: postId,
        problem_ids: problemIds,
        solution_ids: solutionIds,
        status: 'inserted'
    };
};

const ingestRows = async (rows) => {
    const seenIds = new Set();
    const results = [];
    let imported = 0;
    let failed = 0;

    for (const rawRow of rows) {
        const externalId = rawRow?.id ? String(rawRow.id).trim() : null;
        if (externalId && seenIds.has(externalId)) {
            continue;
        }
        if (externalId) {
            seenIds.add(externalId);
        }

        try {
            results.push(await ingestSingleRow(rawRow));
            imported++;
        } catch (err) {
            console.error(`Row error (${rawRow?.author_username || 'unknown'}):`, err.message);
            failed++;
        }
    }

    return {
        total: rows.length,
        imported,
        failed,
        results
    };
};

const importCSV = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const rows = [];

    try {
        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => rows.push(data))
            .on('end', async () => {
                try {
                    const summary = await ingestRows(rows);
                    res.json({
                        message: "CSV import complete",
                        ...summary
                    });
                } catch (err) {
                    console.error("Stream end error:", err.message);
                    res.status(500).json({ error: err.message });
                }
            })
            .on('error', (err) => {
                console.error("Stream error:", err.message);
                res.status(500).json({ error: err.message });
            });
    } catch (error) {
        console.error("Top level error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

const ingestBatchJson = async (req, res) => {
    try {
        const items = Array.isArray(req.body)
            ? req.body
            : Array.isArray(req.body?.items)
                ? req.body.items
                : null;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: "No JSON items provided" });
        }

        const summary = await ingestRows(items);
        return res.json({
            success: true,
            processed_count: summary.imported,
            failed_count: summary.failed,
            results: summary.results
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

const generalStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const [interactions] = await pool.execute(`SELECT * FROM interactions`);

        const total = interactions.length;

        let positive = 0;
        let negative = 0;
        let neutral = 0;
        let urgentCount = 0;

        const sourceStats = {
            public_comment: 0,
            private_comment: 0,
            private_dm: 0
        };

        const urgentInteractions = [];
        const publicComments = [];
        const privateComments = [];
        const privateDMs = [];
        const filteredByDate = [];
        const nonTraitedCommentsPublic = [];
        const nonTraitedCommentsPrivate = [];
        const nonTraitedChat = [];

        for (const i of interactions) {
            const sentiment = (i.sentiment_label || '').toLowerCase();

            if (sentiment === 'positive') positive++;
            else if (sentiment === 'negative') negative++;
            else neutral++;

            if (i.source_type === 'public_comment') {
                sourceStats.public_comment++;
                publicComments.push(i);
                if (i.status === 'not_traited') nonTraitedCommentsPublic.push(i);
            }

            if (i.source_type === 'private_comment') {
                sourceStats.private_comment++;
                privateComments.push(i);
                if (i.status === 'not_traited') nonTraitedCommentsPrivate.push(i);
            }

            if (i.source_type === 'private_dm') {
                sourceStats.private_dm++;
                privateDMs.push(i);
                if (i.status === 'not_traited') nonTraitedChat.push(i);
            }
            if (i.is_urgent === 1 || i.is_urgent === true) {
                urgentCount++;
                urgentInteractions.push(i);
            }

            if (startDate && endDate) {
                const createdAt = new Date(i.created_at);

                if (
                    new Date(startDate) <= createdAt &&
                    createdAt <= new Date(endDate)
                ) {
                    filteredByDate.push(i);
                }
            }
        }

        return res.json({
            success: true,
            overview: {
                totalInteractions: total,
                filteredInteractions: filteredByDate.length,
                urgencyRate: total ? (urgentCount / total) * 100 : 0
            },
            sentiment: {
                positive,
                negative,
                neutral,
                positiveRate: total ? (positive / total) * 100 : 0,
                negativeRate: total ? (negative / total) * 100 : 0
            },
            sourceDistribution: sourceStats,
            lists: {
                urgentInteractions,
                publicComments,
                privateComments,
                privateDMs,
                filteredByDate,
                nonTraitedChat ,
                nonTraitedCommentsPrivate,
                nonTraitedCommentsPublic
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

const ProblemSolutionData = async (req, res) => {
    try {
        const [keywords] = await pool.execute(`
            SELECT id, keyword FROM keywords
        `);

        const result = [];

        for (const keyword of keywords) {
            const [rows] = await pool.execute(`
                SELECT 
                    k.keyword,
                    p.id AS problemId,
                    p.problem_summary,
                    s.id AS solutionId,
                    s.solution,
                    s.solution_summary
                FROM keywords k
                JOIN interaction_keywords ik ON ik.keywordId = k.id
                JOIN interactions i ON i.id = ik.interactionId
                JOIN interaction_problems ip ON ip.interactionId = i.id
                JOIN problems p ON p.id = ip.problemId
                LEFT JOIN problem_solution ps ON ps.problemId = p.id
                LEFT JOIN solutions s ON s.id = ps.solutionId
                WHERE k.id = ?
            `, [keyword.id]);

            const grouped = {
                keyword: keyword.keyword,
                problems: []
            };

            const map = new Map();

            for (const row of rows) {
                if (!map.has(row.problemId)) {
                    map.set(row.problemId, {
                        problemId: row.problemId,
                        problem: row.problem_summary,
                        solutions: []
                    });
                }

                if (row.solutionId) {
                    map.get(row.problemId).solutions.push({
                        id: row.solutionId,
                        solution: row.solution,
                        summary: row.solution_summary
                    });
                }
            }

            grouped.problems = Array.from(map.values());
            result.push(grouped);
        }

        return res.json({
            success: true,
            data: result
        });
    } catch (error) {
        return res.status(500).json({
            error: error.message
        });
    }
};

const postStat = async (req, res) => {
    try {
        const [posts] = await pool.execute(`SELECT * FROM posts`);

        const [interactions] = await pool.execute(`
            SELECT 
                i.*,
                ip.postId,
                p.post_description,
                p.post_link
            FROM interactions i
            LEFT JOIN interaction_posts ip ON i.id = ip.interactionId
            LEFT JOIN posts p ON p.id = ip.postId
        `);

        let totalComments = 0;
        let aboutUs = 0;
        let aboutOthers = 0;
        let usPositive = 0;
        let usNegative = 0;
        let usNeutral = 0;

        const enrichedPosts = [];
        const postMap = new Map();

        for (const post of posts) {
            postMap.set(post.id, {
                ...post,
                interactions: []
            });
        }

        for (const i of interactions) {
            totalComments++;

            const sentiment = (i.sentiment_label || '').toLowerCase();
            const isAboutUs = i.postId !== null;

            if (isAboutUs) aboutUs++;
            else aboutOthers++;

            if (isAboutUs) {
                if (sentiment === 'positive') usPositive++;
                else if (sentiment === 'negative') usNegative++;
                else usNeutral++;
            }

            const [problemRows] = await pool.execute(`
                SELECT p.id, p.problem_summary, s.solution, s.solution_summary
                FROM interaction_problems ip
                JOIN problems p ON p.id = ip.problemId
                LEFT JOIN problem_solution ps ON ps.problemId = p.id
                LEFT JOIN solutions s ON s.id = ps.solutionId
                WHERE ip.interactionId = ?
            `, [i.id]);

            const [keywordRows] = await pool.execute(`
                SELECT k.keyword
                FROM interaction_keywords ik
                JOIN keywords k ON k.id = ik.keywordId
                WHERE ik.interactionId = ?
            `, [i.id]);

            const enrichedInteraction = {
                ...i,
                isAboutUs,
                problems: problemRows,
                keywords: keywordRows.map(k => k.keyword)
            };

            if (i.postId && postMap.has(i.postId)) {
                postMap.get(i.postId).interactions.push(enrichedInteraction);
            }
        }

        enrichedPosts.push(...postMap.values());

        return res.json({
            success: true,
            stats: {
                totalComments,
                aboutUs,
                aboutOthers,
                percentAboutUs: totalComments ? (aboutUs / totalComments) * 100 : 0,
                percentAboutOthers: totalComments ? (aboutOthers / totalComments) * 100 : 0,
                sentimentAboutUs: {
                    positive: usPositive,
                    negative: usNegative,
                    neutral: usNeutral,
                    positiveRate: aboutUs ? (usPositive / aboutUs) * 100 : 0,
                    negativeRate: aboutUs ? (usNegative / aboutUs) * 100 : 0,
                    neutralRate: aboutUs ? (usNeutral / aboutUs) * 100 : 0
                }
            },
            posts: enrichedPosts
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export default { 
    importCSV ,
    ingestBatchJson,
    ProblemSolutionData , 
    generalStats ,
    postStat
};
