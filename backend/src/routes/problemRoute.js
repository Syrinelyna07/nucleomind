import express from 'express';
import controller from '../controllers/problemController.js';

const router = express.Router();

router.post('/', controller.createProblem);
router.put('/:id', controller.updateProblem);
router.get('/', controller.getAllProblems);
router.get('/:id/full', controller.getProblemWithRelations);

export default router;