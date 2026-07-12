import { execSync } from 'child_process';

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
    console.error('⚠️ ERROR: Convex deployment failed.');
    console.error(error.message || error);
    console.error('CRITICAL: The backend is out of sync. Deployment stopped.');
    console.error('Please check your CONVEX_DEPLOY_KEY in settings.');
    console.error('----------------------------------------------------');
    process.exit(1);
  }
} else {
  console.log('ℹ️ No CONVEX_DEPLOY_KEY set. Skipping Convex deployment.');
}
