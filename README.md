# caca's Tarkov Tracker

**Version:** 0.1.0-beta

> **Vibe Coded** - This project was vibe coded from scratch. If you want to use this, keep this in mind.

A comprehensive quest tracking application for Escape from Tarkov, built with Next.js and Tamagui.

## 📋 About

caca's Tarkov Tracker helps players manage their quest progress in Escape from Tarkov. Track quests, view dependencies, and plan your progression with an interactive quest graph. This application uses data from the Tarkov.dev API, which is licensed under GNU GPLv3.

## 🚀 Features

- 📊 **Quest Tracking** - Track your progress across all traders
- 🗺️ **Map Filtering** - Filter quests by location with interactive map
- 📈 **Quest Graph** - Visualize quest dependencies with an interactive graph (using React Flow)
- 🎯 **Level Filtering** - See only available quests based on your level
- ✅ **Progress Saving** - Save your progress and completed quests to MongoDB
- 🔄 **Real-time Updates** - Daily data sync with Tarkov.dev API
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🌙 **Dark Theme** - Easy on the eyes
- 👤 **User Accounts** - Save your progress with username/password authentication
- 🔐 **Admin Panel** - Admin users can refresh data from the API

## 🛠️ Tech Stack

- **Next.js 16** - React Server Components and App Router
- **Tamagui** - Modern UI component library
- **TypeScript** - Type-safe code
- **MongoDB** - Data storage
- **React Flow** - Interactive graph visualization
- **GraphQL** - Data fetching from Tarkov.dev API
- **Dagre** - Automatic graph layout algorithm

## 📦 Installation

### Prerequisites

- Node.js 18+ 
- MongoDB (local or Atlas)
- npm or yarn

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd tarkovquest

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your MongoDB connection string

# Generate GraphQL types
npm run generate:graphql

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file in the root directory:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=tarkovquest
```

For MongoDB Atlas:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB_NAME=tarkovquest
```

## 📖 Usage

1. **Register/Login** - Create an account to save your progress
2. **Set Your Level** - Enter your player level to see available quests
3. **Filter by Trader** - Select a trader to see their quests
4. **Filter by Map** - Click on the map to filter quests by location
5. **View Quest Graph** - Navigate to the graph page to see quest dependencies
6. **Mark Complete** - Click on quest cards to mark them as complete

## 🏗️ Project Structure

```
tarkovquest/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   └── tarkov/       # Tarkov data endpoints
│   ├── components/       # React components
│   │   ├── Footer.tsx    # Footer with version and license
│   │   ├── QuestCard.tsx # Quest card component
│   │   ├── QuestNode.tsx # Graph node component
│   │   └── ...
│   ├── graph/            # Quest graph page
│   ├── login/            # Login page
│   └── page.tsx          # Main page
├── lib/
│   ├── db/               # Database operations
│   ├── graphql/          # GraphQL utilities
│   ├── types/            # Type definitions
│   └── utils/            # Utility functions
├── public/               # Static assets
│   ├── logo.png          # Application logo
│   ├── favicon.ico       # Favicon
│   └── full_map.jpeg     # Tarkov map image
├── LICENSE               # GNU GPLv3 License
└── README.md             # This file
```

## 📚 API Documentation

### Tarkov Data API

- `GET /api/tarkov/data` - Get cached quest data (public)
- `GET /api/tarkov/fetch` - Fetch and cache data (admin only)
- `GET /api/tarkov/status` - Check fetch status
- `GET /api/tarkov/traders` - Get trader data

### Authentication API

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/user` - Get user data
- `PUT /api/auth/progress` - Save user progress

## 🔄 Data Fetching

The application fetches quest data from [Tarkov.dev API](https://api.tarkov.dev/), which is licensed under GNU GPLv3. Data is cached for 24 hours to reduce API load. Only admin users can refresh the data cache.

### Generate GraphQL Types

When the API schema changes, regenerate types:

```bash
npm run generate:graphql
```

## 🚢 Deployment

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables for Production

Make sure to set these in your hosting platform:

- `MONGODB_URI` - MongoDB connection string (required)
- `MONGODB_DB_NAME` - Database name (optional, defaults to "tarkovquest")

### Deploy to Vercel

```bash
vercel
```

Make sure to add your environment variables in the Vercel dashboard.

## 📝 License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

**Important:** This project uses data from [Tarkov.dev API](https://api.tarkov.dev/), which is also licensed under GNU GPLv3. You must comply with the GPLv3 license terms when using or distributing this application.

See [LICENSE](LICENSE) file for the full license text.

## 🙏 Acknowledgments

- [Tarkov.dev API](https://api.tarkov.dev/) - Quest data source (GNU GPLv3 licensed)
- [Escape from Tarkov](https://www.escapefromtarkov.com/) - Game by Battlestate Games
- [React Flow](https://reactflow.dev/) - Graph visualization library
- [Tamagui](https://tamagui.dev/) - UI component library

## 🔗 Links

- [Tarkov.dev API Documentation](https://api.tarkov.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tamagui Documentation](https://tamagui.dev/docs)
- [GNU GPLv3 License](https://www.gnu.org/licenses/gpl-3.0.html)

## 📧 Contact

For issues, questions, or contributions, please open an issue on GitHub.

---

**Version:** 0.1.0-beta  
**License:** GNU GPLv3  
**Last Updated:** 2025
