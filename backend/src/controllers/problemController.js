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
        const problems = await Problem.findAll();

        // attach solutions to each problem
        const result = await Promise.all(
            problems.map(async (problem) => {
                const solutions = await Problem.findSolutionsByProblemId(problem.id);
                return { ...problem, solutions };
            })
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getProblemWithRelations = async (req, res) => {
    try {
        const { id } = req.params;

        const problem = await Problem.findById(id);
        if (!problem) return res.status(404).json({ error: 'Problem not found' });

        const solutions = await Problem.findSolutionsByProblemId(id);

        const [interactions] = await pool.execute(`
            SELECT i.* FROM interactions i
            JOIN interaction_problems ip ON i.id = ip.interactionId
            WHERE ip.problemId = ?
        `, [id]);

        res.json({ problem, solutions, interactions });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default {
    createProblem,
    updateProblem,
    getAllProblems,
    getProblemWithRelations ,
    
};