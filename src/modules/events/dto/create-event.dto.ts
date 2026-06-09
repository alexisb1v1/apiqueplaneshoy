import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString, IsNumber, Min } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Concierto de Rock' })
  @IsString()
  @IsNotEmpty()
  readonly title: string;

  @ApiProperty({ example: 'Un concierto increíble en vivo', required: false })
  @IsString()
  @IsOptional()
  readonly description?: string;

  @ApiProperty({ example: '2026-07-15T20:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  readonly date: string;

  @ApiProperty({ example: 'Estadio Nacional' })
  @IsString()
  @IsNotEmpty()
  readonly location: string;

  @ApiProperty({ example: 45.50 })
  @IsNumber()
  @Min(0)
  readonly price: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(1)
  readonly capacity: number;
}
