import Post from '../models/Post.js';
import pool from '../config/dbConfig.js';

const createPost = async (req, res) => {
    try {
        const id = await Post.create(req.body);
        res.status(201).json({ id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getAllPosts = async (req, res) => {
    try {
        const posts = await Post.findAll();
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const getPostById = async (req,res) =>{
    try {
        const { id } = req.params;
        const post = await Post.findById(id);
        return res.status(200).json(post);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}


const getPostWithRelations = async (req, res) => {
    try {
        const { id } = req.params;

        const post = await Post.findById(id);

        const interactions = await Post.findInteractionByPostId(id);

        res.json({
            post,
            interactions
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


export default {
    createPost,
    getAllPosts,
    getPostWithRelations,
    getPostById
};