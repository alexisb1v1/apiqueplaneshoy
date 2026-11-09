import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordRequestDto {
  @ApiProperty({
    example: 'usuario@ejemplo.com',
    description: 'Correo electrónico registrado del usuario',
  })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  @IsEmail({}, { message: 'El formato del correo electrónico no es válido' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email: string;
}

