import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { BlockStorageService } from './block-storage.service';

@Controller('storage/block')
export class BlockStorageController {
  constructor(private readonly blockService: BlockStorageService) {}

  @Get('info')
  getInfo() {
    return this.blockService.getDiskInfo();
  }

  @Get(':lba')
  readBlock(
    @Param('lba', ParseIntPipe) lba: number,
    @Query('offset') offset?: string,
    @Query('length') length?: string,
  ) {
    return this.blockService.readBlock(
      lba,
      offset ? Number(offset) : 0,
      length ? Number(length) : 256,
    );
  }

  @Put(':lba')
  writeBlock(
    @Param('lba', ParseIntPipe) lba: number,
    @Body()
    body: {
      data: string;
      offsetInBlock?: number;
      overwriteBlock?: boolean;
    },
  ) {
    return this.blockService.writeBlock(
      lba,
      body?.data ?? '',
      Number(body?.offsetInBlock ?? 0),
      Boolean(body?.overwriteBlock),
    );
  }

  @Post('write-multi')
  writeMulti(@Body() body: { startLba: number; data: string }) {
    return this.blockService.writeMultiBlock(
      Number(body?.startLba ?? 0),
      body?.data ?? '',
    );
  }

  @Delete(':lba')
  eraseBlock(@Param('lba', ParseIntPipe) lba: number) {
    return this.blockService.eraseBlock(lba);
  }

  @Post('format')
  formatDisk() {
    return this.blockService.formatDisk();
  }
}
