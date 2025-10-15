# 🌱 GreenBot - AI-Powered Environmental Assistant

GreenBot is an intelligent chat application focused on environmental sustainability, featuring multiple AI personas specialized in different aspects of eco-conscious living.

## ✨ Features

### 🤖 Multiple AI Personas
Chat with specialized environmental assistants, each an expert in their field:
- **GreenBot**: General sustainability advisor
- **EcoLife Guide**: Sustainable lifestyle choices and daily eco-habits
- **Waste Wizard**: Waste reduction, recycling, and circular economy
- **Nature Navigator**: Biodiversity, conservation, and ecosystem management
- **Power Sage**: Energy efficiency and renewable energy solutions
- **Climate Guardian**: Climate action and carbon footprint reduction

### 🔐 Security & Authentication
- Secure user authentication powered by Supabase Auth
- API keys stored securely in database (never in browser)
- Row Level Security (RLS) policies for data isolation
- Email tracking for user activity monitoring

### 💬 Smart Chat Features
- Conversation history saved per user
- Switch between different AI personas mid-conversation
- Automatic conversation titles based on content
- Delete and manage your chat history
- Real-time message persistence

### 🎨 Modern User Experience
- Beautiful, responsive UI built with Radix UI components
- Dark mode and light mode support
- Smooth animations and transitions
- Mobile-friendly design
- Accessible keyboard navigation

### 🔑 Flexible AI Provider Support
- **OpenAI** (GPT-4o)
- **DeepSeek** (DeepSeek Chat)
- **Grok** (Grok Beta)
- Easy switching between providers
- Secure API key management at `/admin`

### 🧪 Interactive Learning
- Environmental knowledge quizzes
- Track your learning progress
- Gamified sustainability education

### 📊 User Dashboard
- Manage your API keys
- View conversation statistics
- Monitor AI provider usage

## 🏗️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Radix UI, Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **AI Integration**: OpenAI, DeepSeek, Grok APIs
- **Routing**: React Router v6
- **State Management**: React Hooks
- **Deployment**: Vercel

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- API key from OpenAI, DeepSeek, or Grok

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

   Create a `.env` file:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Add your API keys**
   - Navigate to `/admin` in the app
   - Add your AI provider API key
   - Start chatting with GreenBot!

## 📱 Usage

1. **Sign up** or **Sign in** with your email
2. Go to **Settings** (`/admin`) and add your AI provider API key
3. Choose an AI persona from the sidebar
4. Start chatting about sustainability topics!
5. Your conversations are automatically saved

## 🌟 Key Highlights

- ✅ **Privacy-focused**: Your conversations and API keys are securely stored
- ✅ **Multi-persona AI**: Get specialized advice from different environmental experts
- ✅ **Real-time sync**: Conversations saved instantly across devices
- ✅ **Customizable**: Choose your preferred AI provider
- ✅ **Educational**: Learn about sustainability through interactive quizzes
- ✅ **Open source**: Free to use and modify

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 📄 License

MIT License - Feel free to use this project for your own purposes

---

Made with 💚 for a sustainable future
