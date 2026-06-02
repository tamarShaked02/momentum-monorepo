import express from 'express';
import { analyzeBusiness } from '../services/aiService.js';

const router = express.Router();

router.post('/analyze', async (req, res) => {
    try {
        const { description } = req.body;

        if (!description) {
            return res.status(400).json({ error: "Business description is required." });
        }

        const analysisResult = await analyzeBusiness(description);
        res.json(analysisResult);

    } catch (error) {
        res.status(500).json({ error: "Failed to analyze business description.", details: error.message });
    }
});

export default router;
