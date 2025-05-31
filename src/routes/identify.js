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

    try {
    // Use Prisma transaction to ensure atomicity
    const result = await prisma.$transaction(async (prisma) => {
      // Find existing contacts matching either email or phoneNumber (and not deleted)
      const existingContacts = await prisma.contact.findMany({
        where: {
          OR: [
            { email: email || null },
            { phoneNumber: phoneNumber || null },
          ],
          deletedAt: null,
        },
      });

      let primaryContact = null;
      let secondaryContacts = [];

      // Case 1: No existing contacts - create a new primary contact
      if (existingContacts.length === 0) {
        primaryContact = await prisma.contact.create({
          data: {
            email,
            phoneNumber,
            linkPrecedence: 'primary',
          },
        });
      } else {
      }
