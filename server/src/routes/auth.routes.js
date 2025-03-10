const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario por email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Validar contraseña
    const isValid = await user.validatePassword(password);
    if (!isValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Generar token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Actualizar último acceso
    user.lastActive = new Date();
    await user.save();

    res.json({
      user: user.toJSON(),
      token
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Verificar token
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json({ user: user.toJSON() });
  } catch (error) {
    console.error('Error al verificar token:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Registro
router.post('/register', async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      age,
      gender,
      fitnessLevel,
      fitnessGoals,
      preferredWorkouts,
      availability,
      location,
      bio
    } = req.body;

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    // Crear nuevo usuario
    const user = new User({
      email,
      password,
      name,
      age,
      gender,
      fitnessLevel,
      fitnessGoals,
      preferredWorkouts,
      availability,
      location,
      bio,
      active: true
    });

    await user.save();

    // Generar token para login automático
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registro exitoso',
      user: user.toJSON(),
      token
    });
  } catch (error) {
    console.error('Error en registro:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Datos de registro inválidos', errors: error.errors });
    }
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

module.exports = router;