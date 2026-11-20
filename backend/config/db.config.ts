import {
  MongooseModuleOptions,
  MongooseOptionsFactory,
} from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { CustomConfigService } from 'src/common/services';

dotenv.config();
dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

@Injectable()
export class DatabaseConfigService implements MongooseOptionsFactory {
  createMongooseOptions(): MongooseModuleOptions {
    const directUri = (process.env.MONGODB_URI || process.env.MONGO_URI)?.trim();

    if (directUri) {
      return {
        uri: directUri,
      };
    }

    const mongoDBConfig = CustomConfigService.PROPERTIES?.mongoDBConfig;
    if (mongoDBConfig) {
      const { username, password, host, port, database } = mongoDBConfig;
      const isAtlas = host?.includes('mongodb.net');
      const authPart = username && password ? `${username}:${password}@` : '';

      const mongodbConnectionUrl = isAtlas
        ? `mongodb+srv://${authPart}${host}/${database}`
        : `mongodb://${authPart}${host}${port ? ':' + port : ''}/${database}`;

      return {
        uri: mongodbConnectionUrl,
      };
    }

    return {
      uri: 'mongodb://localhost:27017/social_media_db',
    };
  }
}
