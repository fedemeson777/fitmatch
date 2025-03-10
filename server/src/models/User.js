const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    required: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  fitnessLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    required: true
  },
  fitnessGoals: [{
    type: String,
    enum: ['weightLoss', 'muscleGain', 'endurance', 'flexibility', 'generalFitness']
  }],
  preferredWorkouts: [{
    type: String,
    enum: ['cardio', 'strength', 'yoga', 'crossfit', 'running', 'swimming', 'cycling']
  }],
  availability: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    timeSlots: [{
      start: String,
      end: String
    }]
  }],
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  bio: {
    type: String,
    maxLength: 500
  },
  profileImage: {
    type: String
  },
  active: {
    type: Boolean,
    default: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Crear índice geoespacial para búsquedas por ubicación
userSchema.index({ location: '2dsphere' });

// Método para validar contraseña
userSchema.methods.validatePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// Middleware para hashear la contraseña antes de guardar
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Método para devolver el usuario sin la contraseña
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;