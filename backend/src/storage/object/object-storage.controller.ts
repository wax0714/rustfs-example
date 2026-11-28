import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { ObjectStorageService } from './object-storage.service';

@Controller('storage/object')
export class ObjectStorageController {
  constructor(private readonly objectService: ObjectStorageService) { }

  @Get('list')
  list(@Query('prefix') prefix?: string) {
    return this.objectService.listObjects(prefix);
  }

  @Get('item')
  getOne(@Query('key') key: string) {
    return this.objectService.getObject(key);
  }

  @Get('presign')
  async presign(@Query('key') key: string, @Query('expiresIn') expiresIn?: string) {
    const ttl = Math.min(Math.max(Number(expiresIn) || 300, 30), 3600);
    const url = await this.objectService.createPresignedUrl(key, ttl);
    return { key, expiresInSeconds: ttl, presignedUrl: url };
  }

  /**
   * Streams an object directly from RustFS -> NestJS -> Client without buffering in memory.
   * Supports HTTP Range requests (206 Partial Content) for instant video/audio seeking.
   */
  @Get('stream')
  async stream(
    @Query('key') key: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // =========================================================================
    // CODE-ALONG #3 (Step 5): Stream audio/video straight from RustFS (with Range seeking)
    // Uncomment or type this block, save the file, and try Step 5 in the UI!
    // =========================================================================


    res.status(501).json({
      statusCode: 501,
      message:
        'Code-Along #3 not completed yet! Open backend/src/storage/object/object-storage.controller.ts and implement stream().',
    });
  }

  @Post('seed-stream-media')
  seedStreamMedia() {
    return this.objectService.seedStreamableMedia();
  }

  @Post('put')
  putText(
    @Body()
    body: {
      key: string;
      content: string;
      contentType?: string;
      metadata?: Record<string, string>;
    },
  ) {
    if (!body?.key) {
      throw new BadRequestException('key is required');
    }
    const buffer = Buffer.from(body.content ?? '', 'utf-8');
    return this.objectService.putObject(
      body.key,
      buffer,
      body.contentType || 'text/plain; charset=utf-8',
      body.metadata,
    );
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('key') key?: string,
    @Body('metadata') metadataJson?: string,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    let metadata: Record<string, string> = {};
    if (metadataJson) {
      try {
        metadata = JSON.parse(metadataJson);
      } catch {
        throw new BadRequestException('metadata must be valid JSON');
      }
    }
    const targetKey = (key && key.trim()) || `uploads/${file.originalname}`;
    return this.objectService.putObject(
      targetKey,
      file.buffer,
      file.mimetype || 'application/octet-stream',
      metadata,
    );
  }

  @Patch('patch')
  patchObject(@Body() body: { key: string; offset: number; text: string }) {
    if (!body?.key) {
      throw new BadRequestException('key is required');
    }
    return this.objectService.patchObjectByFullRewrite(
      body.key,
      Number(body.offset ?? 0),
      body.text ?? '',
    );
  }

  @Delete('item')
  deleteOne(@Query('key') key: string) {
    return this.objectService.deleteObject(key);
  }
}
