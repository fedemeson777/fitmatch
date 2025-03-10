require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const matchRoutes = require('./routes/match.routes');
const chatRoutes = require('./routes/chat.routes');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

// Configuración de CORS
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middlewares
app.use(express.json());

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/matches', authenticateToken, matchRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!' });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.on('join-chat', (chatId) => {
    socket.join(`chat-${chatId}`);
  });

  socket.on('send-message', (data) => {
    io.to(`chat-${data.chatId}`).emit('new-message', data);
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fitmatch', {
  serverSelectionTimeoutMS: 5000,
  family: 4
})
.then(() => console.log('Conectado a MongoDB'))
.catch(err => console.error('Error conectando a MongoDB:', err));

// Manejo de eventos de conexión MongoDB
mongoose.connection.on('connected', () => {
  console.log('Mongoose conectado a MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Error de conexión MongoDB:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose desconectado de MongoDB');
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});