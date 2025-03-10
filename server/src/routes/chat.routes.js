const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Match = require('../models/Match');
const User = require('../models/User');

// Obtener todos los chats del usuario
router.get('/', async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user.id,
      isActive: true
    })
    .populate({
      path: 'participants',
      select: 'name profileImage lastActive'
    })
    .populate('match')
    .sort('-lastActivity');

    const formattedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(
        p => p._id.toString() !== req.user.id
      );

      return {
        id: chat._id,
        user: {
          id: otherParticipant._id,
          name: otherParticipant.name,
          profileImage: otherParticipant.profileImage,
          status: isUserOnline(otherParticipant.lastActive),
          lastMessage: chat.lastMessage?.content || '',
          time: formatMessageTime(chat.lastMessage?.createdAt)
        },
        unreadCount: chat.messages.filter(msg =>
          msg.sender.toString() !== req.user.id &&
          !msg.readBy.includes(req.user.id)
        ).length
      };
    });

    res.json(formattedChats);
  } catch (error) {
    console.error('Error al obtener chats:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Obtener chat por ID
router.get('/:id', async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user.id,
      isActive: true
    })
    .populate({
      path: 'participants',
      select: 'name profileImage lastActive'
    })
    .populate('match');

    if (!chat) {
      return res.status(404).json({ message: 'Chat no encontrado' });
    }

    // Marcar mensajes como leídos
    await chat.markMessagesAsRead(req.user.id);

    const otherParticipant = chat.participants.find(
      p => p._id.toString() !== req.user.id
    );

    const formattedChat = {
      id: chat._id,
      match: chat.match,
      user: {
        id: otherParticipant._id,
        name: otherParticipant.name,
        profileImage: otherParticipant.profileImage,
        status: isUserOnline(otherParticipant.lastActive)
      },
      messages: chat.messages.map(msg => ({
        id: msg._id,
        sender: msg.sender.toString() === req.user.id ? 'me' : 'them',
        text: msg.content,
        time: formatMessageTime(msg.createdAt),
        readBy: msg.readBy
      }))
    };

    res.json(formattedChat);
  } catch (error) {
    console.error('Error al obtener chat:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Enviar mensaje
router.post('/message', async (req, res) => {
  try {
    const { chatId, content } = req.body;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user.id,
      isActive: true
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat no encontrado' });
    }

    const newMessage = {
      sender: req.user.id,
      content,
      readBy: [req.user.id]
    };

    chat.messages.push(newMessage);
    chat.lastMessage = newMessage;
    chat.lastActivity = new Date();
    await chat.save();

    // Emitir evento de socket
    req.app.get('io').to(`chat-${chatId}`).emit('new-message', {
      chatId,
      message: {
        id: newMessage._id,
        sender: 'them',
        text: content,
        time: formatMessageTime(new Date()),
        readBy: newMessage.readBy
      }
    });

    res.json({
      id: newMessage._id,
      sender: 'me',
      text: content,
      time: formatMessageTime(new Date()),
      readBy: newMessage.readBy
    });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Funciones auxiliares
const isUserOnline = (lastActive) => {
  if (!lastActive) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return lastActive > fiveMinutesAgo;
};

const formatMessageTime = (date) => {
  if (!date) return '';

  const now = new Date();
  const messageDate = new Date(date);
  const diffDays = Math.floor((now - messageDate) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return messageDate.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } else if (diffDays === 1) {
    return 'Ayer';
  } else if (diffDays < 7) {
    return messageDate.toLocaleDateString('es-AR', { weekday: 'long' });
  } else {
    return messageDate.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  }
};

module.exports = router;