import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyResetTokenQueryDto {
  @ApiProperty({
    example: 'a4f89b...',
    description: 'Token efímero de recuperación recibido por correo',
  })
  @IsNotEmpty({ message: 'El token de recuperación es obligatorio' })
  @IsString({ message: 'El token debe ser una cadena válida' })
  @Transform(({ value }: { value: string }) => value?.trim())
  token: string;
}

