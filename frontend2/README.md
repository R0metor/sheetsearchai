# SheetSearch AI

An AI-powered RAG assistant that connects to Google Sheets and lets users ask natural language questions about spreadsheet data.

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI primitives (Button, Card, Badge)
│   ├── AnimatedBackground.jsx
│   ├── FloatingCells.jsx
│   └── CommandPalette.jsx
├── layout/
│   ├── Navbar.jsx
│   ├── Sidebar.jsx
│   └── DashboardHeader.jsx
├── pages/
│   ├── LandingPage.jsx
│   ├── DashboardPage.jsx
│   ├── ChatPage.jsx
│   └── AnalyticsPage.jsx
├── data/
│   └── constants.js     # Seed data & config
├── App.jsx              # Root component & routing
├── main.jsx             # Entry point
└── index.css            # Tailwind + custom animations
```

## Features

- 4 fully designed pages (Landing, Dashboard, Chat, Analytics)
- Dark mode toggle
- Command palette (Ctrl+K / Cmd+K)
- Collapsible sidebar
- AI chat with typing indicator & message streaming
- Table and code block rendering in chat
- Recharts analytics with area, bar, and line charts
- Glassmorphism, animated backgrounds, floating cells
- Fully responsive

## Tech Stack

- React 18
- Vite
- TailwindCSS 3
- Recharts
- Lucide React Icons
