Hosted endpoint: https://bitespeed-identity-new.onrender.com/identify
Bitespeed Identity Reconciliation Service
Stack

Backend: Node.js, Express, TypeScript
Database: PostgreSQL with Prisma ORM
Deployment: Render
Version Control: Git, GitHub

Overview
This project implements Bitespeed's Identity Reconciliation web service. It identifies and links customer contacts based on email and/or phoneNumber, using a PostgreSQL database to manage primary and secondary contacts. The POST /identify endpoint processes JSON requests, consolidates contact data, and returns a unified customer identity.
The service handles cases where contacts are unique, exist on the same or different records, or partially match, as specified in the assessment. It is deployed on Render and uses TypeScript for type safety, Prisma for database operations, and Express for routing.
Features

Endpoint: POST /identify accepts JSON payloads with optional email and/or phoneNumber.
Database: Stores contacts with fields: id, phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt, deletedAt.
Logic:
Creates primary contacts for unique email/phoneNumber.
Links matching contacts, demoting later primaries to secondary.
Creates secondary contacts for new data combinations.


Response: Returns primaryContactId, emails, phoneNumbers, and secondaryContactIds.
Error Handling: Returns 400 for invalid inputs, 500 for server errors.

Prerequisites

Node.js v18+
PostgreSQL v14+
Render account
Git

Setup Instructions

Clone the Repository:
git clone https://github.com/your-username/bitespeed-identity-reconciliation.git
cd bitespeed-identity-reconciliation


Install Dependencies:
npm install


Configure Environment Variables:

Create a .env file:DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>
NODE_ENV=development
PORT=5003




Run Database Migrations:
npm run prisma:generate
npm run migrate


Start the Server:

Development:npm run dev


Production:npm start




Test Locally:

Server runs on http://localhost:5003.
Use Postman to test POST http://localhost:5003/identify.



Deployment
Hosted on Render at: https://your-render-app.onrender.com/identify
Deployment Steps

Push to GitHub:
git add .
git commit -m "Initial commit"
git push origin main


Configure Render:

Create a Web Service in Render.
Link your GitHub repository.
Set:
Build Command: npm run build
Start Command: npm start
Environment Variables:DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>
NODE_ENV=production
PORT=5003






Deploy:

Trigger a deploy in Render.
Check logs to confirm the service is running.



API Documentation
POST /identify
Description: Reconciles customer contacts based on email and/or phoneNumber.
Request:

Method: POST
URL: /identify
Content-Type: application/json
Body:{
  "email"?: string,
  "phoneNumber"?: string
}


At least one field required.
email: Valid email (e.g., user@example.com).
phoneNumber: Numeric string (e.g., 1234567890).



Response:

Status: 200 OK
Body:{
  "contact": {
    "primaryContactId": number,
    "emails": string[],
    "phoneNumbers": string[],
    "secondaryContactIds": number[]
  }
}



Errors:

400 Bad Request:{ "error": "At least one of email or phoneNumber is required" }

{ "error": "Invalid email format" }

{ "error": "Phone number must be numeric" }


500 Internal Server Error:{ "error": "Internal server error", "details": string }



Example:

Request:{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}


Response:{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}



Implementation Details

Database Schema:
model Contact {
  id            Int       @id @default(autoincrement())
  phoneNumber   String?
  email         String?
  linkedId      Int?
  linkPrecedence String    // "primary" or "secondary"
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?
}


Cases Handled:

Unique Email/Phone: Creates a primary contact.
Existing Email/Phone:
Same Contact: Returns primary contact details.
Different Contacts:
One primary, one secondary: Links secondary to primary.
Both primary/secondary: Links to earliest primary, demotes others.




Partially Unique: Creates a secondary contact linked to the primary.


Key Logic:

Uses Prisma transactions for atomicity.
Prioritizes primary contact’s email/phone in response arrays.
Debug logs (Existing contacts, Primary contact, hasNewData) aid troubleshooting.



Debugging Current Issues
Observed Response:
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["mcfly@hillvalley.edu", "lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2, 3, 4]
  }
}


Issues:

Email Order: Primary contact’s email (lorraine@hillvalley.edu) should be first. Likely due to incorrect primary contact email in the database.
Secondary IDs: [2, 3, 4] is unexpected (should be [23] per example). Caused by prior requests creating extra secondary contacts.
Formatting: Multiline secondaryContactIds is valid JSON.


Steps:

Check Logs:
Redeploy and review Render logs for:
Existing contacts
Primary contact (check email)
hasNewData




Query Database:psql $DATABASE_URL
SELECT * FROM "Contact" WHERE deletedAt IS NULL;


Verify ID 1’s email and IDs 2, 3, 4’s linkedId and linkPrecedence.


Reset Database (optional):
Delete/recreate PostgreSQL service in Render.
Redeploy with npm run build.


Retest:{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": null
}





Submission

Repository: https://github.com/prabhat4002/BiteSpeed-Backend-Intern-Assignment
Endpoint: https://bitespeed-identity-new.onrender.com/identify
Commits: Descriptive, incremental (e.g., "Add identify endpoint", "Fix hasNewData").
Notes:
Uses JSON body for requests.
Hosted on Render free tier.
Response format aligns with Bitespeed requirements.


