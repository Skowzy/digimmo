import { Module } from '@nestjs/common';
import { MAIL_SENDER, NodemailerMailSender } from './mail.service';

@Module({
  providers: [{ provide: MAIL_SENDER, useClass: NodemailerMailSender }],
  exports: [MAIL_SENDER],
})
export class MailModule {}
