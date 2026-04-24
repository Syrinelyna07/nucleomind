
import pool from '../config/dbConfig.js';
import Interaction from '../models/Interaction.js';

const createInteraction = async (req, res) => {
    try {
        const id = await Interaction.create(req.body);
        res.status(201).json({ id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getAllInteractions = async (req, res) => {
    try {
        const data = await Interaction.findAll();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getInteractionWithRelations = async (req, res) => {
    try {
        const { id } = req.params;

        const interaction = await Interaction.findById(id);

        const posts = await pool.execute(`
            SELECT p.* FROM posts p
            JOIN interaction_posts ip ON p.id = ip.postId
            WHERE ip.interactionId = ?
        `, [id]);

        const problems = await Interaction.findProblemsByInteractionId(id);

        const [keywords] = await pool.execute(`
            SELECT k.* FROM keywords k
            JOIN interaction_keywords ik ON k.id = ik.keywordId
            WHERE ik.interactionId = ?
        `, [id]);

        res.json({
            interaction,
            posts: posts[0],
            problems,
            keywords
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getAllInteractionsFull = async (req, res) => {
    try {
        const interactions = await Interaction.findAll();

        const result = [];

        for (let i of interactions) {
            const problems = await Interaction.findProblemsByInteractionId(i.id);

            const [posts] = await pool.execute(`
                SELECT p.* FROM posts p
                JOIN interaction_posts ip ON p.id = ip.postId
                WHERE ip.interactionId = ?
            `, [i.id]);

            result.push({
                ...i,
                problems,
                posts
            });
        }

        res.json(result);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default {
    createInteraction,
    getAllInteractions,
    getInteractionWithRelations,
    getAllInteractionsFull
};