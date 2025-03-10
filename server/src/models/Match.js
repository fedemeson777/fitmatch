const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  matchScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  matchCriteria: {
    fitnessGoals: {
      type: Boolean,
      default: false
    },
    workoutPreferences: {
      type: Boolean,
      default: false
    },
    availability: {
      type: Boolean,
      default: false
    },
    location: {
      type: Boolean,
      default: false
    }
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastInteraction: {
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

// Asegurar que un usuario no pueda tener múltiples matches pendientes con el mismo usuario
matchSchema.index({ 
  'users': 1, 
  'status': 1 
}, {
  unique: true,
  partialFilterExpression: { status: 'pending' }
});

const Match = mongoose.model('Match', matchSchema);

module.exports = Match;