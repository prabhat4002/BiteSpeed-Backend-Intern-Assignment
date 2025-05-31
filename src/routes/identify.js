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
        // Find the primary contact (earliest created with linkPrecedence: "primary")
        primaryContact = existingContacts.reduce((earliest, contact) => {
          if (contact.linkPrecedence === 'primary' && (!earliest || contact.createdAt < earliest.createdAt)) {
            return contact;
          }
          return earliest || contact;
        }, null);

        // Handle other contacts: merge primaries or link secondaries
        const otherContacts = existingContacts.filter(c => c.id !== primaryContact.id);
        for (const contact of otherContacts) {
          if (contact.linkPrecedence === 'primary') {
            // If another primary is found, demote it to secondary and link to the earliest primary
            await prisma.contact.update({
              where: { id: contact.id },
              data: {
                linkPrecedence: 'secondary',
                linkedId: primaryContact.id,
              },
            });
            secondaryContacts.push(contact.id);
          } else {
            // Already a secondary contact, just add its ID to the list
            secondaryContacts.push(contact.id);
          }
        }

        // Check if the request contains new data (new combination of email/phoneNumber)
        const hasNewData = !existingContacts.some(c => c.email === email && c.phoneNumber === phoneNumber);
        if (hasNewData) {
          // Create a new secondary contact if the combination is new
          const newContact = await prisma.contact.create({
            data: {
              email,
              phoneNumber,
              linkPrecedence: 'secondary',
              linkedId: primaryContact.id,
            },
          });
          secondaryContacts.push(newContact.id);
        }
      }

      // Fetch all related contacts (primary and its secondaries) for the response
      const relatedContacts = await prisma.contact.findMany({
        where: {
          OR: [
            { id: primaryContact.id },
            { linkedId: primaryContact.id },
          ],
          deletedAt: null,
        },
      });

      // Prepare the response: consolidate emails, phone numbers, and secondary IDs
      const emails = [...new Set(relatedContacts.map(c => c.email).filter(e => e))];
      const phoneNumbers = [...new Set(relatedContacts.map(c => c.phoneNumber).filter(p => p))];
      const secondaryContactIds = relatedContacts
        .filter(c => c.id !== primaryContact.id)
        .map(c => c.id);

      // Ensure primary contact's email and phone number are first in their arrays
      if (primaryContact.email) {
        const index = emails.indexOf(primaryContact.email);
        if (index !== -1) {
          emails.splice(index, 1);
          emails.unshift(primaryContact.email);
        }
      }
      if (primaryContact.phoneNumber) {
        const index = phoneNumbers.indexOf(primaryContact.phoneNumber);
        if (index !== -1) {
          phoneNumbers.splice(index, 1);
          phoneNumbers.unshift(primaryContact.phoneNumber);
        }
      }

      return {
        contact: {
          primaryContactId: primaryContact.id,
          emails,
          phoneNumbers,
          secondaryContactIds,
        },
      };
    });

    // Return the response with HTTP 200 status
    res.status(200).json(result);
  } catch (error) {
    // Handle any errors during processing
    console.error('Error in /identify:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;