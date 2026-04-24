import fs from 'fs';
import csv from 'csv-parser';
import pool from '../config/dbConfig.js';
import Interaction from '../models/Interaction.js';
import Post from '../models/Post.js';
import Account from '../models/Account.js';
import Problem from '../models/Problem.js';
import { sendUrgentEmail } from "../services/emailService.js";

// CSV columns:
// id, platform, source_type, comment_link, post_link, post_description, nb_comments,
// author_username, content_text, content_language, created_at, sentiment_label,
// emotion_label, category_labels, problem_labels, is_urgent, urgency_reason,
// recommended_solution, suggested_reply, status
//
// problem_labels and recommended_solution are semicolon-separated strings
// where problem[i] is paired with solution[i]

const importCSV = async (req, res) => {
    const account = await Account.findById(1);
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const results = [];

    try {
        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                try {
                    let imported = 0;
                    let failed = 0;

                    for (const row of results) {
                        try {
                            console.log('Creating interaction for:', row.author_username);

                            // 1️⃣ CREATE INTERACTION
                            const interactionId = await Interaction.create({
                                status: row.status || 'not_traited',
                                description: row.problem_labels || null,
                                source_type: row.source_type || null,
                                author_username: row.author_username || null,
                                content_text: row.content_text || null,
                                sentiment_label: row.sentiment_label || null,
                                emotion_label: row.emotion_label || null,
                                suggested_reply: row.suggested_reply || null,
                                urgency_reason: row.urgency_reason || null,
                                is_urgent: row.is_urgent === 'true' || false,
                                content_lg: row.content_language || null,
                                created_at: row.created_at || null
                            });
                            // 🚨 5️⃣ SEND EMAIL IF URGENT
                            if (row.is_urgent === "true" ||row.is_urgent === "True" || row.is_urgent === "1") {
                                try {
                                    await sendUrgentEmail("admin@gmail.com", {
                                        author: row.author_username,
                                        content: row.content_text,
                                        sentiment: row.sentiment_label,
                                        reason: row.urgency_reason,
                                        reply: row.suggested_reply,
                                        link : row.comment_link || row.post_link || null
                                    });

                                    console.log("📧 Urgent email sent");
                                } catch (emailErr) {
                                    console.error("❌ Email failed:", emailErr.message);
                                }
                            }
                            console.log('✅ Interaction created:', interactionId);
                            
                            // 2️⃣ CREATE POST
                            if (row.post_link) {
                                const postId = await Post.create({
                                    post_description: row.post_description || null,
                                    nbComments: row.nb_comments || null,
                                    post_link: row.post_link
                                });
                                if (postId) {
                                    await Interaction.linkInteractionPost(interactionId, postId);
                                    console.log('✅ Post linked:', postId);
                                }
                            }

                            // 3️⃣ CREATE PROBLEMS + PAIRED SOLUTIONS
                            // problem_labels: "delivery_delay;no_update"
                            // recommended_solution: "track_order;escalate"
                            // problem[0] -> solution[0], problem[1] -> solution[1], etc.
                            if (row.problem_labels) {
                                const problemList = row.problem_labels.split(';').map(p => p.trim()).filter(Boolean);
                                const solutionList = row.recommended_solution
                                    ? row.recommended_solution.split(';').map(s => s.trim()).filter(Boolean)
                                    : [];

                                for (let i = 0; i < problemList.length; i++) {
                                    const problemId = await Problem.create({
                                        problem_summary: problemList[i]
                                    });
                                    await Interaction.linkInteractionProblem(interactionId, problemId);
                                    console.log(`✅ Problem[${i}] linked:`, problemId);

                                    // pair with solution at same index if it exists
                                    if (solutionList[i]) {
                                        const solutionId = await Problem.createSolution({
                                            solution: solutionList[i],
                                            solution_summary: row.urgency_reason || null
                                        });
                                        await Problem.createProblemSolution(problemId, solutionId);
                                        console.log(`✅ Solution[${i}] linked:`, solutionId);
                                    }
                                }
                            }

                            // 4️⃣ KEYWORDS from category_labels (single value, not array)
                            if (row.category_labels) {
                                const [result] = await pool.execute(
                                    `INSERT INTO keywords (keyword) VALUES (?)`,
                                    [row.category_labels.trim()]
                                );
                                await pool.execute(
                                    `INSERT INTO interaction_keywords (interactionId, keywordId) VALUES (?, ?)`,
                                    [interactionId, result.insertId]
                                );
                                console.log('✅ Keyword linked:', row.category_labels.trim());
                            }

                            imported++;
                        } catch (err) {
                            console.error(`❌ Row error (${row.author_username}):`, err.message);
                            failed++;
                        }
                    }

                    res.json({
                        message: "CSV import complete",
                        total: results.length,
                        imported,
                        failed
                    });

                } catch (err) {
                    console.error("❌ Stream end error:", err.message);
                    res.status(500).json({ error: err.message });
                }
            })
            .on('error', (err) => {
                console.error("❌ Stream error:", err.message);
                res.status(500).json({ error: err.message });
            });

    } catch (error) {
        console.error("❌ Top level error:", error.message);
        res.status(500).json({ error: error.message });
    }
};
const generalStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const [interactions] = await pool.execute(`SELECT * FROM interactions`);

        const total = interactions.length;

        // =====================
        // 📊 COUNTERS
        // =====================
        let positive = 0;
        let negative = 0;
        let neutral = 0;

        let urgentCount = 0;

        const sourceStats = {
            public_comment: 0,
            private_comment: 0,
            private_dm: 0
        };

        // =====================
        // 📦 LISTS
        // =====================
        const urgentInteractions = [];
        const publicComments = [];
        const privateComments = [];
        const privateDMs = [];
        const filteredByDate = [];
        const nonTraitedCommentsPublic = [];
        const nonTraitedCommentsPrivate = [];
        const nonTraitedChat = [];

        for (const i of interactions) {
            // =====================
            // SENTIMENT
            // =====================
            const sentiment = (i.sentiment_label || '').toLowerCase();

            if (sentiment === 'positive') positive++;
            else if (sentiment === 'negative') negative++;
            else neutral++;

            // =====================
            // SOURCE GROUPING
            // =====================
            if (i.source_type === 'public_comment') {
                sourceStats.public_comment++;
                publicComments.push(i);
                if(i.status = 'not_traited') nonTraitedCommentsPublic.push(i);
            }

            if (i.source_type === 'private_comment') {
                sourceStats.private_comment++;
                privateComments.push(i);
                if(i.status = 'not_traited') nonTraitedCommentsPrivate.push(i);
            }

            if (i.source_type === 'private_dm') {
                sourceStats.private_dm++;
                privateDMs.push(i);
                if(i.status = 'not_traited') nonTraitedChat.push(i);
            }
            // =====================
            // URGENCY (FIXED)
            // =====================
            if (i.is_urgent === 1 || i.is_urgent === true) {
                urgentCount++;
                urgentInteractions.push(i);
            }

            // =====================
            // DATE FILTER
            // =====================
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

        // =====================
        // RESPONSE
        // =====================
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
        // =========================
        // 1. GET POSTS
        // =========================
        const [posts] = await pool.execute(`SELECT * FROM posts`);

        // =========================
        // 2. GET ALL INTERACTIONS WITH LINKS
        // =========================
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

        // =========================
        // STATS VARIABLES
        // =========================
        let totalComments = 0;
        let aboutUs = 0;
        let aboutOthers = 0;

        let usPositive = 0;
        let usNegative = 0;
        let usNeutral = 0;

        const enrichedPosts = [];

        // =========================
        // MAP POST → INTERACTIONS
        // =========================
        const postMap = new Map();

        for (const post of posts) {
            postMap.set(post.id, {
                ...post,
                interactions: []
            });
        }

        // =========================
        // PROCESS INTERACTIONS
        // =========================
        for (const i of interactions) {
            totalComments++;

            const sentiment = (i.sentiment_label || '').toLowerCase();

            const isAboutUs = i.postId !== null;

            if (isAboutUs) aboutUs++;
            else aboutOthers++;

            // sentiment tracking ONLY for "about us"
            if (isAboutUs) {
                if (sentiment === 'positive') usPositive++;
                else if (sentiment === 'negative') usNegative++;
                else usNeutral++;
            }

            // =========================
            // FETCH RELATED DATA
            // =========================
            let problems = [];
            let keywords = [];

            // problems
            const [problemRows] = await pool.execute(`
                SELECT p.id, p.problem_summary, s.solution, s.solution_summary
                FROM interaction_problems ip
                JOIN problems p ON p.id = ip.problemId
                LEFT JOIN problem_solution ps ON ps.problemId = p.id
                LEFT JOIN solutions s ON s.id = ps.solutionId
                WHERE ip.interactionId = ?
            `, [i.id]);

            problems = problemRows;

            // keywords
            const [keywordRows] = await pool.execute(`
                SELECT k.keyword
                FROM interaction_keywords ik
                JOIN keywords k ON k.id = ik.keywordId
                WHERE ik.interactionId = ?
            `, [i.id]);

            keywords = keywordRows.map(k => k.keyword);

            // =========================
            // BUILD INTERACTION OBJECT
            // =========================
            const enrichedInteraction = {
                ...i,
                isAboutUs,
                problems,
                keywords
            };

            // attach to post if exists
            if (i.postId && postMap.has(i.postId)) {
                postMap.get(i.postId).interactions.push(enrichedInteraction);
            }
        }

        enrichedPosts.push(...postMap.values());

        // =========================
        // FINAL RESPONSE
        // =========================
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
    ProblemSolutionData , 
    generalStats ,
    postStat
};