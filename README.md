<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c2b44218-2f90-40ac-a336-0dd6d0b276b4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploying Backend Functions to Convex Cloud

This project is set up with an automated GitHub Actions pipeline (`.github/workflows/convex.yml`) to deploy your backend functions to Convex Cloud whenever you push code changes to the `main` or `master` branch.

To complete the setup:
1. Make sure you have added `CONVEX_DEPLOY_KEY` to your GitHub Repository Secrets (done!).
2. Commit and push any code change from your Google AI Studio dashboard (using the GitHub tab on the right) to trigger the Action and deploy your backend.

