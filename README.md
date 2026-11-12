<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f1305e99-d2d0-4258-8c27-0009e722d853

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure `VITE_FIREBASE_API_KEY` for the existing Firebase project.
3. Run `netlify dev --port 8889` to use the frontend and server together.

The AI assistant runs on Netlify Server using Netlify AI Gateway; no AI key belongs in the browser. Deployments use Node.js 24. Run `npm run lint` to validate TypeScript.
