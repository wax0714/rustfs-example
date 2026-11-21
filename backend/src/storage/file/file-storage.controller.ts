import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FileStorageService } from './file-storage.service';

@Controller('storage/file')
export class FileStorageController {
  constructor(private readonly fileService: FileStorageService) {}

  @Get('tree')
  getTree() {
    return this.fileService.getTree();
  }

  @Get('read')
  readFile(@Query('path') filePath: string) {
    return this.fileService.readFile(filePath);
  }

  @Post('mkdir')
  mkdir(@Body() body: { path: string }) {
    if (!body?.path) throw new BadRequestException('path is required');
    return this.fileService.createDirectory(body.path);
  }

  @Post('write')
  writeFile(@Body() body: { path: string; content: string }) {
    if (!body?.path) throw new BadRequestException('path is required');
    return this.fileService.writeFile(body.path, body.content ?? '');
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) throw new BadRequestException('file is required');
    const cleanFolder = (folder || 'uploads').trim().replace(/^\/+|\/+$/g, '');
    const targetPath = cleanFolder ? `${cleanFolder}/${file.originalname}` : file.originalname;
    return this.fileService.writeFile(targetPath, file.buffer);
  }

  @Get('download')
  async downloadFile(@Query('path') filePath: string, @Res() res: Response) {
    const { absPath } = this.fileService.resolveSafePath(filePath);
    return res.sendFile(absPath);
  }

  @Post('append')
  appendFile(@Body() body: { path: string; line: string }) {
    if (!body?.path) throw new BadRequestException('path is required');
    return this.fileService.appendFile(body.path, body.line ?? '');
  }

  @Patch('patch')
  patchFile(@Body() body: { path: string; offset: number; text: string }) {
    if (!body?.path) throw new BadRequestException('path is required');
    return this.fileService.patchFileInPlace(
      body.path,
      Number(body.offset ?? 0),
      body.text ?? '',
    );
  }

  @Post('rename')
  rename(@Body() body: { from: string; to: string }) {
    if (!body?.from || !body?.to) {
      throw new BadRequestException('from and to paths are required');
    }
    return this.fileService.renameItem(body.from, body.to);
  }

  @Delete('item')
  deleteItem(@Query('path') itemPath: string) {
    return this.fileService.deleteItem(itemPath);
  }
}
