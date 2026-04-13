// src/utils/sendMail.ts
import nodemailer, { Transporter } from 'nodemailer';
import config from '../config/env';

interface EmailOptions {
  email: string;
  subject: string;
  message: string;
  html?: string;
}

export const sendMail = async (options: EmailOptions): Promise<void> => {
  const transporter: Transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    service: config.NODE_ENV === 'production' ? undefined : 'gmail', // Use 'gmail' or SMTP details
    auth: {
      user: config.SMTP_MAIL,
      pass: config.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: `Your App Name <${config.SMTP_MAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};