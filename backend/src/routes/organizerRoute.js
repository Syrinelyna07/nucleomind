import express from 'express';
import multer from 'multer';
import controller from '../controllers/organizerController.js';
import exportController from '../controllers/exportController.js';

const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.get('/import', (req, res) => {
    res.json({ message: "Import endpoint ready" });
});
router.post('/import', upload.single('file'), controller.importCSV);


// ─── CSV Import ───────────────────────────────────────────────
router.get('/import', (req, res) => res.json({ message: 'Import endpoint ready' }));
router.post('/import', upload.single('file'), controller.importCSV);

// ─── Statistics ───────────────────────────────────────────────
router.get('/stats/general', controller.generalStats);
router.get('/stats/problems', controller.ProblemSolutionData);
router.get('/stats/posts', controller.postStat);

// ─── Exports ─────────────────────────────────────────────────
// PDF report of general statistics (mirrors the dashboard overview)
router.get('/export/stats/pdf', exportController.exportStatsPDF);

// CSV of interactions — optional filters via query params:
//   ?status=not_traited&source_type=public_comment&startDate=2024-01-01&endDate=2024-12-31&is_urgent=true
router.get('/export/interactions/csv', exportController.exportInteractionsCSV);

// CSV of all problems + their solutions
router.get('/export/problems/csv', exportController.exportProblemsCSV);

export default router;