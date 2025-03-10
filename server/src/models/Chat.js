const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const chatSchema = new mongoose.Schema({
  match: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true,
    unique: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  messages: [messageSchema],
  lastMessage: {
    type: messageSchema,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Middleware para actualizar lastMessage y lastActivity
chatSchema.pre('save', function(next) {
  if (this.messages.length > 0) {
    this.lastMessage = this.messages[this.messages.length - 1];
    this.lastActivity = this.lastMessage.createdAt;
  }
  next();
});

// Método para marcar mensajes como leídos
chatSchema.methods.markMessagesAsRead = async function(userId) {
  const unreadMessages = this.messages.filter(msg => 
    !msg.readBy.includes(userId) && 
    msg.sender.toString() !== userId.toString()
  );

  unreadMessages.forEach(msg => {
    msg.readBy.push(userId);
  });

  if (unreadMessages.length > 0) {
    await this.save();
  }

  return unreadMessages.length;
};

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;