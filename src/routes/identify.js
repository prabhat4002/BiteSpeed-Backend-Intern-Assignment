const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

// POST /identify endpoint to reconcile customer identities
router.post('/', async (req, res) => {
  const { email, phoneNumber } = req.body;

  // Input validation: Ensure at least one of email or phoneNumber is provided
  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'At least one of email or phoneNumber is required' });
  }

  // Validate email format if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate phoneNumber is numeric if provided
  if (phoneNumber && !/^\d+$/.test(phoneNumber)) {
    return res.status(400).json({ error: 'Phone number must be numeric' });
  }
