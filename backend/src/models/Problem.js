import pool from '../config/dbConfig.js';

class Problem {
    static async create(data) {
        const {problem_summary} = data ; 
        try {
            const [result] = await pool.execute(`INSERT INTO problems (problem_summary) VALUES (?)`,[problem_summary]);
            return result.insertId ;
        } catch (error) {
            throw new Error(`Error creating problem : ${error.message}`);
        }
    }   
    static async createProblemSolution(problemId, solutionId) {
        try {
            await pool.execute(`INSERT INTO problem_solution (problemId, solutionId) VALUES (?, ?)`, [problemId, solutionId]);  
        } catch (error) {
            throw new Error(`Error linking problem and solution : ${error.message}`);
        }
    }
    static async findSolutionsByProblemId(problemId) {
        try {
            const [rows] = await pool.execute(`SELECT s.* FROM solutions s JOIN problem_solution ps ON s.id = ps.solutionId WHERE ps.problemId = ?`, [problemId]);      
            return rows;
        } catch (error) {
            throw new Error(`Error finding solutions by problem id : ${error.message}`);
        }   
    }
    static async createSolution (data) {
        const {solution,solution_summary} = data ;  
        try {
            const [result] = await pool.execute(`INSERT INTO solutions (solution, solution_summary) VALUES (?, ?)`,[solution,solution_summary]);
            return result.insertId ;
        } catch (error) {
            throw new Error(`Error creating solution : ${error.message}`);
        }
    }
    static async findAll() {
        try {
            const [rows] = await pool.execute(`SELECT * FROM problems`);        
            return rows;
        } catch (error) {
            throw new Error(`Error finding problems : ${error.message}`);
        }
    }
    static async findById(id) {
        try {
            const [rows] = await pool.execute(`SELECT * FROM problems WHERE id = ?`, [id]);
            return rows[0];
        } catch (error) {
            throw new Error(`Error finding problem by id : ${error.message}`);
        }
    }
    static async update(id, data) {
        const {problem_summary} = data ;
        try {
            await pool.execute(`UPDATE problems SET problem_summary = ? WHERE id = ?`, [problem_summary, id]);
        } catch (error) {
            throw new Error(`Error updating problem : ${error.message}`);
        }
    }
    static async delete(id) {
        try {
            await pool.execute(`DELETE FROM problems WHERE id = ?`, [id]);
        } catch (error) {
            throw new Error(`Error deleting problem : ${error.message}`);
        }   
    }
    static async findByInteractionId(interactionId) {
        try {
            const [rows] = await pool.execute(`SELECT p.* FROM problems p JOIN interaction_problems ip ON p.id = ip.problemId WHERE ip.interactionId = ?`, [interactionId]);
            return rows;
        }   catch (error) {     
            throw new Error(`Error finding problems by interaction id : ${error.message}`);
        }
    }

}

export default Problem;

