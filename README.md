# 🌱 GreenBot - AI-Powered Environmental Assistant

GreenBot is an intelligent chat application focused on environmental sustainability, featuring multiple AI personas specialized in different aspects of eco-conscious living.

## ✨ Features

- 🤖 **Multiple AI Personas**: Chat with specialized environmental assistants
  - GreenBot: General sustainability advisor
  - EcoLife Guide: Sustainable lifestyle choices
  - Waste Wizard: Waste reduction & recycling
  - Nature Navigator: Biodiversity & conservation
  - Power Sage: Energy efficiency
  - Climate Guardian: Climate action

- 🔐 **Secure Authentication**: Built with Supabase Auth
- 💾 **Conversation History**: Save and manage your chats
- 🎨 **Modern UI**: Built with React, TypeScript, and Tailwind CSS
- 🌙 **Dark Mode**: Toggle between light and dark themes
- 📊 **Environmental Impact Tracking**: Monitor your carbon footprint
- 🧪 **Interactive Quizzes**: Test your environmental knowledge
- 🔑 **Flexible API Integration**: Support for OpenAI, DeepSeek, and Grok

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- OpenAI, DeepSeek, or Grok API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/greenbot.git
   cd greenbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase database**

   In your Supabase SQL Editor, add the missing columns:
   ```sql
   ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS service TEXT DEFAULT 'openai';
   ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS description TEXT;
   ```

5. **Deploy Supabase Edge Function**
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy ai-chat
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Add your API keys**
   - Navigate to `/admin` in the app
   - Add your OpenAI, DeepSeek, or Grok API key
   - Test the connection
   - Start chatting!

## 🏗️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Radix UI
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **AI APIs**: OpenAI, DeepSeek, Grok
- **Deployment**: Vercel

## 🚀 Deployment to Vercel

1. **Push to GitHub** (see instructions below)

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Connect your GitHub repository
   - Add environment variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - Deploy!

3. **Deploy Edge Function**
   ```bash
   npx supabase functions deploy ai-chat
   ```

## 📄 License

MIT License

---

Made with 💚 for a sustainable future
