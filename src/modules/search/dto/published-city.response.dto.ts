import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class PublishedCityResponseDto {
  @ApiProperty({
    description: 'Identificador único en mayúsculas de la ciudad',
    example: 'LIMA',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Nombre comercial / legible de la ciudad',
    example: 'Lima',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Código de departamento INEI de 2 dígitos',
    example: '15',
  })
  @Expose()
  departmentCode: string;

  @ApiProperty({
    description: 'Cantidad de eventos actualmente en estado published en esta localidad',
    example: 4,
  })
  @Expose()
  eventCount: number;
}

