const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

router.post('/', async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'At least one of email or phoneNumber is required' });
  }

  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (email.length > 255) {
      return res.status(400).json({ error: 'Email must not exceed 255 characters' });
    }
  }

  if (phoneNumber) {
    if (!/^\d+$/.test(phoneNumber)) {
      return res.status(400).json({ error: 'Phone number must be numeric' });
    }
    if (phoneNumber.length > 20) {
      return res.status(400).json({ error: 'Phone number must not exceed 20 digits' });
    }
  }

  try {
    const result = await prisma.$transaction(async (prisma) => {
      // Find all contacts that match the email or phone number
      let initialMatches = await prisma.contact.findMany({
        where: {
          OR: [
            { email: email || null },
            { phoneNumber: phoneNumber || null },
          ],
          deletedAt: null,
        },
      });
      console.log('Initial matches:', initialMatches);

      if (initialMatches.length === 0) {
        // No matches, create a new primary contact
        const newContact = await prisma.contact.create({
          data: {
            email,
            phoneNumber,
            linkPrecedence: 'primary',
          },
        });

        const response = {
          contact: {
            primaryContactId: newContact.id,
            emails: [newContact.email].filter(e => e),
            phoneNumbers: [newContact.phoneNumber].filter(p => p),
            secondaryContactIds: [],
          },
        };
        console.log('Response:', response);
        return response;
      }

      // Find all primary contacts among the matches
      const primaryMatches = [];
      for (const match of initialMatches) {
        if (match.linkPrecedence === 'primary') {
          primaryMatches.push(match);
        } else {
          const primary = await prisma.contact.findFirst({
            where: {
              id: match.linkedId,
              deletedAt: null,
            },
          });
          if (primary && !primaryMatches.some(p => p.id === primary.id)) {
            primaryMatches.push(primary);
          }
        }
      }

      // Determine the oldest primary contact
      const oldestPrimary = primaryMatches.reduce((oldest, current) =>
        new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest
      );
      const primaryContactId = oldestPrimary.id;

      // Collect all contacts linked to each primary
      const allRelatedContacts = [];
      for (const primary of primaryMatches) {
        const related = await prisma.contact.findMany({
          where: {
            OR: [
              { id: primary.id },
              { linkedId: primary.id },
            ],
            deletedAt: null,
          },
        });
        allRelatedContacts.push(...related);
      }

      // Remove duplicates by ID
      const uniqueRelatedContacts = Array.from(
        new Map(allRelatedContacts.map(c => [c.id, c])).values()
      );

      // Update all other primaries and their secondaries to link to the oldest primary
      const secondaryContactIds = new Set();
      for (const contact of uniqueRelatedContacts) {
        if (contact.id === primaryContactId) continue;

        if (contact.linkPrecedence === 'primary') {
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              linkPrecedence: 'secondary',
              linkedId: primaryContactId,
              updatedAt: new Date(),
            },
          });
          secondaryContactIds.add(contact.id);

          // Reassign any secondaries of this contact
          await prisma.contact.updateMany({
            where: {
              linkedId: contact.id,
              deletedAt: null,
            },
            data: {
              linkedId: primaryContactId,
              updatedAt: new Date(),
            },
          });

          const secondaries = await prisma.contact.findMany({
            where: {
              linkedId: contact.id,
              deletedAt: null,
            },
          });
          secondaries.forEach(sec => secondaryContactIds.add(sec.id));
        } else if (contact.linkedId !== primaryContactId) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              linkedId: primaryContactId,
              updatedAt: new Date(),
            },
          });
          secondaryContactIds.add(contact.id);
        } else {
          secondaryContactIds.add(contact.id);
        }
      }

      // Check if the input introduces new data
      const allEmails = uniqueRelatedContacts.map(c => c.email).filter(e => e);
      const allPhoneNumbers = uniqueRelatedContacts.map(c => c.phoneNumber).filter(p => p);
      const hasNewData =
        (email && !allEmails.includes(email)) ||
        (phoneNumber && !allPhoneNumbers.includes(phoneNumber));

      if (hasNewData) {
        const newContact = await prisma.contact.create({
          data: {
            email: email && !allEmails.includes(email) ? email : null,
            phoneNumber: phoneNumber && !allPhoneNumbers.includes(phoneNumber) ? phoneNumber : null,
            linkPrecedence: 'secondary',
            linkedId: primaryContactId,
          },
        });
        secondaryContactIds.add(newContact.id);
      }

      // Fetch all contacts linked to the oldest primary for the response
      const finalRelatedContacts = await prisma.contact.findMany({
        where: {
          OR: [
            { id: primaryContactId },
            { linkedId: primaryContactId },
          ],
          deletedAt: null,
        },
      });

      const emails = [...new Set(finalRelatedContacts.map(c => c.email).filter(e => e))];
      const phoneNumbers = [...new Set(finalRelatedContacts.map(c => c.phoneNumber).filter(p => p))];
      const secondaryIds = Array.from(secondaryContactIds).filter(id => id !== primaryContactId);

      // Prioritize the primary contact's email and phone number
      const primaryContact = finalRelatedContacts.find(c => c.id === primaryContactId);
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

      const response = {
        contact: {
          primaryContactId: primaryContactId,
          emails,
          phoneNumbers,
          secondaryContactIds: secondaryIds,
        },
      };
      console.log('Response:', response);
      return response;
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in /identify:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;