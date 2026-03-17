# Codev Template

This is a Codev template project that includes:

1. Next.js with Pages Router
2. Tailwind CSS Framework
3. Context for global state management

## Features

- **Next.js Pages Router**: Utilizes the traditional routing system of Next.js for easy navigation and page management.
- **Tailwind CSS**: A utility-first CSS framework that provides low-level utility classes to build custom designs quickly and efficiently.
- **Context API**: Implements React's Context API for efficient global state management.

## Getting Started

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run the development server:
   ```
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

## Project Structure

- `pages/`: Contains all the pages of the application
- `components/`: Reusable React components
- `contexts/`: Global state management using Context API
- `hooks/`: Custom React hooks
- `styles/`: Global style (global.css)
- `utils/`: Utility functions and helpers

## Deployment & Supabase (production)

If you see **403** on `auth/v1/user` or **401** on API routes after deploying:

1. In **Supabase Dashboard** → **Authentication** → **URL Configuration**:
   - Set **Site URL** to your production URL (e.g. `https://assetxai.live`).
   - Add your production and Vercel URLs to **Redirect URLs** (e.g. `https://assetxai.live/**`, `https://*.vercel.app/**`).
2. Ensure **NEXT_PUBLIC_SUPABASE_URL** and **NEXT_PUBLIC_SUPABASE_ANON_KEY** are set in your production environment (e.g. Vercel env vars).

This ensures the browser and server can validate the session; otherwise auth and API calls that use `requireAuth` will fail.

## Learn More

To learn more about the technologies used in this template, check out the following resources:

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Context API](https://reactjs.org/docs/context.html)
