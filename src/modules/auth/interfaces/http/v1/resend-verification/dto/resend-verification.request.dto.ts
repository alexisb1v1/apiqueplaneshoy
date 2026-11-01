import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class ResendVerificationRequestDto {
  @ApiProperty({
    description: 'Correo electrónico de la cuenta a la cual reenviar la verificación',
    example: 'alexis@queplaneshoy.com',
  })
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'El formato del correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;
}
