import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import onboardingRoutes from './routes/onboarding.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/onboarding', onboardingRoutes);

// Health check
app.get('/', (req, res) => {
    res.send('Momentum PoC API is running.');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
