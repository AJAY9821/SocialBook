import {
  MongooseModuleOptions,
  MongooseOptionsFactory,
} from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { CustomConfigService } from 'src/common/services';

dotenv.config();

@Injectable()
export class DatabaseConfigService implements MongooseOptionsFactory {
  createMongooseOptions(): MongooseModuleOptions {
    const directUri = (process.env.MONGODB_URI || process.env.MONGO_URI)?.trim();

    if (directUri) {
      return {
        uri: directUri,
      };
    }

    const { username, password, host, port, database } =
      CustomConfigService.PROPERTIES.mongoDBConfig;

    const isAtlas = host?.includes('mongodb.net');
    const authPart = username && password ? `${username}:${password}@` : '';

    const mongodbConnectionUrl = isAtlas
      ? `mongodb+srv://${authPart}${host}/${database}`
      : `mongodb://${authPart}${host}${port ? ':' + port : ''}/${database}`;

    return {
      uri: mongodbConnectionUrl,
    };
  }
}
