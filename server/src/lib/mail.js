import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Add these for server compatibility
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 60000,
  greetingTimeout: 30000,
});

export async function sendEmail({ to, subject, html }) {
  await transporter.sendMail({
    from: `"Sports Replay" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}
