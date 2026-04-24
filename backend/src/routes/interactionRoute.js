import express from 'express';
import controller from '../controllers/interactionController.js';

const router = express.Router();

router.post('/', controller.createInteraction);
router.get('/', controller.getAllInteractions);
router.get('/full', controller.getAllInteractionsFull);
router.get('/:id/full', controller.getInteractionWithRelations);

export default router;