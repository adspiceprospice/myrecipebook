# My Recipe Book

An AI-powered recipe management application built with Next.js 15, Prisma ORM, and Google Gemini AI. Create, manage, and cook with intelligent recipe assistance.

## Features

- 📝 **Recipe Management**: Create, edit, and delete recipes with ease
- 🤖 **AI-Powered Generation**: Generate recipes from text, images, URLs, or YouTube videos using Google Gemini
- 🛒 **Smart Shopping Lists**: Automatically generate shopping lists with ingredient scaling
- 🎯 **Cooking Assistant**: Real-time cooking guidance with voice support
- 🔊 **Text-to-Speech**: Listen to cooking instructions
- 🖼️ **Image Storage**: Store recipe images using Vercel Blob
- 💾 **PostgreSQL Database**: Persistent storage with Prisma ORM

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Google Gemini API
- **Storage**: Vercel Blob
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd myrecipebook
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```

   Update the following variables:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/myrecipebook"
   GEMINI_API_KEY="your-gemini-api-key"
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma Client
   npx prisma generate

   # Run migrations
   npx prisma migrate dev --name init

   # (Optional) Open Prisma Studio to view your database
   npx prisma studio
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

1. **Push your code to GitHub**

2. **Import project to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Configure environment variables**

   Add these environment variables in Vercel:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `GEMINI_API_KEY`: Your Google Gemini API key

4. **Set up Vercel Postgres (Optional)**

   If you don't have a PostgreSQL database:
   - Go to your project's Storage tab in Vercel
   - Create a Postgres database
   - The `DATABASE_URL` will be automatically added to your environment variables

5. **Set up Vercel Blob Storage**
   - Go to your project's Storage tab in Vercel
   - Create a Blob store
   - The required tokens will be automatically added

6. **Deploy**
   - Vercel will automatically deploy your application
   - Run database migrations after deployment:
     ```bash
     npx prisma migrate deploy
     ```

## Database Schema

The application uses three main models:

- **Recipe**: Stores recipe information (title, description, servings, images, notes)
- **Ingredient**: Stores ingredients linked to recipes
- **Instruction**: Stores step-by-step cooking instructions

To modify the schema, edit `prisma/schema.prisma` and run:
```bash
npx prisma migrate dev --name your_migration_name
```

## Project Structure

```
myrecipebook/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
├── lib/                   # Utility functions
│   ├── prisma.ts         # Prisma client
│   ├── gemini.ts         # Gemini AI service
│   └── blob.ts           # Blob storage utilities
├── prisma/               # Database schema
│   └── schema.prisma
├── types.ts              # TypeScript types
└── package.json
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npx prisma studio` - Open Prisma Studio
- `npx prisma migrate dev` - Create and apply migrations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
