import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import gamesRoutes from './routes/games.routes';
import analysisRoutes from './routes/analysis.routes';
import { shutdownStockfish } from './services/stockfish.service';

// Load environment variables from .env file
dotenv.config();

// Create Express app
const app: Express = express();
const PORT = process.env.PORT || 5000;

// =====================================
// MIDDLEWARE
// =====================================

// Parse JSON request bodies
app.use(express.json());

// Enable CORS (allows mobile app to connect)
app.use(cors());

// Request logging
app.use((req: Request, res: Response, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// =====================================
// ROUTES
// =====================================

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: '🚀 Chess Coach API is running!',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// API status endpoint
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    api: 'Chess Coach Backend',
    version: '1.0.0',
    status: 'operational',
    database: 'connected' // TODO: Check actual DB connection
  });
});

// Game routes
app.use('/api/games', gamesRoutes);

// Analysis routes
app.use('/api/analysis', analysisRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// =====================================
// START SERVER
// =====================================

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Start Express server
    app.listen(PORT, () => {
      console.log('=================================');
      console.log('🚀 Chess Coach Backend Server');
      console.log('=================================');
      console.log(`📡 Server running on http://localhost:${PORT}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('=================================');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  shutdownStockfish();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  shutdownStockfish();
  process.exit(0);
});
