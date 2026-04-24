import pool from '../config/dbConfig.js';
import Interaction from '../models/Interaction.js';
import Problem from '../models/Problem.js';

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

        const [posts] = await pool.execute(`
            SELECT p.* FROM posts p
            JOIN interaction_posts ip ON p.id = ip.postId
            WHERE ip.interactionId = ?
        `, [id]);

        // fetch problems, each with its solutions attached
        const rawProblems = await Interaction.findProblemsByInteractionId(id);
        const problems = await attachSolutionsToProblems(rawProblems);

        const [keywords] = await pool.execute(`
            SELECT k.* FROM keywords k
            JOIN interaction_keywords ik ON k.id = ik.keywordId
            WHERE ik.interactionId = ?
        `, [id]);

        res.json({ interaction, posts, problems, keywords });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getAllInteractionsFull = async (req, res) => {
    try {
        const interactions = await Interaction.findAll();
        const result = [];

        for (const i of interactions) {
            const rawProblems = await Interaction.findProblemsByInteractionId(i.id);
            const problems = await attachSolutionsToProblems(rawProblems);

            const [posts] = await pool.execute(`
                SELECT p.* FROM posts p
                JOIN interaction_posts ip ON p.id = ip.postId
                WHERE ip.interactionId = ?
            `, [i.id]);

            const [keywords] = await pool.execute(`
                SELECT k.* FROM keywords k
                JOIN interaction_keywords ik ON k.id = ik.keywordId
                WHERE ik.interactionId = ?
            `, [i.id]);

            result.push({ ...i, problems, posts, keywords });
        }

        res.json(result);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await Interaction.updateStatus(id, status);
        return res.status(200).json({ message: "Status updated" });
    }catch (error) {    
        return res.status(500).json({ error: error.message });
    }   
};

// helper: for each problem, fetch and attach its solutions
async function attachSolutionsToProblems(problems) {
    return Promise.all(
        problems.map(async (problem) => {
            const solutions = await Problem.findSolutionsByProblemId(problem.id);
            return { ...problem, solutions };
        })
    );
}

export default {
    createInteraction,
    getAllInteractions,
    getInteractionWithRelations,
    getAllInteractionsFull ,
    updateStatus
};