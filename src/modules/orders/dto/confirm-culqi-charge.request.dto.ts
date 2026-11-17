import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

export class Authentication3DSDto {
  @ApiProperty({ example: '05' })
  @IsString()
  @IsNotEmpty()
  eci!: string;

  @ApiProperty({ example: '02010000755f8c81a4db4c848b8c23f6b0196cfd' })
  @IsString()
  @IsNotEmpty()
  xid!: string;

  @ApiProperty({ example: '63617264696e616c636f6d6d6572636561757468' })
  @IsString()
  @IsNotEmpty()
  cavv!: string;

  @ApiProperty({ example: '2.1.0' })
  @IsString()
  @IsNotEmpty()
  protocolVersion!: string;
}

export class ConfirmCulqiChargeRequestDto {
  @ApiProperty({ example: 'c1d2e3f4-5678-90ab-cdef-1234567890ab' })
  @IsNotEmpty({ message: 'El orderPublicUuid es obligatorio' })
  @IsString()
  orderPublicUuid!: string;

  @ApiProperty({ example: 'tkn_test_701ug3CDNJOAt5Q6' })
  @IsNotEmpty({ message: 'El token de Culqi es obligatorio' })
  @IsString()
  tokenId!: string;

  @ApiProperty({ example: 'card', enum: ['card', 'yape', 'transfer', 'cuotealo'], required: false })
  @IsOptional()
  @IsIn(['card', 'yape', 'transfer', 'cuotealo'])
  paymentMethod?: 'card' | 'yape' | 'transfer' | 'cuotealo';

  @ApiProperty({ example: '8019959c-fab1-49eb-bbbe-b846d308d8df', required: false })
  @IsOptional()
  @IsString()
  deviceFingerPrintId?: string;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  installments?: number;

  @ApiProperty({ type: Authentication3DSDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => Authentication3DSDto)
  authentication3DS?: Authentication3DSDto;
}

