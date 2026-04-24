import express from 'express';
import controller from '../controllers/postController.js';

const router = express.Router();

router.post('/', controller.createPost);
router.get('/all', controller.getAllPosts);
router.get('/:id/full', controller.getPostWithRelations);

export default router;