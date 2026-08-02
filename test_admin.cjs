const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const app = initializeApp();
getAuth().listUsers(1).then(console.log).catch(console.error);
