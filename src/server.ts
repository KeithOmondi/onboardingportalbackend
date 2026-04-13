import http from 'http';
import app from './app';
import config from './config/env';
import pool from './config/db';
import { initSocket } from './sockets/chat.socket';

const startServer = async () => {
  try {
    // Test the database connection
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful:', res.rows[0].now);

    // ✅ Wrap express app in native http server
    const httpServer = http.createServer(app);

    // ✅ Attach Socket.io to the http server
    initSocket(httpServer);

    // ✅ Listen on httpServer instead of app
    httpServer.listen(config.PORT, () => {
      console.log(`🚀 Server running in ${config.NODE_ENV} mode on http://localhost:${config.PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server due to DB connection error:', error);
    process.exit(1);
  }
};

startServer();