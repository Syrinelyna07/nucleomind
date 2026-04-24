import pool from '../config/dbConfig';

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

