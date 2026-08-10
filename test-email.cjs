const nodemailer = require('nodemailer');
async function test() {
  console.log("User:", process.env.GMAIL_USER);
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000
  });
  try {
    await transporter.verify();
    console.log("VERIFIED");
  } catch (e) {
    console.log("FAILED:", e.message);
  }
}
test();
