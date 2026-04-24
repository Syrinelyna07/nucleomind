import fs from 'fs';
import csv from 'csv-parser';
import pool from '../config/dbConfig.js';
import Interaction from '../models/Interaction.js';
import Post from '../models/Post.js';
import Problem from '../models/Problem.js';

const importCSV = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const results = [];

    try {
        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                try {
                    for (const row of results) {
                        try {
                            // 1️⃣ CREATE INTERACTION
                            console.log('Creating interaction for:', row.author_username);
                            const interactionId = await Interaction.create({
                                status: row.status || 'not traited',
                                description: row.problem_summary,
                                source_type: row.source_type,
                                author_username: row.author_username, // ⚠️ you had "auther_username" (typo)
                                content_text: row.content_text,
                                sentiment_label: row.sentiment_label,
                                emotion_label: row.emotion_label,
                                suggested_reply: row.suggested_reply,
                                content_lg: row.content_language,
                                created_at: row.created_at
                            });
                            console.log('Interaction created:', interactionId);

                            // 2️⃣ CREATE POST
                            if (row.post_link) {
                                console.log('Creating post...');
                                const postId = await Post.create({
                                    post_description: row.post_description,
                                    nbComments: row.nb_comments,
                                    post_link: row.post_link
                                });
                                console.log('Post created:', postId);
                                await Interaction.linkInteractionPost(interactionId, postId);
                            }

                            // 3️⃣ CREATE PROBLEM
                            let problemId = null;
                            if (row.problem_summary) {
                                console.log('Creating problem...');
                                problemId = await Problem.create({ problem_summary: row.problem_summary });
                                console.log('Problem created:', problemId);
                                await Interaction.linkInteractionProblem(interactionId, problemId);
                            }

                            // 4️⃣ CREATE SOLUTION
                            if (row.recommended_solution && problemId) {
                                console.log('Creating solution...');
                                const solutionId = await Problem.createSolution({
                                    solution: row.recommended_solution,
                                    solution_summary: row.solution_labels
                                });
                                console.log('Solution created:', solutionId);
                                await Problem.createProblemSolution(problemId, solutionId);
                            }

                            // 5️⃣ KEYWORDS
                            if (row.category_labels) {
                                const keywords = row.category_labels.split(',');
                                for (let k of keywords) {
                                    const [result] = await pool.execute(
                                        `INSERT INTO keywords (keyword) VALUES (?)`,
                                        [k.trim()]
                                    );
                                    await pool.execute(
                                        `INSERT INTO interaction_keywords (interactionId, keywordId) VALUES (?, ?)`,
                                        [interactionId, result.insertId]
                                    );
                                }
                            }

                        } catch (err) {
                            console.error("❌ Row error:", err.message);
                            console.error(err.stack);
                        }
                    }

                    res.json({ message: "CSV imported successfully", total: results.length });

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

export default { importCSV };