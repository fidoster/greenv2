# 🚀 Deployment Guide - GitHub + Vercel

This guide will help you push your GreenBot project to GitHub and deploy it on Vercel.

## Step 1: Create GitHub Repository

### Option A: Using GitHub CLI (Recommended)

If you have GitHub CLI installed:

```bash
gh auth login
gh repo create greenbot --public --source=. --remote=origin --push
```

### Option B: Using GitHub Website

1. Go to [https://github.com/new](https://github.com/new)
2. Fill in the details:
   - **Repository name**: `greenbot` (or your preferred name)
   - **Description**: "AI-powered environmental chat assistant with multiple sustainability-focused personas"
   - **Visibility**: Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
3. Click "Create repository"

## Step 2: Push to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
# Add the remote repository
git remote add origin https://github.com/YOUR_USERNAME/greenbot.git

# Verify the remote was added
git remote -v

# Push your code
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Verify Upload

Go to your GitHub repository URL to verify all files were uploaded successfully.

## Step 3: Deploy to Vercel

### 3.1 Sign Up / Log In to Vercel

1. Go to [https://vercel.com](https://vercel.com)
2. Sign up with GitHub (recommended)
3. Authorize Vercel to access your GitHub repositories

### 3.2 Import Your Project

1. Click "**Add New...**" → "**Project**"
2. Find your `greenbot` repository in the list
3. Click "**Import**"

### 3.3 Configure Project

**Framework Preset**: Vite (should be auto-detected)

**Build and Output Settings**:
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

**Environment Variables** (click "Add"):

```
VITE_SUPABASE_URL=https://jbdhlcxnitedyrbsiitb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZGhsY3huaXRlZHlyYnNpaXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0ODEzMjUsImV4cCI6MjA3NjA1NzMyNX0.nIq5wFexQNymv4ZBHP_uWZQqqpThrdkO2wwdymCReOA
```

### 3.4 Deploy

1. Click "**Deploy**"
2. Wait for the build to complete (usually 1-2 minutes)
3. Once done, you'll get a URL like: `https://greenbot-xxx.vercel.app`

## Step 4: Configure Custom Domain (Optional)

If you want a custom domain:

1. In Vercel dashboard, go to your project
2. Click "**Settings**" → "**Domains**"
3. Add your domain
4. Follow the DNS configuration instructions

## Step 5: Verify Deployment

1. Visit your Vercel URL
2. Try to sign up/log in
3. Go to `/admin` and add an API key
4. Test the chat functionality

## Troubleshooting

### Build Fails

**Error**: "Cannot find module"
- **Solution**: Make sure all dependencies are in `package.json`, commit and push again

**Error**: TypeScript errors
- **Solution**: Run `npm run build` locally first to fix errors

### App Loads But Chat Doesn't Work

**Issue**: API calls failing
- **Solution**: Make sure Edge Function is deployed:
  ```bash
  npx supabase functions deploy ai-chat
  ```

**Issue**: "No API keys configured"
- **Solution**:
  1. Visit your deployed app at `/admin`
  2. Add your OpenAI/DeepSeek/Grok API key
  3. Test the connection

### Environment Variables Not Working

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify both variables are added correctly
3. If you change them, you need to redeploy:
   - Go to Deployments
   - Click "..." on the latest deployment
   - Click "Redeploy"

## Continuous Deployment

Once set up, Vercel automatically deploys when you push to GitHub:

```bash
# Make changes to your code
git add .
git commit -m "Your commit message"
git push

# Vercel will automatically rebuild and deploy!
```

## Multiple Deployments

You can have multiple Vercel projects from the same repository:

1. Create a new project in Vercel
2. Import the same repository
3. Use different environment variables for each deployment
4. Each will have its own URL

## Production Checklist

Before going live:

- [ ] All environment variables set in Vercel
- [ ] Edge Function deployed to Supabase
- [ ] Database tables created with proper RLS policies
- [ ] Tested signup/login flow
- [ ] Tested API key addition at `/admin`
- [ ] Tested chat functionality
- [ ] Tested on mobile devices
- [ ] Custom domain configured (optional)
- [ ] Analytics set up (optional)

## Useful Commands

```bash
# Check git status
git status

# View commit history
git log --oneline

# View remote repositories
git remote -v

# Pull latest changes
git pull origin main

# Create and switch to new branch
git checkout -b feature-name

# Push new branch to GitHub
git push -u origin feature-name
```

## Next Steps

1. **Set up analytics**: Add Vercel Analytics or Google Analytics
2. **Monitor performance**: Use Vercel Speed Insights
3. **Set up monitoring**: Use Sentry or similar for error tracking
4. **Configure backups**: Set up Supabase backups
5. **Add CI/CD**: Set up automated testing

## Support

- **GitHub Issues**: Report bugs or request features
- **Vercel Support**: [https://vercel.com/support](https://vercel.com/support)
- **Supabase Docs**: [https://supabase.com/docs](https://supabase.com/docs)

---

Happy deploying! 🚀
