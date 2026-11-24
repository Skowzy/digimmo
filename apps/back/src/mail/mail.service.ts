import { Injectable } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { loadEnv } from '../config/env';

export interface SentMail {
  to: string;
  subject: string;
  text: string;
}

export interface MailSender {
  send(mail: SentMail): Promise<void>;
}

/** Jeton d'injection : les tests le remplacent par un fournisseur qui alimente `outbox`. */
export const MAIL_SENDER = Symbol('MAIL_SENDER');

@Injectable()
export class NodemailerMailSender implements MailSender {
  private transport?: Transporter;

  async send(mail: SentMail): Promise<void> {
    const env = loadEnv();
    this.transport ??= createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
    });
    await this.transport.sendMail({ from: env.MAIL_FROM, ...mail });
  }
}
