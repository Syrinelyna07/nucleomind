import Problem from '../models/Problem.js';
import pool from '../config/dbConfig.js';

const createProblem = async (req, res) => {
    try {
        const id = await Problem.create(req.body);
        res.status(201).json({ id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateProblem = async (req, res) => {
    try {
        await Problem.update(req.params.id, req.body);
        res.status(200).json({ message: "updated" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getAllProblems = async (req, res) => {
    try {
        const data = await Problem.findAll();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getProblemWithRelations = async (req, res) => {
    try {
        const { id } = req.params;

        const problem = await Problem.findById(id);

        const solutions = await Problem.findSolutionsByProblemId(id);

        const [interactions] = await pool.execute(`
            SELECT i.* FROM interactions i
            JOIN interaction_problems ip ON i.id = ip.interactionId
            WHERE ip.problemId = ?
        `, [id]);

        res.json({
            problem,
            solutions,
            interactions
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default {
    createProblem,
    updateProblem,
    getAllProblems,
    getProblemWithRelations
};