const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create an Express Router
const router = express.Router();

// Validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?\d+$/; // Allows optional "+" for country codes

const identify = async (req, res) => {
  const { email, phoneNumber } = req.body;

  // Input validation
  if (!email && !phoneNumber) {
    return res.status(400).json({ error: "At least one of email or phoneNumber must be provided" });
  }
  if (email && !emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  if (phoneNumber && !phoneRegex.test(phoneNumber)) {
    return res.status(400).json({ error: "Phone number must be numeric (optional '+' allowed)" });
  }
  if (phoneNumber && phoneNumber.length > 20) {
    return res.status(400).json({ error: "Phone number must not exceed 20 characters" });
  }

  try {
    // Find matching contacts
    const conditions = [];
    if (email) conditions.push({ email });
    if (phoneNumber) conditions.push({ phoneNumber });
    const matches = await prisma.contact.findMany({
      where: {
        OR: conditions,
        deletedAt: null,
      },
    });

    console.log("Initial matches:", matches);

    if (matches.length === 0) {
      // No matches, create a new primary contact
      const newContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "primary",
        },
      });
      return res.status(200).json({
        contact: {
          primaryContactId: newContact.id,
          emails: [newContact.email].filter(Boolean),
          phoneNumbers: [newContact.phoneNumber].filter(Boolean),
          secondaryContactIds: [],
        },
      });
    }

    // Find all primary contacts in the matched groups
    const primaryContactIds = new Set();
    for (const match of matches) {
      if (match.linkPrecedence === "primary") {
        primaryContactIds.add(match.id);
      } else if (match.linkedId) {
        primaryContactIds.add(match.linkedId);
      }
    }

    // Fetch all primary contacts and their secondaries
    const primaryContacts = await prisma.contact.findMany({
      where: {
        id: { in: Array.from(primaryContactIds) },
        deletedAt: null,
      },
    });

    const secondaryContacts = await prisma.contact.findMany({
      where: {
        linkedId: { in: Array.from(primaryContactIds) },
        linkPrecedence: "secondary",
        deletedAt: null,
      },
    });

    console.log("Primary contacts:", primaryContacts);
    console.log("Secondary contacts:", secondaryContacts);

    // Determine the oldest primary contact
    let oldestPrimary = primaryContacts[0];
    for (const contact of primaryContacts) {
      if (new Date(contact.createdAt) < new Date(oldestPrimary.createdAt)) {
        oldestPrimary = contact;
      }
    }

    // Merge groups: Reassign other primaries and their secondaries to the oldest primary
    await prisma.$transaction(async (tx) => {
      for (const primary of primaryContacts) {
        if (primary.id !== oldestPrimary.id) {
          // Convert the losing primary to secondary
          await tx.contact.update({
            where: { id: primary.id },
            data: {
              linkPrecedence: "secondary",
              linkedId: oldestPrimary.id,
              updatedAt: new Date(),
            },
          });

          // Reassign all secondaries of the losing primary to the oldest primary
          await tx.contact.updateMany({
            where: {
              linkedId: primary.id,
              linkPrecedence: "secondary",
              deletedAt: null,
            },
            data: {
              linkedId: oldestPrimary.id,
              updatedAt: new Date(),
            },
          });
        }
      }

      // Check if the new email/phoneNumber pair provides new information
      const allEmails = new Set([...primaryContacts.map(c => c.email), ...secondaryContacts.map(c => c.email)].filter(Boolean));
      const allPhoneNumbers = new Set([...primaryContacts.map(c => c.phoneNumber), ...secondaryContacts.map(c => c.phoneNumber)].filter(Boolean));

      const emailIsNew = email && !allEmails.has(email);
      const phoneIsNew = phoneNumber && !allPhoneNumbers.has(phoneNumber);

      // Only create a new contact if there's new information to add
      if (emailIsNew || phoneIsNew) {
        await tx.contact.create({
          data: {
            email,
            phoneNumber,
            linkPrecedence: "secondary",
            linkedId: oldestPrimary.id,
          },
        });
      }
    });

    // Fetch the final state of the contact group
    const finalPrimary = await prisma.contact.findUnique({
      where: { id: oldestPrimary.id },
    });

    const finalSecondaries = await prisma.contact.findMany({
      where: {
        linkedId: oldestPrimary.id,
        linkPrecedence: "secondary",
        deletedAt: null,
      },
    });

    // Build the response
    const emails = new Set([finalPrimary.email, ...finalSecondaries.map(c => c.email)].filter(Boolean));
    const phoneNumbers = new Set([finalPrimary.phoneNumber, ...finalSecondaries.map(c => c.phoneNumber)].filter(Boolean));
    const secondaryContactIds = finalSecondaries.map(c => c.id).sort((a, b) => a - b);

    return res.status(200).json({
      contact: {
        primaryContactId: oldestPrimary.id,
        emails: Array.from(emails),
        phoneNumbers: Array.from(phoneNumbers),
        secondaryContactIds,
      },
    });

  } catch (error) {
    console.error("Error in /identify:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Define the POST route for /identify
router.post('/', identify);

// Export the router for use in server.js with app.use('/identify', identifyRoutes)
module.exports = router;