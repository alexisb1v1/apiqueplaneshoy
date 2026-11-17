import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { TicketPdfService } from './ticket-pdf.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MailService, TicketPdfService],
  exports: [MailService, TicketPdfService],
})
export class MailModule {}

