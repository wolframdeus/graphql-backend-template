import {Container} from 'typedi';
import {ApolloServer as OriginalApolloServer} from 'apollo-server-express';
import {isString} from '~/shared/utils';
import {
  BuildSchemaOptions,
  buildSchemaSync,
  registerEnumType,
} from 'type-graphql';
import {SentryMiddleware} from '~/api/middlewares';
import {PubSub} from '~/shared/services';
import {
  getAdminResolvers,
  getPublicResolvers,
  getSharedResolvers,
} from '~/api/resolvers';
import {ConfigToken} from '~/shared/di';
import {Server as HttpServer} from "http";
import {Router} from 'express';
import {EAccessScope, EUserRole, TAppSecurityAdapter} from '~/shared/types';

interface IConProps extends BuildSchemaOptions {
  /**
   * Path for subscriptions. If not specified, subscriptions will be unavailable/
   */
  subscriptionsPath?: string;
  /**
   * Should introspection queries be included. It is recommended to disable
   * this feature on servers created for admin routes, so other people
   * will not know what they can do with admin interface.
   * @default false
   */
  introspection?: boolean;
  /**
   * Should GraphQL Playground be included. You can enable this feature to
   * work with your server faster. For example, you could use this interface
   * instead using cli or something like that.
   *
   * Has influence on server performance due to sends static files while
   * opening server url where Playground is placed.
   * @default false
   */
  playground?: boolean;
  /**
   * Security adapter which processes incoming requests.
   */
  securityAdapter: TAppSecurityAdapter;
}

export class ApolloServer {
  /**
   * Original apollo server.
   * @private
   */
  private server: OriginalApolloServer;
  /**
   * True in case enums registrations was already called.
   * @private
   */
  private static areEnumsRegistered = false;

  constructor(props: IConProps) {
    // Firstly, register enums.
    ApolloServer.registerEnums();

    // Then create server.
    const {
      globalMiddlewares = [SentryMiddleware],
      container = Container,
      subscriptionsPath,
      playground = false,
      introspection = false,
      securityAdapter: {
        formatError,
        onConnect,
        middlewares = [],
        authChecker,
        createContext,
      },
      ...restSchemaOptions
    } = props;
    const schema = buildSchemaSync({
      ...restSchemaOptions,
      authChecker,
      globalMiddlewares: [...globalMiddlewares, ...middlewares],
      container,
      pubSub: subscriptionsPath ? Container.get(PubSub) : undefined,
    });

    this.server = new OriginalApolloServer({
      context: createContext,
      formatError,
      subscriptions: isString(subscriptionsPath) ? {
        path: subscriptionsPath,
        onConnect,
      } : false,
      schema,
      introspection,
      playground,
    });
  }

  /**
   * Register all required GraphQL enums.
   */
  private static registerEnums() {
    if (!this.areEnumsRegistered) {
      registerEnumType(EAccessScope, {
        name: 'AccessScope',
        description: 'Access scopes which could be given to user'
      });
      registerEnumType(EUserRole, {
        name: 'UserRole',
        description: 'List of roles which could be assigned to user'
      });

      this.areEnumsRegistered = true;
    }
  }

  /**
   * Creates scoped server.
   * @param type
   * @param securityAdapter
   * @private
   */
  static createScoped(
    type: 'public' | 'admin',
    securityAdapter: TAppSecurityAdapter,
  ): ApolloServer {
    const {
      gqlPublicWSEndpoint,
      gqlAdminWSEndpoint,
      appEnv,
    } = Container.get(ConfigToken);
    const getResolvers = type === 'public'
      ? getPublicResolvers : getAdminResolvers;
    const wsPath = type === 'public'
      ? gqlPublicWSEndpoint : gqlAdminWSEndpoint;

    return new ApolloServer({
      resolvers: [...getSharedResolvers(), ...getResolvers()],
      subscriptionsPath: wsPath || undefined,
      playground: true,
      securityAdapter,
      // Allow introspection only for public resolvers and local development.
      introspection: type === 'public' || appEnv === 'local',
    });
  }

  /**
   * Installs subscription handlers for apollo server in case subscriptions
   * path is specified. Does nothing in case, apollo server should not have
   * web socket connections.
   * @param httpServer
   */
  installSubscriptionHandlers(httpServer: HttpServer) {
    if (isString(this.server.subscriptionsPath)) {
      this.server.installSubscriptionHandlers(httpServer);
    }
  }

  /**
   * Returns correct Apollo's middleware.
   */
  getMiddleware(): Router {
    // We disable CORS due to is should be controlled from upper layers of
    // application. Path is set to "/" because it is controlled by upper layers
    // too.
    return this.server.getMiddleware({path: '/', cors: false});
  }
}