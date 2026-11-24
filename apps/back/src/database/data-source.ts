import { DataSource } from 'typeorm';
import { loadEnv } from '../config/env';
import { typeOrmOptions } from './typeorm-options';

/** DataSource utilisée par le CLI TypeORM (migrations) et le seed. */
export default new DataSource(typeOrmOptions(loadEnv().DATABASE_URL));
