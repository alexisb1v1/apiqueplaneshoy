import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginUserRequestDto {
  @ApiProperty({
    description: 'Correo electrónico registrado del usuario',
    example: 'alexis@queplaneshoy.com',
  })
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'El formato del correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;

  @ApiProperty({
    description: 'Contraseña de la cuenta',
    example: 'Planes2026!',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password: string;
}
