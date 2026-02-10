// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import naverRoutes from './routes/platforms/naver.routes';
import shopeeRoutes from './routes/platforms/shopee.routes';
import { config } from './config/config';

dotenv.config();

const app = express();
const PORT = config.server.port;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Modular Routes
app.use('/naver', naverRoutes);
app.use('/shopee', shopeeRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

export default app;
