import { Controller, Post, Body } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateEventDto } from '../dto/create-event.dto';
import { CreateEventCommand } from '../commands/impl/create-event.command';
import { matchResult } from '../../../common/http/match-result';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo evento' })
  @ApiResponse({ status: 201, description: 'Evento creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async create(@Body() dto: CreateEventDto) {
    const result = await this.commandBus.execute(new CreateEventCommand(dto));
    return matchResult(
      result,
      (event) => event,
    );
  }
}
