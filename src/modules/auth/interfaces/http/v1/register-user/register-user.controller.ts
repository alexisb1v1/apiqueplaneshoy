import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegisterUserRequestDto } from './dto/register-user.request.dto';
import { RegisterUserResponseDto } from './dto/register-user.response.dto';
import { RegisterUserCommand } from '@auth/application/commands/v1/register-user/register-user.command';
import { matchResult } from '@common/http/match-result';

@ApiTags('Auth')
@Controller('auth')
export class RegisterUserController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo usuario en la plataforma' })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado exitosamente',
    type: RegisterUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 409, description: 'El correo electrónico ya se encuentra registrado' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async execute(@Body() dto: RegisterUserRequestDto): Promise<RegisterUserResponseDto> {
    const result = await this.commandBus.execute(new RegisterUserCommand(dto));

    return matchResult(
      result,
      (response: RegisterUserResponseDto) => response,
      {
        ALREADY_EXISTS: 'El correo electrónico ya está registrado',
      },
    );
  }
}
