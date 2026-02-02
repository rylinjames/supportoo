import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log('To view Convex logs:');
console.log('');
console.log('1. Go to: https://dashboard.convex.dev');
console.log('2. Select your project (impartial-echidna-816)');
console.log('3. Click "Logs" in the sidebar');
console.log('4. Filter for "syncProducts" or look for recent function calls');
console.log('');
console.log('When you sync from the app, you should see:');
console.log('  [syncProducts] Has User Token: true');
console.log('  [syncProducts] Using SDK with userToken + product_types: [\'regular\']');
console.log('');
console.log('If it shows "Has User Token: false", the token is not being passed.');
