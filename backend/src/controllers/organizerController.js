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
        // general Setiment Count
        const totalInteractions = await Interaction.findAll();
        const interactionTotalNumber = totalInteractions.length ;
        let positiveCount = 0;
        let negativeCount = 0;
        let neutreCount = 0 ;
        let commentPrivate = [];
        let commenstPublic = [];
        let chatPublic = [];
        if(interactionTotalNumber != 0){
            totalInteractions.forEach((interaction)=>{
                if(interaction.sentiment_label == 'Positive') { 
                    positiveCount ++ ;
                }else if(interaction.sentiment_label == 'Negative') {
                    negativeCount ++ ;
                }else{
                    neutreCount ++ ;
                }
            })
        }
        // interaction comment not chat 
        
        // number of mentions 
        // critical informations
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
const messagesData = async (req, res) => {
    try {
        
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
} 
const commentsData = async (req, res) => {
    try {
        
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
const ProblemSolutionData = async (req, res) => {
    try {
        
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

export default { importCSV };