import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { ObjectStorageService } from './object/object-storage.service';
import { ObjectStorageController } from './object/object-storage.controller';
import { FileStorageService } from './file/file-storage.service';
import { FileStorageController } from './file/file-storage.controller';
import { BlockStorageService } from './block/block-storage.service';
import { BlockStorageController } from './block/block-storage.controller';

@Module({
  controllers: [
    StorageController,
    ObjectStorageController,
    FileStorageController,
    BlockStorageController,
  ],
  providers: [ObjectStorageService, FileStorageService, BlockStorageService],
})
export class StorageModule {}
