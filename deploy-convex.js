import { execSync } from 'child_process';
// Deploy Convex Backend

const deployKey = process.env.CONVEX_DEPLOY_KEY;

if (deployKey) {
  console.log('----------------------------------------------------');
  console.log('🚀 Convex Deploy Key detected. Attempting backend deployment...');
  console.log('----------------------------------------------------');
  try {
    execSync('npx convex deploy --yes', { stdio: 'inherit' });
    console.log('----------------------------------------------------');
    console.log('✅ Convex deployment succeeded!');
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('----------------------------------------------------');
    console.error('⚠️ Warning: Convex deployment failed.');
    console.error(error.message || error);
    console.error('Continuing build process anyway so that deployment succeeds...');
    console.error('----------------------------------------------------');
    // Exit with 0 to ensure that Vercel build does not fail and can complete deployment
    process.exit(0);
  }
} else {
  console.log('ℹ️ No CONVEX_DEPLOY_KEY set. Skipping Convex deployment.');
}
