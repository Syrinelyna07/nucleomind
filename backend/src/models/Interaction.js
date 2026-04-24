import pool from '../config/dbConfig';

class Interaction{
    static async create(data) {
        const {status,description,source_type,auther_username,content_text,sentiment_label,emotion_label,suggested_reply,content_lg,created_at} = data ;
        try {
            const [result] = await pool.execute(`INSERT INTO interactions (status,description,source_type,auther_username,content_text,sentiment_label,emotion_label,suggested_reply,content_lg,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,[status,description,source_type,auther_username,content_text,sentiment_label,emotion_label,suggested_reply,content_lg,created_at]);
            return result.insertId ;
        } catch (error) {
            throw new Error(`Error creating interaction : ${error.message}`);
        }
    }
    static async update(id, data) {
        const {status,description,source_type,auther_username,content_text,sentiment_label,emotion_label,suggested_reply,content_lg} = data ;   
        try {   
            await pool.execute(`UPDATE interactions SET status = ?, description = ?, source_type = ?, auther_username = ?, content_text = ?, sentiment_label = ?, emotion_label = ?, suggested_reply = ?, content_lg = ? WHERE id = ?`, [status,description,source_type,auther_username,content_text,sentiment_label,emotion_label,suggested_reply,content_lg, id]);
        }   catch (error) {     
            throw new Error(`Error updating interaction : ${error.message}`);
        }
    }
    static async delete(id) {
        try {
            await pool.execute(`DELETE FROM interactions WHERE id = ?`, [id]);  
        } catch (error) {
            throw new Error(`Error deleting interaction : ${error.message}`);
        }   
    }
    static async createPost(data){
        const {post_description,nbComments,post_link} = data ;
        try {
            const [result] = await pool.execute(`INSERT INTO posts (post_description,nbComments,post_link) VALUES (?,?,?)`,[post_description,nbComments,post_link]);
            return result.insertId ;
        } catch (error) {
            throw new Error(`Error creating post : ${error.message}`);
        }   
    }
    static async linkInteractionPost(interactionId, postId) {
        try {
            await pool.execute(`INSERT INTO interaction_posts (interactionId, postId) VALUES (?, ?)`, [interactionId, postId]); 
        } catch (error) {
            throw new Error(`Error linking interaction and post : ${error.message}`);
        }
    }
    static async linkInteractionProblem(interactionId, problemId) {
        try {
            await pool.execute(`INSERT INTO interaction_problems (interactionId, problemId) VALUES (?, ?)`, [interactionId, problemId]);
        } catch (error) {
            throw new Error(`Error linking interaction and problem : ${error.message}`);
        }   
    }
    static async findProblemsByInteractionId(interactionId) {
        try {
            const [rows] = await pool.execute(`SELECT p.* FROM problems p JOIN interaction_problems ip ON p.id = ip.problemId WHERE ip.interactionId = ?`, [interactionId]);    
            return rows;
        } catch (error) {
            throw new Error(`Error finding problems by interaction id : ${error.message}`);
        }      
    }
    static async findAll() {
        try {
            const [rows] = await pool.execute(`SELECT * FROM interactions`);        
            return rows;
        } catch (error) {
            throw new Error(`Error finding interactions : ${error.message}`);
        }   
    }
    static async findById(id) {
        try {
            const [rows] = await pool.execute(`SELECT * FROM interactions WHERE id = ?`, [id]);
            return rows[0];
        } catch (error) {
            throw new Error(`Error finding interaction by id : ${error.message}`);
        }
    }
}