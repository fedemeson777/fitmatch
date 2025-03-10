const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Match = require('../models/Match');
const Chat = require('../models/Chat');

// Obtener matches cercanos
router.get('/nearby', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.location) {
      return res.status(400).json({ message: 'Ubicación no disponible' });
    }

    // Buscar usuarios cercanos (dentro de 10km) con criterios compatibles
    const nearbyUsers = await User.find({
      _id: { $ne: user._id },
      active: true,
      location: {
        $near: {
          $geometry: user.location,
          $maxDistance: 10000 // 10km en metros
        }
      },
      fitnessLevel: user.fitnessLevel,
      // Al menos un objetivo de fitness en común
      fitnessGoals: { $in: user.fitnessGoals },
      // Al menos un tipo de entrenamiento preferido en común
      preferredWorkouts: { $in: user.preferredWorkouts }
    }).select('-password');

    // Calcular score de compatibilidad para cada usuario
    const potentialMatches = nearbyUsers.map(nearbyUser => {
      const matchScore = calculateMatchScore(user, nearbyUser);
      return {
        user: nearbyUser,
        matchScore,
        distance: calculateDistance(user.location, nearbyUser.location)
      };
    });

    // Ordenar por score de compatibilidad
    potentialMatches.sort((a, b) => b.matchScore - a.matchScore);

    res.json(potentialMatches);
  } catch (error) {
    console.error('Error al obtener matches cercanos:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Crear un nuevo match (like)
router.post('/like', async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user.id;

    // Verificar que el usuario objetivo existe
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar si ya existe un match pendiente
    const existingMatch = await Match.findOne({
      users: { $all: [userId, targetUserId] },
      status: 'pending'
    });

    if (existingMatch) {
      return res.status(400).json({ message: 'Ya existe un match pendiente' });
    }

    // Calcular score del match
    const user = await User.findById(userId);
    const matchScore = calculateMatchScore(user, targetUser);

    // Crear nuevo match
    const newMatch = new Match({
      users: [userId, targetUserId],
      status: 'pending',
      matchScore,
      matchCriteria: {
        fitnessGoals: hasCommonElements(user.fitnessGoals, targetUser.fitnessGoals),
        workoutPreferences: hasCommonElements(user.preferredWorkouts, targetUser.preferredWorkouts),
        availability: hasCommonAvailability(user.availability, targetUser.availability),
        location: isWithinRange(user.location, targetUser.location, 10000)
      },
      initiatedBy: userId
    });

    await newMatch.save();

    // Verificar si hay un match mutuo
    const mutualMatch = await Match.findOne({
      users: { $all: [userId, targetUserId] },
      status: 'pending',
      initiatedBy: targetUserId
    });

    if (mutualMatch) {
      // Actualizar ambos matches a 'accepted'
      await Match.updateMany(
        { users: { $all: [userId, targetUserId] } },
        { status: 'accepted' }
      );

      // Crear chat para el match mutuo
      const newChat = new Chat({
        match: newMatch._id,
        participants: [userId, targetUserId]
      });
      await newChat.save();

      return res.json({
        message: '¡Match mutuo!',
        match: newMatch,
        chat: newChat
      });
    }

    res.json({
      message: 'Like enviado correctamente',
      match: newMatch
    });
  } catch (error) {
    console.error('Error al crear match:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Obtener matches mutuos
router.get('/mutual', async (req, res) => {
  try {
    const matches = await Match.find({
      users: req.user.id,
      status: 'accepted'
    })
    .populate('users', '-password')
    .sort('-lastInteraction');

    res.json(matches);
  } catch (error) {
    console.error('Error al obtener matches mutuos:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Funciones auxiliares
const calculateMatchScore = (user1, user2) => {
  let score = 0;
  
  // Objetivos de fitness en común
  const commonGoals = user1.fitnessGoals.filter(goal =>
    user2.fitnessGoals.includes(goal)
  );
  score += (commonGoals.length / user1.fitnessGoals.length) * 30;

  // Entrenamientos preferidos en común
  const commonWorkouts = user1.preferredWorkouts.filter(workout =>
    user2.preferredWorkouts.includes(workout)
  );
  score += (commonWorkouts.length / user1.preferredWorkouts.length) * 30;

  // Nivel de fitness similar
  if (user1.fitnessLevel === user2.fitnessLevel) {
    score += 20;
  }

  // Disponibilidad en común
  const availabilityScore = calculateAvailabilityScore(user1.availability, user2.availability);
  score += availabilityScore * 20;

  return Math.min(Math.round(score), 100);
};

const calculateDistance = (loc1, loc2) => {
  const R = 6371; // Radio de la Tierra en km
  const lat1 = loc1.coordinates[1] * Math.PI / 180;
  const lat2 = loc2.coordinates[1] * Math.PI / 180;
  const dLat = (loc2.coordinates[1] - loc1.coordinates[1]) * Math.PI / 180;
  const dLon = (loc2.coordinates[0] - loc1.coordinates[0]) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1) * Math.cos(lat2) *
           Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const hasCommonElements = (arr1, arr2) => {
  return arr1.some(item => arr2.includes(item));
};

const hasCommonAvailability = (avail1, avail2) => {
  return avail1.some(a1 =>
    avail2.some(a2 =>
      a1.day === a2.day && hasOverlappingTimeSlots(a1.timeSlots, a2.timeSlots)
    )
  );
};

const hasOverlappingTimeSlots = (slots1, slots2) => {
  return slots1.some(s1 =>
    slots2.some(s2 => {
      const start1 = new Date(`1970-01-01T${s1.start}`);
      const end1 = new Date(`1970-01-01T${s1.end}`);
      const start2 = new Date(`1970-01-01T${s2.start}`);
      const end2 = new Date(`1970-01-01T${s2.end}`);
      return start1 < end2 && start2 < end1;
    })
  );
};

const calculateAvailabilityScore = (avail1, avail2) => {
  let commonSlots = 0;
  let totalSlots = 0;

  avail1.forEach(a1 => {
    const matchingDay = avail2.find(a2 => a2.day === a1.day);
    if (matchingDay) {
      a1.timeSlots.forEach(s1 => {
        matchingDay.timeSlots.forEach(s2 => {
          if (isOverlapping(s1, s2)) commonSlots++;
        });
      });
    }
    totalSlots += a1.timeSlots.length;
  });

  return commonSlots / totalSlots;
};

const isOverlapping = (slot1, slot2) => {
  const start1 = new Date(`1970-01-01T${slot1.start}`);
  const end1 = new Date(`1970-01-01T${slot1.end}`);
  const start2 = new Date(`1970-01-01T${slot2.start}`);
  const end2 = new Date(`1970-01-01T${slot2.end}`);
  return start1 < end2 && start2 < end1;
};

const isWithinRange = (loc1, loc2, maxDistance) => {
  const distance = calculateDistance(loc1, loc2);
  return distance * 1000 <= maxDistance;
};

module.exports = router;