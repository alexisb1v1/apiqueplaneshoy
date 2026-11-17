import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GoogleCallbackRequestDto {
  @ApiProperty({
    description: 'Código de autorización devuelto por Google en /auth/google/callback',
  })
  @IsString({ message: 'El código de autorización debe ser una cadena válida' })
  @IsNotEmpty({ message: 'El código de autorización es obligatorio' })
  @MaxLength(2048, { message: 'El código de autorización excede el tamaño permitido' })
  code: string;

  @ApiProperty({
    description: 'Token state anti-CSRF generado al iniciar el flujo OAuth',
  })
  @IsString({ message: 'El parámetro state debe ser una cadena válida' })
  @IsNotEmpty({ message: 'El parámetro state es obligatorio' })
  @MaxLength(256, { message: 'El parámetro state excede el tamaño permitido' })
  state: string;
}

