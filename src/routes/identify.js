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

      let primaryContactId = null;
      if (initialMatches.length > 0) {
        const firstMatch = initialMatches[0];
        primaryContactId = firstMatch.linkPrecedence === 'primary' ? firstMatch.id : firstMatch.linkedId;
      }

      let existingContacts = [];
      if (primaryContactId) {
        existingContacts = await prisma.contact.findMany({
          where: {
            OR: [
              { id: primaryContactId },
              { linkedId: primaryContactId },
            ],
            deletedAt: null,
          },
        });
      }
      console.log('Existing contacts:', existingContacts);

      let primaryContact = null;
      let secondaryContacts = [];

      if (existingContacts.length === 0) {
        primaryContact = await prisma.contact.create({
          data: {
            email,
            phoneNumber,
            linkPrecedence: 'primary',
          },
        });
      } else {
        primaryContact = existingContacts.find(c => c.linkPrecedence === 'primary');
        console.log('Primary contact:', primaryContact);

        const otherContacts = existingContacts.filter(c => c.id !== primaryContact.id);
        for (const contact of otherContacts) {
          if (contact.linkPrecedence === 'primary') {
            await prisma.contact.update({
              where: { id: contact.id },
              data: {
                linkPrecedence: 'secondary',
                linkedId: primaryContact.id,
              },
            });
            secondaryContacts.push(contact.id);
          } else {
            secondaryContacts.push(contact.id);
          }
        }

        const hasNewData =
          (email && !existingContacts.some(c => c.email === email)) ||
          (phoneNumber && !existingContacts.some(c => c.phoneNumber === phoneNumber));
        console.log('hasNewData:', hasNewData, 'Input:', { email, phoneNumber });

        if (hasNewData) {
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

      const relatedContacts = await prisma.contact.findMany({
        where: {
          OR: [
            { id: primaryContact.id },
            { linkedId: primaryContact.id },
          ],
          deletedAt: null,
        },
      });

      const emails = [...new Set(relatedContacts.map(c => c.email).filter(e => e))];
      const phoneNumbers = [...new Set(relatedContacts.map(c => c.phoneNumber).filter(p => p))];
      const secondaryContactIds = relatedContacts
        .filter(c => c.id !== primaryContact.id)
        .map(c => c.id);

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
          primaryContactId: primaryContact.id,
          emails,
          phoneNumbers,
          secondaryContactIds,
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