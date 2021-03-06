import {Container} from 'typedi';
import {config} from '~/shared/config';
import {ConfigToken, MongoClientToken, SecurityAdapterToken} from './tokens';
import {MongoClient} from 'mongodb';
import {JWTSecurityAdapter} from '~/api/security-adapters';

/**
 * Inject synchronous dependencies.
 */
function injectSyncDependencies() {
  Container.set(ConfigToken, config);
  Container.set(SecurityAdapterToken, new JWTSecurityAdapter());
}

/**
 * Injects asynchronous dependencies.
 */
async function injectAsyncDependencies() {
  const {dbPort, dbHost} = config;
  const mongoDBClient = await new MongoClient(`mongodb://${dbHost}:${dbPort}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).connect();

  Container.set(MongoClientToken, mongoDBClient);
}
/**
 * Injects dependencies. It is important to launch project with this function
 * due to there can be dependencies which are injected asynchronously.
 * @returns {Promise<void>}
 */
export async function injectDependencies() {
  injectSyncDependencies();
  await injectAsyncDependencies();
}
