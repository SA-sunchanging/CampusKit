import { AuthModule } from '@app/common';
import { Module } from '@nestjs/common';
import { CalendarGrpcController } from './calendar.grpc-controller.js';
import { CalendarService } from './calendar.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CalendarGrpcController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
