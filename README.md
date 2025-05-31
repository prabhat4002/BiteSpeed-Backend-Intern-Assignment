# Bitespeed Identity Reconciliation Service 🚀
Hosted endpoint: https://bitespeed-identity-new.onrender.com/identify
---

## 🛠️ Stack

- **Backend**: Node.js, Express, JavaScript  
- **Database**: PostgreSQL with Prisma ORM  
- **Deployment**: Render  
- **Version Control**: Git, GitHub  

---

## 📋 Overview

This project implements Bitespeed's Identity Reconciliation service, a web API that links customer contacts based on `email` and/or `phoneNumber`. It uses a PostgreSQL database to manage primary and secondary contacts, ensuring data consistency. The `POST /identify` endpoint processes JSON requests, consolidates contact information, and returns a unified customer identity.

Built with Node.js, Express, and TypeScript, the service is deployed on Render and handles various identity reconciliation cases as per the assessment requirements.

---

## ✨ Features

- **Endpoint**: `POST /identify` accepts JSON payloads with optional `email` and/or `phoneNumber`.
- **Database**: Stores contacts with fields like `id`, `phoneNumber`, `email`, `linkedId`, `linkPrecedence`.
- **Logic**:
  - Creates primary contacts for unique data.
  - Links existing contacts, demoting later primaries to secondary.
  - Creates secondary contacts for new combinations.
- **Response**: Returns consolidated `primaryContactId`, `emails`, `phoneNumbers`, and `secondaryContactIds`.
- **Error Handling**: Returns 400 for invalid inputs, 500 for server errors.

---

## 📦 Prerequisites

- **Node.js**: v18 or higher
- **PostgreSQL**: v14 or higher
- **Render**: Account for deployment
- **Git**: For version control

---

## 🛠️ Setup Instructions

1. **Clone the Repository**:

    ```bash
    git clone https://github.com/prabhat4002/BiteSpeed-Backend-Intern-Assignment
    cd BiteSpeed-Backend-Intern-Assignment
    ```

2. **Install Dependencies**:

    ```bash
    npm install
    ```

3. **Configure Environment Variables**:
   - Create a `.env` file in the root:

    ```env
    DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>
    NODE_ENV=development
    PORT=5003
    ```

4. **Run Database Migrations**:

    ```bash
    npm run prisma:generate
    npm run migrate
    ```

5. **Start the Server**:
   - **Development**:

    ```bash
    npm run dev
    ```

   - **Production**:

    ```bash
    npm start
    ```

6. **Test Locally**:
   - Server runs on `http://localhost:5003`.
   - Use Postman to test `POST http://localhost:5003/identify`.

---

## 🚀 Deployment

**Hosted on Render**:  
🔗 `https://your-render-app.onrender.com/identify`

### Steps to Deploy

1. **Push to GitHub**:

    ```bash
    git add .
    git commit -m "Initial commit"
    git push origin main
    ```

2. **Configure Render**:
   - Create a Web Service in Render.
   - Link your GitHub repository.
   - Set the following:
     - **Build Command**: `npm run build`
     - **Start Command**: `npm start`
     - **Environment Variables**:

    ```env
    DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>
    NODE_ENV=production
    PORT=5003
    ```

3. **Deploy**:
   - Trigger a manual deploy in Render.
   - Check logs to confirm the service is running.

---

## 📖 API Documentation

### POST /identify

**Description**: Reconciles customer contacts based on `email` and/or `phoneNumber`.

**Request**:
- **Method**: POST
- **URL**: `/identify`
- **Content-Type**: `application/json`
- **Body**:

    ```json
    {
      "email"?: string,
      "phoneNumber"?: string
    }
    ```

  - At least one field is required.
  - `email`: Must be a valid email (e.g., `user@example.com`).
  - `phoneNumber`: Must be numeric (e.g., `1234567890`).

**Response**:
- **Status**: 200 OK
- **Body**:

    ```json
    {
      "contact": {
        "primaryContactId": number,
        "emails": string[],
        "phoneNumbers": string[],
        "secondaryContactIds": number[]
      }
    }
    ```

**Error Responses**:
- **400 Bad Request**:

    ```json
    { "error": "At least one of email or phoneNumber is required" }
    ```

    ```json
    { "error": "Invalid email format" }
    ```

    ```json
    { "error": "Phone number must be numeric" }
    ```

- **500 Internal Server Error**:

    ```json
    { "error": "Internal server error", "details": string }
    ```

**Example**:
- **Request**:

    ```json
    {
      "email": "mcfly@hillvalley.edu",
      "phoneNumber": "123456"
    }
    ```

- **Response**:

    ```json
    {
      "contact": {
        "primaryContactId": 1,
        "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
        "phoneNumbers": ["123456"],
        "secondaryContactIds": [2]
      }
    }
    ```

---

## 💻 Implementation Details

- **Database Schema**:

    ```tsx
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
    ```

- **Cases Handled**:
  1. **Unique Email/Phone**: Creates a new primary contact.
  2. **Existing Email/Phone**:
     - **Same Contact**: Returns primary contact details.
     - **Different Contacts**:
       - One primary, one secondary: Links secondary to primary.
       - Both primary/secondary: Links to earliest primary, demotes others.
  3. **Partially Unique**: Creates a secondary contact linked to the primary.

- **Key Logic**:
  - Uses Prisma transactions for atomicity.
  - Prioritizes primary contact’s email/phone in response arrays.
  - Includes debug logs (`Existing contacts`, `Primary contact`, `hasNewData`) for troubleshooting.

---

## 📦 Submission

- **Repository**: [https://github.com/prabhat4002/BiteSpeed-Backend-Intern-Assignment](https://github.com/prabhat4002/BiteSpeed-Backend-Intern-Assignment)
- **Hosted Endpoint**: [https://bitespeed-identity-new.onrender.com/identify ](https://bitespeed-identity-new.onrender.com/identify )
- **Commits**: Descriptive and incremental (e.g., "node.js setup", "Update Readme").
- **Notes**:
  - Requests use JSON body (not form-data).
  - Hosted on Render free tier.
  - Response format aligns with Bitespeed requirements.

---


---

