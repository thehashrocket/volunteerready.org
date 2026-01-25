/**
 * Client
 **/

import * as runtime from "./runtime/client.js";
import $Types = runtime.Types; // general types
import $Public = runtime.Types.Public;
import $Utils = runtime.Types.Utils;
import $Extensions = runtime.Types.Extensions;
import $Result = runtime.Types.Result;

export type PrismaPromise<T> = $Public.PrismaPromise<T>;

/**
 * Model User
 *
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>;
/**
 * Model Account
 *
 */
export type Account = $Result.DefaultSelection<Prisma.$AccountPayload>;
/**
 * Model Session
 *
 */
export type Session = $Result.DefaultSelection<Prisma.$SessionPayload>;
/**
 * Model VerificationToken
 *
 */
export type VerificationToken =
  $Result.DefaultSelection<Prisma.$VerificationTokenPayload>;
/**
 * Model Organization
 *
 */
export type Organization =
  $Result.DefaultSelection<Prisma.$OrganizationPayload>;
/**
 * Model OrganizationMember
 *
 */
export type OrganizationMember =
  $Result.DefaultSelection<Prisma.$OrganizationMemberPayload>;
/**
 * Model AuditLog
 *
 */
export type AuditLog = $Result.DefaultSelection<Prisma.$AuditLogPayload>;
/**
 * Model FeatureFlag
 *
 */
export type FeatureFlag = $Result.DefaultSelection<Prisma.$FeatureFlagPayload>;
/**
 * Model VolunteerApplication
 *
 */
export type VolunteerApplication =
  $Result.DefaultSelection<Prisma.$VolunteerApplicationPayload>;
/**
 * Model VolunteerAnswer
 *
 */
export type VolunteerAnswer =
  $Result.DefaultSelection<Prisma.$VolunteerAnswerPayload>;
/**
 * Model ScreenerQuestion
 *
 */
export type ScreenerQuestion =
  $Result.DefaultSelection<Prisma.$ScreenerQuestionPayload>;

/**
 * Enums
 */
export namespace $Enums {
  export const ApplicationStatus: {
    SUBMITTED: "SUBMITTED";
    REVIEW: "REVIEW";
    APPROVED: "APPROVED";
    REJECTED: "REJECTED";
  };

  export type ApplicationStatus =
    (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

  export const ScreeningStatus: {
    PASS: "PASS";
    REVIEW: "REVIEW";
    FAIL: "FAIL";
  };

  export type ScreeningStatus =
    (typeof ScreeningStatus)[keyof typeof ScreeningStatus];

  export const ScreenerQuestionType: {
    TEXT: "TEXT";
    SINGLE_CHOICE: "SINGLE_CHOICE";
    MULTI_CHOICE: "MULTI_CHOICE";
    BOOLEAN: "BOOLEAN";
    NUMBER: "NUMBER";
  };

  export type ScreenerQuestionType =
    (typeof ScreenerQuestionType)[keyof typeof ScreenerQuestionType];

  export const Role: {
    OWNER: "OWNER";
    ADMIN: "ADMIN";
    STAFF: "STAFF";
    READONLY: "READONLY";
  };

  export type Role = (typeof Role)[keyof typeof Role];
}

export type ApplicationStatus = $Enums.ApplicationStatus;

export const ApplicationStatus: typeof $Enums.ApplicationStatus;

export type ScreeningStatus = $Enums.ScreeningStatus;

export const ScreeningStatus: typeof $Enums.ScreeningStatus;

export type ScreenerQuestionType = $Enums.ScreenerQuestionType;

export const ScreenerQuestionType: typeof $Enums.ScreenerQuestionType;

export type Role = $Enums.Role;

export const Role: typeof $Enums.Role;

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = "log" extends keyof ClientOptions
    ? ClientOptions["log"] extends Array<Prisma.LogLevel | Prisma.LogDefinition>
      ? Prisma.GetEvents<ClientOptions["log"]>
      : never
    : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>["other"] };

  /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(
    optionsArg?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>,
  );
  $on<V extends U>(
    eventType: V,
    callback: (
      event: V extends "query" ? Prisma.QueryEvent : Prisma.LogEvent,
    ) => void,
  ): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(
    query: string,
    ...values: any[]
  ): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(
    query: string,
    ...values: any[]
  ): Prisma.PrismaPromise<T>;

  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(
    arg: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>;

  $transaction<R>(
    fn: (
      prisma: Omit<PrismaClient, runtime.ITXClientDenyList>,
    ) => $Utils.JsPromise<R>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): $Utils.JsPromise<R>;

  $extends: $Extensions.ExtendsHook<
    "extends",
    Prisma.TypeMapCb<ClientOptions>,
    ExtArgs,
    $Utils.Call<
      Prisma.TypeMapCb<ClientOptions>,
      {
        extArgs: ExtArgs;
      }
    >
  >;

  /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.account`: Exposes CRUD operations for the **Account** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more Accounts
   * const accounts = await prisma.account.findMany()
   * ```
   */
  get account(): Prisma.AccountDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.session`: Exposes CRUD operations for the **Session** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more Sessions
   * const sessions = await prisma.session.findMany()
   * ```
   */
  get session(): Prisma.SessionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.verificationToken`: Exposes CRUD operations for the **VerificationToken** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more VerificationTokens
   * const verificationTokens = await prisma.verificationToken.findMany()
   * ```
   */
  get verificationToken(): Prisma.VerificationTokenDelegate<
    ExtArgs,
    ClientOptions
  >;

  /**
   * `prisma.organization`: Exposes CRUD operations for the **Organization** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more Organizations
   * const organizations = await prisma.organization.findMany()
   * ```
   */
  get organization(): Prisma.OrganizationDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.organizationMember`: Exposes CRUD operations for the **OrganizationMember** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more OrganizationMembers
   * const organizationMembers = await prisma.organizationMember.findMany()
   * ```
   */
  get organizationMember(): Prisma.OrganizationMemberDelegate<
    ExtArgs,
    ClientOptions
  >;

  /**
   * `prisma.auditLog`: Exposes CRUD operations for the **AuditLog** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more AuditLogs
   * const auditLogs = await prisma.auditLog.findMany()
   * ```
   */
  get auditLog(): Prisma.AuditLogDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.featureFlag`: Exposes CRUD operations for the **FeatureFlag** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more FeatureFlags
   * const featureFlags = await prisma.featureFlag.findMany()
   * ```
   */
  get featureFlag(): Prisma.FeatureFlagDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.volunteerApplication`: Exposes CRUD operations for the **VolunteerApplication** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more VolunteerApplications
   * const volunteerApplications = await prisma.volunteerApplication.findMany()
   * ```
   */
  get volunteerApplication(): Prisma.VolunteerApplicationDelegate<
    ExtArgs,
    ClientOptions
  >;

  /**
   * `prisma.volunteerAnswer`: Exposes CRUD operations for the **VolunteerAnswer** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more VolunteerAnswers
   * const volunteerAnswers = await prisma.volunteerAnswer.findMany()
   * ```
   */
  get volunteerAnswer(): Prisma.VolunteerAnswerDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.screenerQuestion`: Exposes CRUD operations for the **ScreenerQuestion** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more ScreenerQuestions
   * const screenerQuestions = await prisma.screenerQuestion.findMany()
   * ```
   */
  get screenerQuestion(): Prisma.ScreenerQuestionDelegate<
    ExtArgs,
    ClientOptions
  >;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF;

  export type PrismaPromise<T> = $Public.PrismaPromise<T>;

  /**
   * Validator
   */
  export import validator = runtime.Public.validator;

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError;
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError;
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError;
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError;
  export import PrismaClientValidationError = runtime.PrismaClientValidationError;

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag;
  export import empty = runtime.empty;
  export import join = runtime.join;
  export import raw = runtime.raw;
  export import Sql = runtime.Sql;

  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal;

  export type DecimalJsLike = runtime.DecimalJsLike;

  /**
   * Extensions
   */
  export import Extension = $Extensions.UserArgs;
  export import getExtensionContext = runtime.Extensions.getExtensionContext;
  export import Args = $Public.Args;
  export import Payload = $Public.Payload;
  export import Result = $Public.Result;
  export import Exact = $Public.Exact;

  /**
   * Prisma Client JS version: 7.3.0
   * Query Engine version: 9d6ad21cbbceab97458517b147a6a09ff43aa735
   */
  export type PrismaVersion = {
    client: string;
    engine: string;
  };

  export const prismaVersion: PrismaVersion;

  /**
   * Utility Types
   */

  export import Bytes = runtime.Bytes;
  export import JsonObject = runtime.JsonObject;
  export import JsonArray = runtime.JsonArray;
  export import JsonValue = runtime.JsonValue;
  export import InputJsonObject = runtime.InputJsonObject;
  export import InputJsonArray = runtime.InputJsonArray;
  export import InputJsonValue = runtime.InputJsonValue;

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
     * Type of `Prisma.DbNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class DbNull {
      private DbNull: never;
      private constructor();
    }

    /**
     * Type of `Prisma.JsonNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class JsonNull {
      private JsonNull: never;
      private constructor();
    }

    /**
     * Type of `Prisma.AnyNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class AnyNull {
      private AnyNull: never;
      private constructor();
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull;

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull;

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull;

  type SelectAndInclude = {
    select: any;
    include: any;
  };

  type SelectAndOmit = {
    select: any;
    omit: any;
  };

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> =
    T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<
    T extends (...args: any) => $Utils.JsPromise<any>,
  > = PromiseType<ReturnType<T>>;

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
    [P in K]: T[P];
  };

  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K;
  }[keyof T];

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K;
  };

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>;

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  } & (T extends SelectAndInclude
    ? "Please either choose `select` or `include`."
    : T extends SelectAndOmit
      ? "Please either choose `select` or `omit`."
      : {});

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  } & K;

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> = T extends object
    ? U extends object
      ? (Without<T, U> & U) | (Without<U, T> & T)
      : U
    : T;

  /**
   * Is T a Record?
   */
  type IsObject<T extends any> =
    T extends Array<any>
      ? False
      : T extends Date
        ? False
        : T extends Uint8Array
          ? False
          : T extends BigInt
            ? False
            : T extends object
              ? True
              : False;

  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T;

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O>; // With K possibilities
    }[K];

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>;

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<
    __Either<O, K>
  >;

  type _Either<O extends object, K extends Key, strict extends Boolean> = {
    1: EitherStrict<O, K>;
    0: EitherLoose<O, K>;
  }[strict];

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1,
  > = O extends unknown ? _Either<O, K, strict> : never;

  export type Union = any;

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K];
  } & {};

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown
      ? (k: U) => void
      : never
  ) extends (k: infer I) => void
    ? I
    : never;

  export type Overwrite<O extends object, O1 extends object> = {
    [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<
    Overwrite<
      U,
      {
        [K in keyof U]-?: At<U, K>;
      }
    >
  >;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O
    ? O[K]
    : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown
    ? AtStrict<O, K>
    : never;
  export type At<
    O extends object,
    K extends Key,
    strict extends Boolean = 1,
  > = {
    1: AtStrict<O, K>;
    0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function
    ? A
    : {
        [K in keyof A]: A[K];
      } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
      ?
          | (K extends keyof O ? { [P in K]: O[P] } & O : O)
          | ({ [P in keyof O as P extends K ? P : never]-?: O[P] } & O)
      : never
  >;

  type _Strict<U, _U = U> = U extends unknown
    ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>>
    : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False;

  // /**
  // 1
  // */
  export type True = 1;

  /**
  0
  */
  export type False = 0;

  export type Not<B extends Boolean> = {
    0: 1;
    1: 0;
  }[B];

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
      ? 1
      : 0;

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >;

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0;
      1: 1;
    };
    1: {
      0: 1;
      1: 1;
    };
  }[B1][B2];

  export type Keys<U extends Union> = U extends unknown ? keyof U : never;

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;

  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object
    ? {
        [P in keyof T]: P extends keyof O ? O[P] : never;
      }
    : never;

  type FieldPaths<
    T,
    U = Omit<T, "_avg" | "_sum" | "_count" | "_min" | "_max">,
  > = IsObject<T> extends True ? U : T;

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<"OR", K>, Extends<"AND", K>>,
      Extends<"NOT", K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<
            UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never
          >
        : never
      : {} extends FieldPaths<T[K]>
        ? never
        : K;
  }[keyof T];

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never;
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>;
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T;

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<
    T,
    K extends Enumerable<keyof T> | keyof T,
  > = Prisma__Pick<T, MaybeTupleToUnion<K>>;

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}`
    ? never
    : T;

  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>;

  type FieldRefInputType<Model, FieldType> = Model extends never
    ? never
    : FieldRef<Model, FieldType>;

  export const ModelName: {
    User: "User";
    Account: "Account";
    Session: "Session";
    VerificationToken: "VerificationToken";
    Organization: "Organization";
    OrganizationMember: "OrganizationMember";
    AuditLog: "AuditLog";
    FeatureFlag: "FeatureFlag";
    VolunteerApplication: "VolunteerApplication";
    VolunteerAnswer: "VolunteerAnswer";
    ScreenerQuestion: "ScreenerQuestion";
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName];

  interface TypeMapCb<ClientOptions = {}>
    extends $Utils.Fn<
      { extArgs: $Extensions.InternalArgs },
      $Utils.Record<string, any>
    > {
    returns: Prisma.TypeMap<
      this["params"]["extArgs"],
      ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}
    >;
  }

  export type TypeMap<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > = {
    globalOmitOptions: {
      omit: GlobalOmitOptions;
    };
    meta: {
      modelProps:
        | "user"
        | "account"
        | "session"
        | "verificationToken"
        | "organization"
        | "organizationMember"
        | "auditLog"
        | "featureFlag"
        | "volunteerApplication"
        | "volunteerAnswer"
        | "screenerQuestion";
      txIsolationLevel: Prisma.TransactionIsolationLevel;
    };
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>;
        fields: Prisma.UserFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>;
          };
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>;
          };
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[];
          };
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>;
          };
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[];
          };
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>;
          };
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>;
          };
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[];
          };
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>;
          };
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateUser>;
          };
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>;
            result: $Utils.Optional<UserGroupByOutputType>[];
          };
          count: {
            args: Prisma.UserCountArgs<ExtArgs>;
            result: $Utils.Optional<UserCountAggregateOutputType> | number;
          };
        };
      };
      Account: {
        payload: Prisma.$AccountPayload<ExtArgs>;
        fields: Prisma.AccountFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.AccountFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AccountPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.AccountFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>;
          };
          findFirst: {
            args: Prisma.AccountFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AccountPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.AccountFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>;
          };
          findMany: {
            args: Prisma.AccountFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>[];
          };
          create: {
            args: Prisma.AccountCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>;
          };
          createMany: {
            args: Prisma.AccountCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.AccountCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>[];
          };
          delete: {
            args: Prisma.AccountDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>;
          };
          update: {
            args: Prisma.AccountUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>;
          };
          deleteMany: {
            args: Prisma.AccountDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.AccountUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.AccountUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>[];
          };
          upsert: {
            args: Prisma.AccountUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>;
          };
          aggregate: {
            args: Prisma.AccountAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateAccount>;
          };
          groupBy: {
            args: Prisma.AccountGroupByArgs<ExtArgs>;
            result: $Utils.Optional<AccountGroupByOutputType>[];
          };
          count: {
            args: Prisma.AccountCountArgs<ExtArgs>;
            result: $Utils.Optional<AccountCountAggregateOutputType> | number;
          };
        };
      };
      Session: {
        payload: Prisma.$SessionPayload<ExtArgs>;
        fields: Prisma.SessionFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.SessionFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SessionPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.SessionFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>;
          };
          findFirst: {
            args: Prisma.SessionFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SessionPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.SessionFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>;
          };
          findMany: {
            args: Prisma.SessionFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[];
          };
          create: {
            args: Prisma.SessionCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>;
          };
          createMany: {
            args: Prisma.SessionCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.SessionCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[];
          };
          delete: {
            args: Prisma.SessionDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>;
          };
          update: {
            args: Prisma.SessionUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>;
          };
          deleteMany: {
            args: Prisma.SessionDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.SessionUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.SessionUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[];
          };
          upsert: {
            args: Prisma.SessionUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>;
          };
          aggregate: {
            args: Prisma.SessionAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateSession>;
          };
          groupBy: {
            args: Prisma.SessionGroupByArgs<ExtArgs>;
            result: $Utils.Optional<SessionGroupByOutputType>[];
          };
          count: {
            args: Prisma.SessionCountArgs<ExtArgs>;
            result: $Utils.Optional<SessionCountAggregateOutputType> | number;
          };
        };
      };
      VerificationToken: {
        payload: Prisma.$VerificationTokenPayload<ExtArgs>;
        fields: Prisma.VerificationTokenFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.VerificationTokenFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.VerificationTokenFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>;
          };
          findFirst: {
            args: Prisma.VerificationTokenFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.VerificationTokenFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>;
          };
          findMany: {
            args: Prisma.VerificationTokenFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>[];
          };
          create: {
            args: Prisma.VerificationTokenCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>;
          };
          createMany: {
            args: Prisma.VerificationTokenCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.VerificationTokenCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>[];
          };
          delete: {
            args: Prisma.VerificationTokenDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>;
          };
          update: {
            args: Prisma.VerificationTokenUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>;
          };
          deleteMany: {
            args: Prisma.VerificationTokenDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.VerificationTokenUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.VerificationTokenUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>[];
          };
          upsert: {
            args: Prisma.VerificationTokenUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VerificationTokenPayload>;
          };
          aggregate: {
            args: Prisma.VerificationTokenAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateVerificationToken>;
          };
          groupBy: {
            args: Prisma.VerificationTokenGroupByArgs<ExtArgs>;
            result: $Utils.Optional<VerificationTokenGroupByOutputType>[];
          };
          count: {
            args: Prisma.VerificationTokenCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<VerificationTokenCountAggregateOutputType>
              | number;
          };
        };
      };
      Organization: {
        payload: Prisma.$OrganizationPayload<ExtArgs>;
        fields: Prisma.OrganizationFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.OrganizationFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.OrganizationFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>;
          };
          findFirst: {
            args: Prisma.OrganizationFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.OrganizationFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>;
          };
          findMany: {
            args: Prisma.OrganizationFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>[];
          };
          create: {
            args: Prisma.OrganizationCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>;
          };
          createMany: {
            args: Prisma.OrganizationCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.OrganizationCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>[];
          };
          delete: {
            args: Prisma.OrganizationDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>;
          };
          update: {
            args: Prisma.OrganizationUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>;
          };
          deleteMany: {
            args: Prisma.OrganizationDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.OrganizationUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.OrganizationUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>[];
          };
          upsert: {
            args: Prisma.OrganizationUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>;
          };
          aggregate: {
            args: Prisma.OrganizationAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateOrganization>;
          };
          groupBy: {
            args: Prisma.OrganizationGroupByArgs<ExtArgs>;
            result: $Utils.Optional<OrganizationGroupByOutputType>[];
          };
          count: {
            args: Prisma.OrganizationCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<OrganizationCountAggregateOutputType>
              | number;
          };
        };
      };
      OrganizationMember: {
        payload: Prisma.$OrganizationMemberPayload<ExtArgs>;
        fields: Prisma.OrganizationMemberFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.OrganizationMemberFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationMemberPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.OrganizationMemberFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationMemberPayload>;
          };
          findFirst: {
            args: Prisma.OrganizationMemberFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationMemberPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.OrganizationMemberFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationMemberPayload>;
          };
          findMany: {
            args: Prisma.OrganizationMemberFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationMemberPayload>[];
          };
          create: {
            args: Prisma.OrganizationMemberCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationMemberPayload>;
          };
          createMany: {
            args: Prisma.OrganizationMemberCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.OrganizationMemberCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationMemberPayload>[];
          };
          delete: {
            args: Prisma.OrganizationMemberDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationMemberPayload>;
          };
          update: {
            args: Prisma.OrganizationMemberUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationMemberPayload>;
          };
          deleteMany: {
            args: Prisma.OrganizationMemberDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.OrganizationMemberUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.OrganizationMemberUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationMemberPayload>[];
          };
          upsert: {
            args: Prisma.OrganizationMemberUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OrganizationMemberPayload>;
          };
          aggregate: {
            args: Prisma.OrganizationMemberAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateOrganizationMember>;
          };
          groupBy: {
            args: Prisma.OrganizationMemberGroupByArgs<ExtArgs>;
            result: $Utils.Optional<OrganizationMemberGroupByOutputType>[];
          };
          count: {
            args: Prisma.OrganizationMemberCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<OrganizationMemberCountAggregateOutputType>
              | number;
          };
        };
      };
      AuditLog: {
        payload: Prisma.$AuditLogPayload<ExtArgs>;
        fields: Prisma.AuditLogFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.AuditLogFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.AuditLogFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>;
          };
          findFirst: {
            args: Prisma.AuditLogFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.AuditLogFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>;
          };
          findMany: {
            args: Prisma.AuditLogFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>[];
          };
          create: {
            args: Prisma.AuditLogCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>;
          };
          createMany: {
            args: Prisma.AuditLogCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.AuditLogCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>[];
          };
          delete: {
            args: Prisma.AuditLogDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>;
          };
          update: {
            args: Prisma.AuditLogUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>;
          };
          deleteMany: {
            args: Prisma.AuditLogDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.AuditLogUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.AuditLogUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>[];
          };
          upsert: {
            args: Prisma.AuditLogUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$AuditLogPayload>;
          };
          aggregate: {
            args: Prisma.AuditLogAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateAuditLog>;
          };
          groupBy: {
            args: Prisma.AuditLogGroupByArgs<ExtArgs>;
            result: $Utils.Optional<AuditLogGroupByOutputType>[];
          };
          count: {
            args: Prisma.AuditLogCountArgs<ExtArgs>;
            result: $Utils.Optional<AuditLogCountAggregateOutputType> | number;
          };
        };
      };
      FeatureFlag: {
        payload: Prisma.$FeatureFlagPayload<ExtArgs>;
        fields: Prisma.FeatureFlagFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.FeatureFlagFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FeatureFlagPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.FeatureFlagFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FeatureFlagPayload>;
          };
          findFirst: {
            args: Prisma.FeatureFlagFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FeatureFlagPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.FeatureFlagFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FeatureFlagPayload>;
          };
          findMany: {
            args: Prisma.FeatureFlagFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FeatureFlagPayload>[];
          };
          create: {
            args: Prisma.FeatureFlagCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FeatureFlagPayload>;
          };
          createMany: {
            args: Prisma.FeatureFlagCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.FeatureFlagCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FeatureFlagPayload>[];
          };
          delete: {
            args: Prisma.FeatureFlagDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FeatureFlagPayload>;
          };
          update: {
            args: Prisma.FeatureFlagUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FeatureFlagPayload>;
          };
          deleteMany: {
            args: Prisma.FeatureFlagDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.FeatureFlagUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.FeatureFlagUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FeatureFlagPayload>[];
          };
          upsert: {
            args: Prisma.FeatureFlagUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$FeatureFlagPayload>;
          };
          aggregate: {
            args: Prisma.FeatureFlagAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateFeatureFlag>;
          };
          groupBy: {
            args: Prisma.FeatureFlagGroupByArgs<ExtArgs>;
            result: $Utils.Optional<FeatureFlagGroupByOutputType>[];
          };
          count: {
            args: Prisma.FeatureFlagCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<FeatureFlagCountAggregateOutputType>
              | number;
          };
        };
      };
      VolunteerApplication: {
        payload: Prisma.$VolunteerApplicationPayload<ExtArgs>;
        fields: Prisma.VolunteerApplicationFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.VolunteerApplicationFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerApplicationPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.VolunteerApplicationFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerApplicationPayload>;
          };
          findFirst: {
            args: Prisma.VolunteerApplicationFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerApplicationPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.VolunteerApplicationFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerApplicationPayload>;
          };
          findMany: {
            args: Prisma.VolunteerApplicationFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerApplicationPayload>[];
          };
          create: {
            args: Prisma.VolunteerApplicationCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerApplicationPayload>;
          };
          createMany: {
            args: Prisma.VolunteerApplicationCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.VolunteerApplicationCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerApplicationPayload>[];
          };
          delete: {
            args: Prisma.VolunteerApplicationDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerApplicationPayload>;
          };
          update: {
            args: Prisma.VolunteerApplicationUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerApplicationPayload>;
          };
          deleteMany: {
            args: Prisma.VolunteerApplicationDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.VolunteerApplicationUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.VolunteerApplicationUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerApplicationPayload>[];
          };
          upsert: {
            args: Prisma.VolunteerApplicationUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerApplicationPayload>;
          };
          aggregate: {
            args: Prisma.VolunteerApplicationAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateVolunteerApplication>;
          };
          groupBy: {
            args: Prisma.VolunteerApplicationGroupByArgs<ExtArgs>;
            result: $Utils.Optional<VolunteerApplicationGroupByOutputType>[];
          };
          count: {
            args: Prisma.VolunteerApplicationCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<VolunteerApplicationCountAggregateOutputType>
              | number;
          };
        };
      };
      VolunteerAnswer: {
        payload: Prisma.$VolunteerAnswerPayload<ExtArgs>;
        fields: Prisma.VolunteerAnswerFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.VolunteerAnswerFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerAnswerPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.VolunteerAnswerFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerAnswerPayload>;
          };
          findFirst: {
            args: Prisma.VolunteerAnswerFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerAnswerPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.VolunteerAnswerFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerAnswerPayload>;
          };
          findMany: {
            args: Prisma.VolunteerAnswerFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerAnswerPayload>[];
          };
          create: {
            args: Prisma.VolunteerAnswerCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerAnswerPayload>;
          };
          createMany: {
            args: Prisma.VolunteerAnswerCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.VolunteerAnswerCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerAnswerPayload>[];
          };
          delete: {
            args: Prisma.VolunteerAnswerDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerAnswerPayload>;
          };
          update: {
            args: Prisma.VolunteerAnswerUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerAnswerPayload>;
          };
          deleteMany: {
            args: Prisma.VolunteerAnswerDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.VolunteerAnswerUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.VolunteerAnswerUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerAnswerPayload>[];
          };
          upsert: {
            args: Prisma.VolunteerAnswerUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$VolunteerAnswerPayload>;
          };
          aggregate: {
            args: Prisma.VolunteerAnswerAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateVolunteerAnswer>;
          };
          groupBy: {
            args: Prisma.VolunteerAnswerGroupByArgs<ExtArgs>;
            result: $Utils.Optional<VolunteerAnswerGroupByOutputType>[];
          };
          count: {
            args: Prisma.VolunteerAnswerCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<VolunteerAnswerCountAggregateOutputType>
              | number;
          };
        };
      };
      ScreenerQuestion: {
        payload: Prisma.$ScreenerQuestionPayload<ExtArgs>;
        fields: Prisma.ScreenerQuestionFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.ScreenerQuestionFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ScreenerQuestionPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.ScreenerQuestionFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ScreenerQuestionPayload>;
          };
          findFirst: {
            args: Prisma.ScreenerQuestionFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ScreenerQuestionPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.ScreenerQuestionFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ScreenerQuestionPayload>;
          };
          findMany: {
            args: Prisma.ScreenerQuestionFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ScreenerQuestionPayload>[];
          };
          create: {
            args: Prisma.ScreenerQuestionCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ScreenerQuestionPayload>;
          };
          createMany: {
            args: Prisma.ScreenerQuestionCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.ScreenerQuestionCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ScreenerQuestionPayload>[];
          };
          delete: {
            args: Prisma.ScreenerQuestionDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ScreenerQuestionPayload>;
          };
          update: {
            args: Prisma.ScreenerQuestionUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ScreenerQuestionPayload>;
          };
          deleteMany: {
            args: Prisma.ScreenerQuestionDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.ScreenerQuestionUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.ScreenerQuestionUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ScreenerQuestionPayload>[];
          };
          upsert: {
            args: Prisma.ScreenerQuestionUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ScreenerQuestionPayload>;
          };
          aggregate: {
            args: Prisma.ScreenerQuestionAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateScreenerQuestion>;
          };
          groupBy: {
            args: Prisma.ScreenerQuestionGroupByArgs<ExtArgs>;
            result: $Utils.Optional<ScreenerQuestionGroupByOutputType>[];
          };
          count: {
            args: Prisma.ScreenerQuestionCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<ScreenerQuestionCountAggregateOutputType>
              | number;
          };
        };
      };
    };
  } & {
    other: {
      payload: any;
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]];
          result: any;
        };
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]];
          result: any;
        };
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]];
          result: any;
        };
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]];
          result: any;
        };
      };
    };
  };
  export const defineExtension: $Extensions.ExtendsHook<
    "define",
    Prisma.TypeMapCb,
    $Extensions.DefaultArgs
  >;
  export type DefaultPrismaClient = PrismaClient;
  export type ErrorFormat = "pretty" | "colorless" | "minimal";
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat;
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     *
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     *
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     *
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[];
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    };
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory;
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string;
    /**
     * Global configuration for omitting model fields by default.
     *
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig;
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     *
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[];
  }
  export type GlobalOmitConfig = {
    user?: UserOmit;
    account?: AccountOmit;
    session?: SessionOmit;
    verificationToken?: VerificationTokenOmit;
    organization?: OrganizationOmit;
    organizationMember?: OrganizationMemberOmit;
    auditLog?: AuditLogOmit;
    featureFlag?: FeatureFlagOmit;
    volunteerApplication?: VolunteerApplicationOmit;
    volunteerAnswer?: VolunteerAnswerOmit;
    screenerQuestion?: ScreenerQuestionOmit;
  };

  /* Types for Logging */
  export type LogLevel = "info" | "query" | "warn" | "error";
  export type LogDefinition = {
    level: LogLevel;
    emit: "stdout" | "event";
  };

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T["level"] : T
  >;

  export type GetEvents<T extends any[]> =
    T extends Array<LogLevel | LogDefinition> ? GetLogType<T[number]> : never;

  export type QueryEvent = {
    timestamp: Date;
    query: string;
    params: string;
    duration: number;
    target: string;
  };

  export type LogEvent = {
    timestamp: Date;
    message: string;
    target: string;
  };
  /* End Types for Logging */

  export type PrismaAction =
    | "findUnique"
    | "findUniqueOrThrow"
    | "findMany"
    | "findFirst"
    | "findFirstOrThrow"
    | "create"
    | "createMany"
    | "createManyAndReturn"
    | "update"
    | "updateMany"
    | "updateManyAndReturn"
    | "upsert"
    | "delete"
    | "deleteMany"
    | "executeRaw"
    | "queryRaw"
    | "aggregate"
    | "count"
    | "runCommandRaw"
    | "findRaw"
    | "groupBy";

  // tested in getLogLevel.test.ts
  export function getLogLevel(
    log: Array<LogLevel | LogDefinition>,
  ): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<
    Prisma.DefaultPrismaClient,
    runtime.ITXClientDenyList
  >;

  export type Datasource = {
    url?: string;
  };

  /**
   * Count Types
   */

  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    accounts: number;
    sessions: number;
    memberships: number;
    auditLogs: number;
  };

  export type UserCountOutputTypeSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    accounts?: boolean | UserCountOutputTypeCountAccountsArgs;
    sessions?: boolean | UserCountOutputTypeCountSessionsArgs;
    memberships?: boolean | UserCountOutputTypeCountMembershipsArgs;
    auditLogs?: boolean | UserCountOutputTypeCountAuditLogsArgs;
  };

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null;
  };

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountAccountsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: AccountWhereInput;
  };

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountSessionsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: SessionWhereInput;
  };

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountMembershipsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: OrganizationMemberWhereInput;
  };

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountAuditLogsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: AuditLogWhereInput;
  };

  /**
   * Count Type OrganizationCountOutputType
   */

  export type OrganizationCountOutputType = {
    members: number;
    auditLogs: number;
    featureFlags: number;
    applications: number;
    screenerQuestions: number;
    sessions: number;
  };

  export type OrganizationCountOutputTypeSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    members?: boolean | OrganizationCountOutputTypeCountMembersArgs;
    auditLogs?: boolean | OrganizationCountOutputTypeCountAuditLogsArgs;
    featureFlags?: boolean | OrganizationCountOutputTypeCountFeatureFlagsArgs;
    applications?: boolean | OrganizationCountOutputTypeCountApplicationsArgs;
    screenerQuestions?:
      | boolean
      | OrganizationCountOutputTypeCountScreenerQuestionsArgs;
    sessions?: boolean | OrganizationCountOutputTypeCountSessionsArgs;
  };

  // Custom InputTypes
  /**
   * OrganizationCountOutputType without action
   */
  export type OrganizationCountOutputTypeDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationCountOutputType
     */
    select?: OrganizationCountOutputTypeSelect<ExtArgs> | null;
  };

  /**
   * OrganizationCountOutputType without action
   */
  export type OrganizationCountOutputTypeCountMembersArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: OrganizationMemberWhereInput;
  };

  /**
   * OrganizationCountOutputType without action
   */
  export type OrganizationCountOutputTypeCountAuditLogsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: AuditLogWhereInput;
  };

  /**
   * OrganizationCountOutputType without action
   */
  export type OrganizationCountOutputTypeCountFeatureFlagsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: FeatureFlagWhereInput;
  };

  /**
   * OrganizationCountOutputType without action
   */
  export type OrganizationCountOutputTypeCountApplicationsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: VolunteerApplicationWhereInput;
  };

  /**
   * OrganizationCountOutputType without action
   */
  export type OrganizationCountOutputTypeCountScreenerQuestionsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: ScreenerQuestionWhereInput;
  };

  /**
   * OrganizationCountOutputType without action
   */
  export type OrganizationCountOutputTypeCountSessionsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: SessionWhereInput;
  };

  /**
   * Count Type VolunteerApplicationCountOutputType
   */

  export type VolunteerApplicationCountOutputType = {
    answers: number;
  };

  export type VolunteerApplicationCountOutputTypeSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    answers?: boolean | VolunteerApplicationCountOutputTypeCountAnswersArgs;
  };

  // Custom InputTypes
  /**
   * VolunteerApplicationCountOutputType without action
   */
  export type VolunteerApplicationCountOutputTypeDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplicationCountOutputType
     */
    select?: VolunteerApplicationCountOutputTypeSelect<ExtArgs> | null;
  };

  /**
   * VolunteerApplicationCountOutputType without action
   */
  export type VolunteerApplicationCountOutputTypeCountAnswersArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: VolunteerAnswerWhereInput;
  };

  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null;
    _min: UserMinAggregateOutputType | null;
    _max: UserMaxAggregateOutputType | null;
  };

  export type UserMinAggregateOutputType = {
    id: string | null;
    name: string | null;
    email: string | null;
    emailVerified: Date | null;
    image: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type UserMaxAggregateOutputType = {
    id: string | null;
    name: string | null;
    email: string | null;
    emailVerified: Date | null;
    image: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type UserCountAggregateOutputType = {
    id: number;
    name: number;
    email: number;
    emailVerified: number;
    image: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
  };

  export type UserMinAggregateInputType = {
    id?: true;
    name?: true;
    email?: true;
    emailVerified?: true;
    image?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type UserMaxAggregateInputType = {
    id?: true;
    name?: true;
    email?: true;
    emailVerified?: true;
    image?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type UserCountAggregateInputType = {
    id?: true;
    name?: true;
    email?: true;
    emailVerified?: true;
    image?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
  };

  export type UserAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Users from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Users.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Users
     **/
    _count?: true | UserCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: UserMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: UserMaxAggregateInputType;
  };

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
    [P in keyof T & keyof AggregateUser]: P extends "_count" | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>;
  };

  export type UserGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: UserWhereInput;
    orderBy?:
      | UserOrderByWithAggregationInput
      | UserOrderByWithAggregationInput[];
    by: UserScalarFieldEnum[] | UserScalarFieldEnum;
    having?: UserScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: UserCountAggregateInputType | true;
    _min?: UserMinAggregateInputType;
    _max?: UserMaxAggregateInputType;
  };

  export type UserGroupByOutputType = {
    id: string;
    name: string | null;
    email: string | null;
    emailVerified: Date | null;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: UserCountAggregateOutputType | null;
    _min: UserMinAggregateOutputType | null;
    _max: UserMaxAggregateOutputType | null;
  };

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T["by"]> & {
        [P in keyof T & keyof UserGroupByOutputType]: P extends "_count"
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], UserGroupByOutputType[P]>
          : GetScalarType<T[P], UserGroupByOutputType[P]>;
      }
    >
  >;

  export type UserSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      name?: boolean;
      email?: boolean;
      emailVerified?: boolean;
      image?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      accounts?: boolean | User$accountsArgs<ExtArgs>;
      sessions?: boolean | User$sessionsArgs<ExtArgs>;
      memberships?: boolean | User$membershipsArgs<ExtArgs>;
      auditLogs?: boolean | User$auditLogsArgs<ExtArgs>;
      _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["user"]
  >;

  export type UserSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      name?: boolean;
      email?: boolean;
      emailVerified?: boolean;
      image?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs["result"]["user"]
  >;

  export type UserSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      name?: boolean;
      email?: boolean;
      emailVerified?: boolean;
      image?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs["result"]["user"]
  >;

  export type UserSelectScalar = {
    id?: boolean;
    name?: boolean;
    email?: boolean;
    emailVerified?: boolean;
    image?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
  };

  export type UserOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "name"
    | "email"
    | "emailVerified"
    | "image"
    | "createdAt"
    | "updatedAt",
    ExtArgs["result"]["user"]
  >;
  export type UserInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    accounts?: boolean | User$accountsArgs<ExtArgs>;
    sessions?: boolean | User$sessionsArgs<ExtArgs>;
    memberships?: boolean | User$membershipsArgs<ExtArgs>;
    auditLogs?: boolean | User$auditLogsArgs<ExtArgs>;
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>;
  };
  export type UserIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {};
  export type UserIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {};

  export type $UserPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "User";
    objects: {
      accounts: Prisma.$AccountPayload<ExtArgs>[];
      sessions: Prisma.$SessionPayload<ExtArgs>[];
      memberships: Prisma.$OrganizationMemberPayload<ExtArgs>[];
      auditLogs: Prisma.$AuditLogPayload<ExtArgs>[];
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        name: string | null;
        email: string | null;
        emailVerified: Date | null;
        image: string | null;
        createdAt: Date;
        updatedAt: Date;
      },
      ExtArgs["result"]["user"]
    >;
    composites: {};
  };

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> =
    $Result.GetResult<Prisma.$UserPayload, S>;

  type UserCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<UserFindManyArgs, "select" | "include" | "distinct" | "omit"> & {
    select?: UserCountAggregateInputType | true;
  };

  export interface UserDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["User"];
      meta: { name: "User" };
    };
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(
      args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<
        Prisma.$UserPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(
      args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<
        Prisma.$UserPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(
      args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<
        Prisma.$UserPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(
      args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<
        Prisma.$UserPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     *
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     *
     */
    findMany<T extends UserFindManyArgs>(
      args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$UserPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     *
     */
    create<T extends UserCreateArgs>(
      args: SelectSubset<T, UserCreateArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<
        Prisma.$UserPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends UserCreateManyArgs>(
      args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(
      args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$UserPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     *
     */
    delete<T extends UserDeleteArgs>(
      args: SelectSubset<T, UserDeleteArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<
        Prisma.$UserPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends UserUpdateArgs>(
      args: SelectSubset<T, UserUpdateArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<
        Prisma.$UserPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends UserDeleteManyArgs>(
      args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends UserUpdateManyArgs>(
      args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(
      args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$UserPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(
      args: SelectSubset<T, UserUpsertArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<
        Prisma.$UserPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
     **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], UserCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends UserAggregateArgs>(
      args: Subset<T, UserAggregateArgs>,
    ): Prisma.PrismaPromise<GetUserAggregateType<T>>;

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs["orderBy"] }
        : { orderBy?: UserGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors
      ? GetUserGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the User model
     */
    readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    accounts<T extends User$accountsArgs<ExtArgs> = {}>(
      args?: Subset<T, User$accountsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$AccountPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    sessions<T extends User$sessionsArgs<ExtArgs> = {}>(
      args?: Subset<T, User$sessionsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$SessionPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    memberships<T extends User$membershipsArgs<ExtArgs> = {}>(
      args?: Subset<T, User$membershipsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$OrganizationMemberPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    auditLogs<T extends User$auditLogsArgs<ExtArgs> = {}>(
      args?: Subset<T, User$auditLogsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$AuditLogPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", "String">;
    readonly name: FieldRef<"User", "String">;
    readonly email: FieldRef<"User", "String">;
    readonly emailVerified: FieldRef<"User", "DateTime">;
    readonly image: FieldRef<"User", "String">;
    readonly createdAt: FieldRef<"User", "DateTime">;
    readonly updatedAt: FieldRef<"User", "DateTime">;
  }

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput;
  };

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput;
  };

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Users from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Users.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[];
  };

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Users from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Users.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[];
  };

  /**
   * User findMany
   */
  export type UserFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Users from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Users.
     */
    skip?: number;
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[];
  };

  /**
   * User create
   */
  export type UserCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>;
  };

  /**
   * User createMany
   */
  export type UserCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * User update
   */
  export type UserUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>;
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput;
  };

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>;
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput;
    /**
     * Limit how many Users to update.
     */
    limit?: number;
  };

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>;
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput;
    /**
     * Limit how many Users to update.
     */
    limit?: number;
  };

  /**
   * User upsert
   */
  export type UserUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput;
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>;
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>;
  };

  /**
   * User delete
   */
  export type UserDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput;
  };

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput;
    /**
     * Limit how many Users to delete.
     */
    limit?: number;
  };

  /**
   * User.accounts
   */
  export type User$accountsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null;
    where?: AccountWhereInput;
    orderBy?:
      | AccountOrderByWithRelationInput
      | AccountOrderByWithRelationInput[];
    cursor?: AccountWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: AccountScalarFieldEnum | AccountScalarFieldEnum[];
  };

  /**
   * User.sessions
   */
  export type User$sessionsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null;
    where?: SessionWhereInput;
    orderBy?:
      | SessionOrderByWithRelationInput
      | SessionOrderByWithRelationInput[];
    cursor?: SessionWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[];
  };

  /**
   * User.memberships
   */
  export type User$membershipsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberInclude<ExtArgs> | null;
    where?: OrganizationMemberWhereInput;
    orderBy?:
      | OrganizationMemberOrderByWithRelationInput
      | OrganizationMemberOrderByWithRelationInput[];
    cursor?: OrganizationMemberWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?:
      | OrganizationMemberScalarFieldEnum
      | OrganizationMemberScalarFieldEnum[];
  };

  /**
   * User.auditLogs
   */
  export type User$auditLogsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null;
    where?: AuditLogWhereInput;
    orderBy?:
      | AuditLogOrderByWithRelationInput
      | AuditLogOrderByWithRelationInput[];
    cursor?: AuditLogWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: AuditLogScalarFieldEnum | AuditLogScalarFieldEnum[];
  };

  /**
   * User without action
   */
  export type UserDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
  };

  /**
   * Model Account
   */

  export type AggregateAccount = {
    _count: AccountCountAggregateOutputType | null;
    _avg: AccountAvgAggregateOutputType | null;
    _sum: AccountSumAggregateOutputType | null;
    _min: AccountMinAggregateOutputType | null;
    _max: AccountMaxAggregateOutputType | null;
  };

  export type AccountAvgAggregateOutputType = {
    expires_at: number | null;
  };

  export type AccountSumAggregateOutputType = {
    expires_at: number | null;
  };

  export type AccountMinAggregateOutputType = {
    id: string | null;
    userId: string | null;
    type: string | null;
    provider: string | null;
    providerAccountId: string | null;
    refresh_token: string | null;
    access_token: string | null;
    expires_at: number | null;
    token_type: string | null;
    scope: string | null;
    id_token: string | null;
    session_state: string | null;
  };

  export type AccountMaxAggregateOutputType = {
    id: string | null;
    userId: string | null;
    type: string | null;
    provider: string | null;
    providerAccountId: string | null;
    refresh_token: string | null;
    access_token: string | null;
    expires_at: number | null;
    token_type: string | null;
    scope: string | null;
    id_token: string | null;
    session_state: string | null;
  };

  export type AccountCountAggregateOutputType = {
    id: number;
    userId: number;
    type: number;
    provider: number;
    providerAccountId: number;
    refresh_token: number;
    access_token: number;
    expires_at: number;
    token_type: number;
    scope: number;
    id_token: number;
    session_state: number;
    _all: number;
  };

  export type AccountAvgAggregateInputType = {
    expires_at?: true;
  };

  export type AccountSumAggregateInputType = {
    expires_at?: true;
  };

  export type AccountMinAggregateInputType = {
    id?: true;
    userId?: true;
    type?: true;
    provider?: true;
    providerAccountId?: true;
    refresh_token?: true;
    access_token?: true;
    expires_at?: true;
    token_type?: true;
    scope?: true;
    id_token?: true;
    session_state?: true;
  };

  export type AccountMaxAggregateInputType = {
    id?: true;
    userId?: true;
    type?: true;
    provider?: true;
    providerAccountId?: true;
    refresh_token?: true;
    access_token?: true;
    expires_at?: true;
    token_type?: true;
    scope?: true;
    id_token?: true;
    session_state?: true;
  };

  export type AccountCountAggregateInputType = {
    id?: true;
    userId?: true;
    type?: true;
    provider?: true;
    providerAccountId?: true;
    refresh_token?: true;
    access_token?: true;
    expires_at?: true;
    token_type?: true;
    scope?: true;
    id_token?: true;
    session_state?: true;
    _all?: true;
  };

  export type AccountAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Account to aggregate.
     */
    where?: AccountWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Accounts to fetch.
     */
    orderBy?:
      | AccountOrderByWithRelationInput
      | AccountOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: AccountWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Accounts from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Accounts.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Accounts
     **/
    _count?: true | AccountCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: AccountAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: AccountSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: AccountMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: AccountMaxAggregateInputType;
  };

  export type GetAccountAggregateType<T extends AccountAggregateArgs> = {
    [P in keyof T & keyof AggregateAccount]: P extends "_count" | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAccount[P]>
      : GetScalarType<T[P], AggregateAccount[P]>;
  };

  export type AccountGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: AccountWhereInput;
    orderBy?:
      | AccountOrderByWithAggregationInput
      | AccountOrderByWithAggregationInput[];
    by: AccountScalarFieldEnum[] | AccountScalarFieldEnum;
    having?: AccountScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: AccountCountAggregateInputType | true;
    _avg?: AccountAvgAggregateInputType;
    _sum?: AccountSumAggregateInputType;
    _min?: AccountMinAggregateInputType;
    _max?: AccountMaxAggregateInputType;
  };

  export type AccountGroupByOutputType = {
    id: string;
    userId: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token: string | null;
    access_token: string | null;
    expires_at: number | null;
    token_type: string | null;
    scope: string | null;
    id_token: string | null;
    session_state: string | null;
    _count: AccountCountAggregateOutputType | null;
    _avg: AccountAvgAggregateOutputType | null;
    _sum: AccountSumAggregateOutputType | null;
    _min: AccountMinAggregateOutputType | null;
    _max: AccountMaxAggregateOutputType | null;
  };

  type GetAccountGroupByPayload<T extends AccountGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<AccountGroupByOutputType, T["by"]> & {
          [P in keyof T & keyof AccountGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AccountGroupByOutputType[P]>
            : GetScalarType<T[P], AccountGroupByOutputType[P]>;
        }
      >
    >;

  export type AccountSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      userId?: boolean;
      type?: boolean;
      provider?: boolean;
      providerAccountId?: boolean;
      refresh_token?: boolean;
      access_token?: boolean;
      expires_at?: boolean;
      token_type?: boolean;
      scope?: boolean;
      id_token?: boolean;
      session_state?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["account"]
  >;

  export type AccountSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      userId?: boolean;
      type?: boolean;
      provider?: boolean;
      providerAccountId?: boolean;
      refresh_token?: boolean;
      access_token?: boolean;
      expires_at?: boolean;
      token_type?: boolean;
      scope?: boolean;
      id_token?: boolean;
      session_state?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["account"]
  >;

  export type AccountSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      userId?: boolean;
      type?: boolean;
      provider?: boolean;
      providerAccountId?: boolean;
      refresh_token?: boolean;
      access_token?: boolean;
      expires_at?: boolean;
      token_type?: boolean;
      scope?: boolean;
      id_token?: boolean;
      session_state?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["account"]
  >;

  export type AccountSelectScalar = {
    id?: boolean;
    userId?: boolean;
    type?: boolean;
    provider?: boolean;
    providerAccountId?: boolean;
    refresh_token?: boolean;
    access_token?: boolean;
    expires_at?: boolean;
    token_type?: boolean;
    scope?: boolean;
    id_token?: boolean;
    session_state?: boolean;
  };

  export type AccountOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "userId"
    | "type"
    | "provider"
    | "providerAccountId"
    | "refresh_token"
    | "access_token"
    | "expires_at"
    | "token_type"
    | "scope"
    | "id_token"
    | "session_state",
    ExtArgs["result"]["account"]
  >;
  export type AccountInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
  };
  export type AccountIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
  };
  export type AccountIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
  };

  export type $AccountPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "Account";
    objects: {
      user: Prisma.$UserPayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        userId: string;
        type: string;
        provider: string;
        providerAccountId: string;
        refresh_token: string | null;
        access_token: string | null;
        expires_at: number | null;
        token_type: string | null;
        scope: string | null;
        id_token: string | null;
        session_state: string | null;
      },
      ExtArgs["result"]["account"]
    >;
    composites: {};
  };

  type AccountGetPayload<
    S extends boolean | null | undefined | AccountDefaultArgs,
  > = $Result.GetResult<Prisma.$AccountPayload, S>;

  type AccountCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<AccountFindManyArgs, "select" | "include" | "distinct" | "omit"> & {
    select?: AccountCountAggregateInputType | true;
  };

  export interface AccountDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["Account"];
      meta: { name: "Account" };
    };
    /**
     * Find zero or one Account that matches the filter.
     * @param {AccountFindUniqueArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AccountFindUniqueArgs>(
      args: SelectSubset<T, AccountFindUniqueArgs<ExtArgs>>,
    ): Prisma__AccountClient<
      $Result.GetResult<
        Prisma.$AccountPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one Account that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AccountFindUniqueOrThrowArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AccountFindUniqueOrThrowArgs>(
      args: SelectSubset<T, AccountFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__AccountClient<
      $Result.GetResult<
        Prisma.$AccountPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first Account that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountFindFirstArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AccountFindFirstArgs>(
      args?: SelectSubset<T, AccountFindFirstArgs<ExtArgs>>,
    ): Prisma__AccountClient<
      $Result.GetResult<
        Prisma.$AccountPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first Account that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountFindFirstOrThrowArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AccountFindFirstOrThrowArgs>(
      args?: SelectSubset<T, AccountFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__AccountClient<
      $Result.GetResult<
        Prisma.$AccountPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more Accounts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Accounts
     * const accounts = await prisma.account.findMany()
     *
     * // Get first 10 Accounts
     * const accounts = await prisma.account.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const accountWithIdOnly = await prisma.account.findMany({ select: { id: true } })
     *
     */
    findMany<T extends AccountFindManyArgs>(
      args?: SelectSubset<T, AccountFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$AccountPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a Account.
     * @param {AccountCreateArgs} args - Arguments to create a Account.
     * @example
     * // Create one Account
     * const Account = await prisma.account.create({
     *   data: {
     *     // ... data to create a Account
     *   }
     * })
     *
     */
    create<T extends AccountCreateArgs>(
      args: SelectSubset<T, AccountCreateArgs<ExtArgs>>,
    ): Prisma__AccountClient<
      $Result.GetResult<
        Prisma.$AccountPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many Accounts.
     * @param {AccountCreateManyArgs} args - Arguments to create many Accounts.
     * @example
     * // Create many Accounts
     * const account = await prisma.account.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends AccountCreateManyArgs>(
      args?: SelectSubset<T, AccountCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many Accounts and returns the data saved in the database.
     * @param {AccountCreateManyAndReturnArgs} args - Arguments to create many Accounts.
     * @example
     * // Create many Accounts
     * const account = await prisma.account.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Accounts and only return the `id`
     * const accountWithIdOnly = await prisma.account.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends AccountCreateManyAndReturnArgs>(
      args?: SelectSubset<T, AccountCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$AccountPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a Account.
     * @param {AccountDeleteArgs} args - Arguments to delete one Account.
     * @example
     * // Delete one Account
     * const Account = await prisma.account.delete({
     *   where: {
     *     // ... filter to delete one Account
     *   }
     * })
     *
     */
    delete<T extends AccountDeleteArgs>(
      args: SelectSubset<T, AccountDeleteArgs<ExtArgs>>,
    ): Prisma__AccountClient<
      $Result.GetResult<
        Prisma.$AccountPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one Account.
     * @param {AccountUpdateArgs} args - Arguments to update one Account.
     * @example
     * // Update one Account
     * const account = await prisma.account.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends AccountUpdateArgs>(
      args: SelectSubset<T, AccountUpdateArgs<ExtArgs>>,
    ): Prisma__AccountClient<
      $Result.GetResult<
        Prisma.$AccountPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more Accounts.
     * @param {AccountDeleteManyArgs} args - Arguments to filter Accounts to delete.
     * @example
     * // Delete a few Accounts
     * const { count } = await prisma.account.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends AccountDeleteManyArgs>(
      args?: SelectSubset<T, AccountDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Accounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Accounts
     * const account = await prisma.account.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends AccountUpdateManyArgs>(
      args: SelectSubset<T, AccountUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Accounts and returns the data updated in the database.
     * @param {AccountUpdateManyAndReturnArgs} args - Arguments to update many Accounts.
     * @example
     * // Update many Accounts
     * const account = await prisma.account.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more Accounts and only return the `id`
     * const accountWithIdOnly = await prisma.account.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends AccountUpdateManyAndReturnArgs>(
      args: SelectSubset<T, AccountUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$AccountPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one Account.
     * @param {AccountUpsertArgs} args - Arguments to update or create a Account.
     * @example
     * // Update or create a Account
     * const account = await prisma.account.upsert({
     *   create: {
     *     // ... data to create a Account
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Account we want to update
     *   }
     * })
     */
    upsert<T extends AccountUpsertArgs>(
      args: SelectSubset<T, AccountUpsertArgs<ExtArgs>>,
    ): Prisma__AccountClient<
      $Result.GetResult<
        Prisma.$AccountPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of Accounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountCountArgs} args - Arguments to filter Accounts to count.
     * @example
     * // Count the number of Accounts
     * const count = await prisma.account.count({
     *   where: {
     *     // ... the filter for the Accounts we want to count
     *   }
     * })
     **/
    count<T extends AccountCountArgs>(
      args?: Subset<T, AccountCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], AccountCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a Account.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends AccountAggregateArgs>(
      args: Subset<T, AccountAggregateArgs>,
    ): Prisma.PrismaPromise<GetAccountAggregateType<T>>;

    /**
     * Group by Account.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends AccountGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AccountGroupByArgs["orderBy"] }
        : { orderBy?: AccountGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, AccountGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors
      ? GetAccountGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the Account model
     */
    readonly fields: AccountFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Account.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AccountClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    user<T extends UserDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, UserDefaultArgs<ExtArgs>>,
    ): Prisma__UserClient<
      | $Result.GetResult<
          Prisma.$UserPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the Account model
   */
  interface AccountFieldRefs {
    readonly id: FieldRef<"Account", "String">;
    readonly userId: FieldRef<"Account", "String">;
    readonly type: FieldRef<"Account", "String">;
    readonly provider: FieldRef<"Account", "String">;
    readonly providerAccountId: FieldRef<"Account", "String">;
    readonly refresh_token: FieldRef<"Account", "String">;
    readonly access_token: FieldRef<"Account", "String">;
    readonly expires_at: FieldRef<"Account", "Int">;
    readonly token_type: FieldRef<"Account", "String">;
    readonly scope: FieldRef<"Account", "String">;
    readonly id_token: FieldRef<"Account", "String">;
    readonly session_state: FieldRef<"Account", "String">;
  }

  // Custom InputTypes
  /**
   * Account findUnique
   */
  export type AccountFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null;
    /**
     * Filter, which Account to fetch.
     */
    where: AccountWhereUniqueInput;
  };

  /**
   * Account findUniqueOrThrow
   */
  export type AccountFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null;
    /**
     * Filter, which Account to fetch.
     */
    where: AccountWhereUniqueInput;
  };

  /**
   * Account findFirst
   */
  export type AccountFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null;
    /**
     * Filter, which Account to fetch.
     */
    where?: AccountWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Accounts to fetch.
     */
    orderBy?:
      | AccountOrderByWithRelationInput
      | AccountOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Accounts.
     */
    cursor?: AccountWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Accounts from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Accounts.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Accounts.
     */
    distinct?: AccountScalarFieldEnum | AccountScalarFieldEnum[];
  };

  /**
   * Account findFirstOrThrow
   */
  export type AccountFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null;
    /**
     * Filter, which Account to fetch.
     */
    where?: AccountWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Accounts to fetch.
     */
    orderBy?:
      | AccountOrderByWithRelationInput
      | AccountOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Accounts.
     */
    cursor?: AccountWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Accounts from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Accounts.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Accounts.
     */
    distinct?: AccountScalarFieldEnum | AccountScalarFieldEnum[];
  };

  /**
   * Account findMany
   */
  export type AccountFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null;
    /**
     * Filter, which Accounts to fetch.
     */
    where?: AccountWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Accounts to fetch.
     */
    orderBy?:
      | AccountOrderByWithRelationInput
      | AccountOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Accounts.
     */
    cursor?: AccountWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Accounts from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Accounts.
     */
    skip?: number;
    distinct?: AccountScalarFieldEnum | AccountScalarFieldEnum[];
  };

  /**
   * Account create
   */
  export type AccountCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null;
    /**
     * The data needed to create a Account.
     */
    data: XOR<AccountCreateInput, AccountUncheckedCreateInput>;
  };

  /**
   * Account createMany
   */
  export type AccountCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many Accounts.
     */
    data: AccountCreateManyInput | AccountCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * Account createManyAndReturn
   */
  export type AccountCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * The data used to create many Accounts.
     */
    data: AccountCreateManyInput | AccountCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * Account update
   */
  export type AccountUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null;
    /**
     * The data needed to update a Account.
     */
    data: XOR<AccountUpdateInput, AccountUncheckedUpdateInput>;
    /**
     * Choose, which Account to update.
     */
    where: AccountWhereUniqueInput;
  };

  /**
   * Account updateMany
   */
  export type AccountUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update Accounts.
     */
    data: XOR<AccountUpdateManyMutationInput, AccountUncheckedUpdateManyInput>;
    /**
     * Filter which Accounts to update
     */
    where?: AccountWhereInput;
    /**
     * Limit how many Accounts to update.
     */
    limit?: number;
  };

  /**
   * Account updateManyAndReturn
   */
  export type AccountUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * The data used to update Accounts.
     */
    data: XOR<AccountUpdateManyMutationInput, AccountUncheckedUpdateManyInput>;
    /**
     * Filter which Accounts to update
     */
    where?: AccountWhereInput;
    /**
     * Limit how many Accounts to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * Account upsert
   */
  export type AccountUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null;
    /**
     * The filter to search for the Account to update in case it exists.
     */
    where: AccountWhereUniqueInput;
    /**
     * In case the Account found by the `where` argument doesn't exist, create a new Account with this data.
     */
    create: XOR<AccountCreateInput, AccountUncheckedCreateInput>;
    /**
     * In case the Account was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AccountUpdateInput, AccountUncheckedUpdateInput>;
  };

  /**
   * Account delete
   */
  export type AccountDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null;
    /**
     * Filter which Account to delete.
     */
    where: AccountWhereUniqueInput;
  };

  /**
   * Account deleteMany
   */
  export type AccountDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Accounts to delete
     */
    where?: AccountWhereInput;
    /**
     * Limit how many Accounts to delete.
     */
    limit?: number;
  };

  /**
   * Account without action
   */
  export type AccountDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null;
  };

  /**
   * Model Session
   */

  export type AggregateSession = {
    _count: SessionCountAggregateOutputType | null;
    _min: SessionMinAggregateOutputType | null;
    _max: SessionMaxAggregateOutputType | null;
  };

  export type SessionMinAggregateOutputType = {
    id: string | null;
    sessionToken: string | null;
    userId: string | null;
    expires: Date | null;
    currentOrgId: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type SessionMaxAggregateOutputType = {
    id: string | null;
    sessionToken: string | null;
    userId: string | null;
    expires: Date | null;
    currentOrgId: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type SessionCountAggregateOutputType = {
    id: number;
    sessionToken: number;
    userId: number;
    expires: number;
    currentOrgId: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
  };

  export type SessionMinAggregateInputType = {
    id?: true;
    sessionToken?: true;
    userId?: true;
    expires?: true;
    currentOrgId?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type SessionMaxAggregateInputType = {
    id?: true;
    sessionToken?: true;
    userId?: true;
    expires?: true;
    currentOrgId?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type SessionCountAggregateInputType = {
    id?: true;
    sessionToken?: true;
    userId?: true;
    expires?: true;
    currentOrgId?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
  };

  export type SessionAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Session to aggregate.
     */
    where?: SessionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Sessions to fetch.
     */
    orderBy?:
      | SessionOrderByWithRelationInput
      | SessionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: SessionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Sessions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Sessions
     **/
    _count?: true | SessionCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: SessionMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: SessionMaxAggregateInputType;
  };

  export type GetSessionAggregateType<T extends SessionAggregateArgs> = {
    [P in keyof T & keyof AggregateSession]: P extends "_count" | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSession[P]>
      : GetScalarType<T[P], AggregateSession[P]>;
  };

  export type SessionGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: SessionWhereInput;
    orderBy?:
      | SessionOrderByWithAggregationInput
      | SessionOrderByWithAggregationInput[];
    by: SessionScalarFieldEnum[] | SessionScalarFieldEnum;
    having?: SessionScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: SessionCountAggregateInputType | true;
    _min?: SessionMinAggregateInputType;
    _max?: SessionMaxAggregateInputType;
  };

  export type SessionGroupByOutputType = {
    id: string;
    sessionToken: string;
    userId: string;
    expires: Date;
    currentOrgId: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: SessionCountAggregateOutputType | null;
    _min: SessionMinAggregateOutputType | null;
    _max: SessionMaxAggregateOutputType | null;
  };

  type GetSessionGroupByPayload<T extends SessionGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<SessionGroupByOutputType, T["by"]> & {
          [P in keyof T & keyof SessionGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SessionGroupByOutputType[P]>
            : GetScalarType<T[P], SessionGroupByOutputType[P]>;
        }
      >
    >;

  export type SessionSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      sessionToken?: boolean;
      userId?: boolean;
      expires?: boolean;
      currentOrgId?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
      currentOrg?: boolean | Session$currentOrgArgs<ExtArgs>;
    },
    ExtArgs["result"]["session"]
  >;

  export type SessionSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      sessionToken?: boolean;
      userId?: boolean;
      expires?: boolean;
      currentOrgId?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
      currentOrg?: boolean | Session$currentOrgArgs<ExtArgs>;
    },
    ExtArgs["result"]["session"]
  >;

  export type SessionSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      sessionToken?: boolean;
      userId?: boolean;
      expires?: boolean;
      currentOrgId?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
      currentOrg?: boolean | Session$currentOrgArgs<ExtArgs>;
    },
    ExtArgs["result"]["session"]
  >;

  export type SessionSelectScalar = {
    id?: boolean;
    sessionToken?: boolean;
    userId?: boolean;
    expires?: boolean;
    currentOrgId?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
  };

  export type SessionOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "sessionToken"
    | "userId"
    | "expires"
    | "currentOrgId"
    | "createdAt"
    | "updatedAt",
    ExtArgs["result"]["session"]
  >;
  export type SessionInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
    currentOrg?: boolean | Session$currentOrgArgs<ExtArgs>;
  };
  export type SessionIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
    currentOrg?: boolean | Session$currentOrgArgs<ExtArgs>;
  };
  export type SessionIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
    currentOrg?: boolean | Session$currentOrgArgs<ExtArgs>;
  };

  export type $SessionPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "Session";
    objects: {
      user: Prisma.$UserPayload<ExtArgs>;
      currentOrg: Prisma.$OrganizationPayload<ExtArgs> | null;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        sessionToken: string;
        userId: string;
        expires: Date;
        currentOrgId: string | null;
        createdAt: Date;
        updatedAt: Date;
      },
      ExtArgs["result"]["session"]
    >;
    composites: {};
  };

  type SessionGetPayload<
    S extends boolean | null | undefined | SessionDefaultArgs,
  > = $Result.GetResult<Prisma.$SessionPayload, S>;

  type SessionCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<SessionFindManyArgs, "select" | "include" | "distinct" | "omit"> & {
    select?: SessionCountAggregateInputType | true;
  };

  export interface SessionDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["Session"];
      meta: { name: "Session" };
    };
    /**
     * Find zero or one Session that matches the filter.
     * @param {SessionFindUniqueArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SessionFindUniqueArgs>(
      args: SelectSubset<T, SessionFindUniqueArgs<ExtArgs>>,
    ): Prisma__SessionClient<
      $Result.GetResult<
        Prisma.$SessionPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one Session that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SessionFindUniqueOrThrowArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SessionFindUniqueOrThrowArgs>(
      args: SelectSubset<T, SessionFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__SessionClient<
      $Result.GetResult<
        Prisma.$SessionPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first Session that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindFirstArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SessionFindFirstArgs>(
      args?: SelectSubset<T, SessionFindFirstArgs<ExtArgs>>,
    ): Prisma__SessionClient<
      $Result.GetResult<
        Prisma.$SessionPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first Session that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindFirstOrThrowArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SessionFindFirstOrThrowArgs>(
      args?: SelectSubset<T, SessionFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__SessionClient<
      $Result.GetResult<
        Prisma.$SessionPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more Sessions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Sessions
     * const sessions = await prisma.session.findMany()
     *
     * // Get first 10 Sessions
     * const sessions = await prisma.session.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const sessionWithIdOnly = await prisma.session.findMany({ select: { id: true } })
     *
     */
    findMany<T extends SessionFindManyArgs>(
      args?: SelectSubset<T, SessionFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$SessionPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a Session.
     * @param {SessionCreateArgs} args - Arguments to create a Session.
     * @example
     * // Create one Session
     * const Session = await prisma.session.create({
     *   data: {
     *     // ... data to create a Session
     *   }
     * })
     *
     */
    create<T extends SessionCreateArgs>(
      args: SelectSubset<T, SessionCreateArgs<ExtArgs>>,
    ): Prisma__SessionClient<
      $Result.GetResult<
        Prisma.$SessionPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many Sessions.
     * @param {SessionCreateManyArgs} args - Arguments to create many Sessions.
     * @example
     * // Create many Sessions
     * const session = await prisma.session.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends SessionCreateManyArgs>(
      args?: SelectSubset<T, SessionCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many Sessions and returns the data saved in the database.
     * @param {SessionCreateManyAndReturnArgs} args - Arguments to create many Sessions.
     * @example
     * // Create many Sessions
     * const session = await prisma.session.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Sessions and only return the `id`
     * const sessionWithIdOnly = await prisma.session.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends SessionCreateManyAndReturnArgs>(
      args?: SelectSubset<T, SessionCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$SessionPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a Session.
     * @param {SessionDeleteArgs} args - Arguments to delete one Session.
     * @example
     * // Delete one Session
     * const Session = await prisma.session.delete({
     *   where: {
     *     // ... filter to delete one Session
     *   }
     * })
     *
     */
    delete<T extends SessionDeleteArgs>(
      args: SelectSubset<T, SessionDeleteArgs<ExtArgs>>,
    ): Prisma__SessionClient<
      $Result.GetResult<
        Prisma.$SessionPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one Session.
     * @param {SessionUpdateArgs} args - Arguments to update one Session.
     * @example
     * // Update one Session
     * const session = await prisma.session.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends SessionUpdateArgs>(
      args: SelectSubset<T, SessionUpdateArgs<ExtArgs>>,
    ): Prisma__SessionClient<
      $Result.GetResult<
        Prisma.$SessionPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more Sessions.
     * @param {SessionDeleteManyArgs} args - Arguments to filter Sessions to delete.
     * @example
     * // Delete a few Sessions
     * const { count } = await prisma.session.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends SessionDeleteManyArgs>(
      args?: SelectSubset<T, SessionDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Sessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Sessions
     * const session = await prisma.session.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends SessionUpdateManyArgs>(
      args: SelectSubset<T, SessionUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Sessions and returns the data updated in the database.
     * @param {SessionUpdateManyAndReturnArgs} args - Arguments to update many Sessions.
     * @example
     * // Update many Sessions
     * const session = await prisma.session.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more Sessions and only return the `id`
     * const sessionWithIdOnly = await prisma.session.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends SessionUpdateManyAndReturnArgs>(
      args: SelectSubset<T, SessionUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$SessionPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one Session.
     * @param {SessionUpsertArgs} args - Arguments to update or create a Session.
     * @example
     * // Update or create a Session
     * const session = await prisma.session.upsert({
     *   create: {
     *     // ... data to create a Session
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Session we want to update
     *   }
     * })
     */
    upsert<T extends SessionUpsertArgs>(
      args: SelectSubset<T, SessionUpsertArgs<ExtArgs>>,
    ): Prisma__SessionClient<
      $Result.GetResult<
        Prisma.$SessionPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of Sessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionCountArgs} args - Arguments to filter Sessions to count.
     * @example
     * // Count the number of Sessions
     * const count = await prisma.session.count({
     *   where: {
     *     // ... the filter for the Sessions we want to count
     *   }
     * })
     **/
    count<T extends SessionCountArgs>(
      args?: Subset<T, SessionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], SessionCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a Session.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends SessionAggregateArgs>(
      args: Subset<T, SessionAggregateArgs>,
    ): Prisma.PrismaPromise<GetSessionAggregateType<T>>;

    /**
     * Group by Session.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends SessionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SessionGroupByArgs["orderBy"] }
        : { orderBy?: SessionGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, SessionGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors
      ? GetSessionGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the Session model
     */
    readonly fields: SessionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Session.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SessionClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    user<T extends UserDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, UserDefaultArgs<ExtArgs>>,
    ): Prisma__UserClient<
      | $Result.GetResult<
          Prisma.$UserPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    currentOrg<T extends Session$currentOrgArgs<ExtArgs> = {}>(
      args?: Subset<T, Session$currentOrgArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      $Result.GetResult<
        Prisma.$OrganizationPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the Session model
   */
  interface SessionFieldRefs {
    readonly id: FieldRef<"Session", "String">;
    readonly sessionToken: FieldRef<"Session", "String">;
    readonly userId: FieldRef<"Session", "String">;
    readonly expires: FieldRef<"Session", "DateTime">;
    readonly currentOrgId: FieldRef<"Session", "String">;
    readonly createdAt: FieldRef<"Session", "DateTime">;
    readonly updatedAt: FieldRef<"Session", "DateTime">;
  }

  // Custom InputTypes
  /**
   * Session findUnique
   */
  export type SessionFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null;
    /**
     * Filter, which Session to fetch.
     */
    where: SessionWhereUniqueInput;
  };

  /**
   * Session findUniqueOrThrow
   */
  export type SessionFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null;
    /**
     * Filter, which Session to fetch.
     */
    where: SessionWhereUniqueInput;
  };

  /**
   * Session findFirst
   */
  export type SessionFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null;
    /**
     * Filter, which Session to fetch.
     */
    where?: SessionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Sessions to fetch.
     */
    orderBy?:
      | SessionOrderByWithRelationInput
      | SessionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Sessions.
     */
    cursor?: SessionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Sessions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Sessions.
     */
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[];
  };

  /**
   * Session findFirstOrThrow
   */
  export type SessionFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null;
    /**
     * Filter, which Session to fetch.
     */
    where?: SessionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Sessions to fetch.
     */
    orderBy?:
      | SessionOrderByWithRelationInput
      | SessionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Sessions.
     */
    cursor?: SessionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Sessions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Sessions.
     */
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[];
  };

  /**
   * Session findMany
   */
  export type SessionFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null;
    /**
     * Filter, which Sessions to fetch.
     */
    where?: SessionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Sessions to fetch.
     */
    orderBy?:
      | SessionOrderByWithRelationInput
      | SessionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Sessions.
     */
    cursor?: SessionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Sessions.
     */
    skip?: number;
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[];
  };

  /**
   * Session create
   */
  export type SessionCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null;
    /**
     * The data needed to create a Session.
     */
    data: XOR<SessionCreateInput, SessionUncheckedCreateInput>;
  };

  /**
   * Session createMany
   */
  export type SessionCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many Sessions.
     */
    data: SessionCreateManyInput | SessionCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * Session createManyAndReturn
   */
  export type SessionCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * The data used to create many Sessions.
     */
    data: SessionCreateManyInput | SessionCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * Session update
   */
  export type SessionUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null;
    /**
     * The data needed to update a Session.
     */
    data: XOR<SessionUpdateInput, SessionUncheckedUpdateInput>;
    /**
     * Choose, which Session to update.
     */
    where: SessionWhereUniqueInput;
  };

  /**
   * Session updateMany
   */
  export type SessionUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update Sessions.
     */
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyInput>;
    /**
     * Filter which Sessions to update
     */
    where?: SessionWhereInput;
    /**
     * Limit how many Sessions to update.
     */
    limit?: number;
  };

  /**
   * Session updateManyAndReturn
   */
  export type SessionUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * The data used to update Sessions.
     */
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyInput>;
    /**
     * Filter which Sessions to update
     */
    where?: SessionWhereInput;
    /**
     * Limit how many Sessions to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * Session upsert
   */
  export type SessionUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null;
    /**
     * The filter to search for the Session to update in case it exists.
     */
    where: SessionWhereUniqueInput;
    /**
     * In case the Session found by the `where` argument doesn't exist, create a new Session with this data.
     */
    create: XOR<SessionCreateInput, SessionUncheckedCreateInput>;
    /**
     * In case the Session was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SessionUpdateInput, SessionUncheckedUpdateInput>;
  };

  /**
   * Session delete
   */
  export type SessionDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null;
    /**
     * Filter which Session to delete.
     */
    where: SessionWhereUniqueInput;
  };

  /**
   * Session deleteMany
   */
  export type SessionDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Sessions to delete
     */
    where?: SessionWhereInput;
    /**
     * Limit how many Sessions to delete.
     */
    limit?: number;
  };

  /**
   * Session.currentOrg
   */
  export type Session$currentOrgArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null;
    where?: OrganizationWhereInput;
  };

  /**
   * Session without action
   */
  export type SessionDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null;
  };

  /**
   * Model VerificationToken
   */

  export type AggregateVerificationToken = {
    _count: VerificationTokenCountAggregateOutputType | null;
    _min: VerificationTokenMinAggregateOutputType | null;
    _max: VerificationTokenMaxAggregateOutputType | null;
  };

  export type VerificationTokenMinAggregateOutputType = {
    identifier: string | null;
    token: string | null;
    expires: Date | null;
  };

  export type VerificationTokenMaxAggregateOutputType = {
    identifier: string | null;
    token: string | null;
    expires: Date | null;
  };

  export type VerificationTokenCountAggregateOutputType = {
    identifier: number;
    token: number;
    expires: number;
    _all: number;
  };

  export type VerificationTokenMinAggregateInputType = {
    identifier?: true;
    token?: true;
    expires?: true;
  };

  export type VerificationTokenMaxAggregateInputType = {
    identifier?: true;
    token?: true;
    expires?: true;
  };

  export type VerificationTokenCountAggregateInputType = {
    identifier?: true;
    token?: true;
    expires?: true;
    _all?: true;
  };

  export type VerificationTokenAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which VerificationToken to aggregate.
     */
    where?: VerificationTokenWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of VerificationTokens to fetch.
     */
    orderBy?:
      | VerificationTokenOrderByWithRelationInput
      | VerificationTokenOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: VerificationTokenWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` VerificationTokens from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` VerificationTokens.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned VerificationTokens
     **/
    _count?: true | VerificationTokenCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: VerificationTokenMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: VerificationTokenMaxAggregateInputType;
  };

  export type GetVerificationTokenAggregateType<
    T extends VerificationTokenAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateVerificationToken]: P extends
      | "_count"
      | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateVerificationToken[P]>
      : GetScalarType<T[P], AggregateVerificationToken[P]>;
  };

  export type VerificationTokenGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: VerificationTokenWhereInput;
    orderBy?:
      | VerificationTokenOrderByWithAggregationInput
      | VerificationTokenOrderByWithAggregationInput[];
    by: VerificationTokenScalarFieldEnum[] | VerificationTokenScalarFieldEnum;
    having?: VerificationTokenScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: VerificationTokenCountAggregateInputType | true;
    _min?: VerificationTokenMinAggregateInputType;
    _max?: VerificationTokenMaxAggregateInputType;
  };

  export type VerificationTokenGroupByOutputType = {
    identifier: string;
    token: string;
    expires: Date;
    _count: VerificationTokenCountAggregateOutputType | null;
    _min: VerificationTokenMinAggregateOutputType | null;
    _max: VerificationTokenMaxAggregateOutputType | null;
  };

  type GetVerificationTokenGroupByPayload<
    T extends VerificationTokenGroupByArgs,
  > = Prisma.PrismaPromise<
    Array<
      PickEnumerable<VerificationTokenGroupByOutputType, T["by"]> & {
        [P in keyof T &
          keyof VerificationTokenGroupByOutputType]: P extends "_count"
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], VerificationTokenGroupByOutputType[P]>
          : GetScalarType<T[P], VerificationTokenGroupByOutputType[P]>;
      }
    >
  >;

  export type VerificationTokenSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      identifier?: boolean;
      token?: boolean;
      expires?: boolean;
    },
    ExtArgs["result"]["verificationToken"]
  >;

  export type VerificationTokenSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      identifier?: boolean;
      token?: boolean;
      expires?: boolean;
    },
    ExtArgs["result"]["verificationToken"]
  >;

  export type VerificationTokenSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      identifier?: boolean;
      token?: boolean;
      expires?: boolean;
    },
    ExtArgs["result"]["verificationToken"]
  >;

  export type VerificationTokenSelectScalar = {
    identifier?: boolean;
    token?: boolean;
    expires?: boolean;
  };

  export type VerificationTokenOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    "identifier" | "token" | "expires",
    ExtArgs["result"]["verificationToken"]
  >;

  export type $VerificationTokenPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "VerificationToken";
    objects: {};
    scalars: $Extensions.GetPayloadResult<
      {
        identifier: string;
        token: string;
        expires: Date;
      },
      ExtArgs["result"]["verificationToken"]
    >;
    composites: {};
  };

  type VerificationTokenGetPayload<
    S extends boolean | null | undefined | VerificationTokenDefaultArgs,
  > = $Result.GetResult<Prisma.$VerificationTokenPayload, S>;

  type VerificationTokenCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    VerificationTokenFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: VerificationTokenCountAggregateInputType | true;
  };

  export interface VerificationTokenDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["VerificationToken"];
      meta: { name: "VerificationToken" };
    };
    /**
     * Find zero or one VerificationToken that matches the filter.
     * @param {VerificationTokenFindUniqueArgs} args - Arguments to find a VerificationToken
     * @example
     * // Get one VerificationToken
     * const verificationToken = await prisma.verificationToken.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends VerificationTokenFindUniqueArgs>(
      args: SelectSubset<T, VerificationTokenFindUniqueArgs<ExtArgs>>,
    ): Prisma__VerificationTokenClient<
      $Result.GetResult<
        Prisma.$VerificationTokenPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one VerificationToken that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {VerificationTokenFindUniqueOrThrowArgs} args - Arguments to find a VerificationToken
     * @example
     * // Get one VerificationToken
     * const verificationToken = await prisma.verificationToken.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends VerificationTokenFindUniqueOrThrowArgs>(
      args: SelectSubset<T, VerificationTokenFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__VerificationTokenClient<
      $Result.GetResult<
        Prisma.$VerificationTokenPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first VerificationToken that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenFindFirstArgs} args - Arguments to find a VerificationToken
     * @example
     * // Get one VerificationToken
     * const verificationToken = await prisma.verificationToken.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends VerificationTokenFindFirstArgs>(
      args?: SelectSubset<T, VerificationTokenFindFirstArgs<ExtArgs>>,
    ): Prisma__VerificationTokenClient<
      $Result.GetResult<
        Prisma.$VerificationTokenPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first VerificationToken that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenFindFirstOrThrowArgs} args - Arguments to find a VerificationToken
     * @example
     * // Get one VerificationToken
     * const verificationToken = await prisma.verificationToken.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends VerificationTokenFindFirstOrThrowArgs>(
      args?: SelectSubset<T, VerificationTokenFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__VerificationTokenClient<
      $Result.GetResult<
        Prisma.$VerificationTokenPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more VerificationTokens that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all VerificationTokens
     * const verificationTokens = await prisma.verificationToken.findMany()
     *
     * // Get first 10 VerificationTokens
     * const verificationTokens = await prisma.verificationToken.findMany({ take: 10 })
     *
     * // Only select the `identifier`
     * const verificationTokenWithIdentifierOnly = await prisma.verificationToken.findMany({ select: { identifier: true } })
     *
     */
    findMany<T extends VerificationTokenFindManyArgs>(
      args?: SelectSubset<T, VerificationTokenFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$VerificationTokenPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a VerificationToken.
     * @param {VerificationTokenCreateArgs} args - Arguments to create a VerificationToken.
     * @example
     * // Create one VerificationToken
     * const VerificationToken = await prisma.verificationToken.create({
     *   data: {
     *     // ... data to create a VerificationToken
     *   }
     * })
     *
     */
    create<T extends VerificationTokenCreateArgs>(
      args: SelectSubset<T, VerificationTokenCreateArgs<ExtArgs>>,
    ): Prisma__VerificationTokenClient<
      $Result.GetResult<
        Prisma.$VerificationTokenPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many VerificationTokens.
     * @param {VerificationTokenCreateManyArgs} args - Arguments to create many VerificationTokens.
     * @example
     * // Create many VerificationTokens
     * const verificationToken = await prisma.verificationToken.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends VerificationTokenCreateManyArgs>(
      args?: SelectSubset<T, VerificationTokenCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many VerificationTokens and returns the data saved in the database.
     * @param {VerificationTokenCreateManyAndReturnArgs} args - Arguments to create many VerificationTokens.
     * @example
     * // Create many VerificationTokens
     * const verificationToken = await prisma.verificationToken.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many VerificationTokens and only return the `identifier`
     * const verificationTokenWithIdentifierOnly = await prisma.verificationToken.createManyAndReturn({
     *   select: { identifier: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends VerificationTokenCreateManyAndReturnArgs>(
      args?: SelectSubset<T, VerificationTokenCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$VerificationTokenPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a VerificationToken.
     * @param {VerificationTokenDeleteArgs} args - Arguments to delete one VerificationToken.
     * @example
     * // Delete one VerificationToken
     * const VerificationToken = await prisma.verificationToken.delete({
     *   where: {
     *     // ... filter to delete one VerificationToken
     *   }
     * })
     *
     */
    delete<T extends VerificationTokenDeleteArgs>(
      args: SelectSubset<T, VerificationTokenDeleteArgs<ExtArgs>>,
    ): Prisma__VerificationTokenClient<
      $Result.GetResult<
        Prisma.$VerificationTokenPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one VerificationToken.
     * @param {VerificationTokenUpdateArgs} args - Arguments to update one VerificationToken.
     * @example
     * // Update one VerificationToken
     * const verificationToken = await prisma.verificationToken.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends VerificationTokenUpdateArgs>(
      args: SelectSubset<T, VerificationTokenUpdateArgs<ExtArgs>>,
    ): Prisma__VerificationTokenClient<
      $Result.GetResult<
        Prisma.$VerificationTokenPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more VerificationTokens.
     * @param {VerificationTokenDeleteManyArgs} args - Arguments to filter VerificationTokens to delete.
     * @example
     * // Delete a few VerificationTokens
     * const { count } = await prisma.verificationToken.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends VerificationTokenDeleteManyArgs>(
      args?: SelectSubset<T, VerificationTokenDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more VerificationTokens.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many VerificationTokens
     * const verificationToken = await prisma.verificationToken.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends VerificationTokenUpdateManyArgs>(
      args: SelectSubset<T, VerificationTokenUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more VerificationTokens and returns the data updated in the database.
     * @param {VerificationTokenUpdateManyAndReturnArgs} args - Arguments to update many VerificationTokens.
     * @example
     * // Update many VerificationTokens
     * const verificationToken = await prisma.verificationToken.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more VerificationTokens and only return the `identifier`
     * const verificationTokenWithIdentifierOnly = await prisma.verificationToken.updateManyAndReturn({
     *   select: { identifier: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends VerificationTokenUpdateManyAndReturnArgs>(
      args: SelectSubset<T, VerificationTokenUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$VerificationTokenPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one VerificationToken.
     * @param {VerificationTokenUpsertArgs} args - Arguments to update or create a VerificationToken.
     * @example
     * // Update or create a VerificationToken
     * const verificationToken = await prisma.verificationToken.upsert({
     *   create: {
     *     // ... data to create a VerificationToken
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the VerificationToken we want to update
     *   }
     * })
     */
    upsert<T extends VerificationTokenUpsertArgs>(
      args: SelectSubset<T, VerificationTokenUpsertArgs<ExtArgs>>,
    ): Prisma__VerificationTokenClient<
      $Result.GetResult<
        Prisma.$VerificationTokenPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of VerificationTokens.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenCountArgs} args - Arguments to filter VerificationTokens to count.
     * @example
     * // Count the number of VerificationTokens
     * const count = await prisma.verificationToken.count({
     *   where: {
     *     // ... the filter for the VerificationTokens we want to count
     *   }
     * })
     **/
    count<T extends VerificationTokenCountArgs>(
      args?: Subset<T, VerificationTokenCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<
              T["select"],
              VerificationTokenCountAggregateOutputType
            >
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a VerificationToken.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends VerificationTokenAggregateArgs>(
      args: Subset<T, VerificationTokenAggregateArgs>,
    ): Prisma.PrismaPromise<GetVerificationTokenAggregateType<T>>;

    /**
     * Group by VerificationToken.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationTokenGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends VerificationTokenGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: VerificationTokenGroupByArgs["orderBy"] }
        : { orderBy?: VerificationTokenGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, VerificationTokenGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetVerificationTokenGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the VerificationToken model
     */
    readonly fields: VerificationTokenFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for VerificationToken.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__VerificationTokenClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the VerificationToken model
   */
  interface VerificationTokenFieldRefs {
    readonly identifier: FieldRef<"VerificationToken", "String">;
    readonly token: FieldRef<"VerificationToken", "String">;
    readonly expires: FieldRef<"VerificationToken", "DateTime">;
  }

  // Custom InputTypes
  /**
   * VerificationToken findUnique
   */
  export type VerificationTokenFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null;
    /**
     * Filter, which VerificationToken to fetch.
     */
    where: VerificationTokenWhereUniqueInput;
  };

  /**
   * VerificationToken findUniqueOrThrow
   */
  export type VerificationTokenFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null;
    /**
     * Filter, which VerificationToken to fetch.
     */
    where: VerificationTokenWhereUniqueInput;
  };

  /**
   * VerificationToken findFirst
   */
  export type VerificationTokenFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null;
    /**
     * Filter, which VerificationToken to fetch.
     */
    where?: VerificationTokenWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of VerificationTokens to fetch.
     */
    orderBy?:
      | VerificationTokenOrderByWithRelationInput
      | VerificationTokenOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for VerificationTokens.
     */
    cursor?: VerificationTokenWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` VerificationTokens from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` VerificationTokens.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of VerificationTokens.
     */
    distinct?:
      | VerificationTokenScalarFieldEnum
      | VerificationTokenScalarFieldEnum[];
  };

  /**
   * VerificationToken findFirstOrThrow
   */
  export type VerificationTokenFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null;
    /**
     * Filter, which VerificationToken to fetch.
     */
    where?: VerificationTokenWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of VerificationTokens to fetch.
     */
    orderBy?:
      | VerificationTokenOrderByWithRelationInput
      | VerificationTokenOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for VerificationTokens.
     */
    cursor?: VerificationTokenWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` VerificationTokens from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` VerificationTokens.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of VerificationTokens.
     */
    distinct?:
      | VerificationTokenScalarFieldEnum
      | VerificationTokenScalarFieldEnum[];
  };

  /**
   * VerificationToken findMany
   */
  export type VerificationTokenFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null;
    /**
     * Filter, which VerificationTokens to fetch.
     */
    where?: VerificationTokenWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of VerificationTokens to fetch.
     */
    orderBy?:
      | VerificationTokenOrderByWithRelationInput
      | VerificationTokenOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing VerificationTokens.
     */
    cursor?: VerificationTokenWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` VerificationTokens from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` VerificationTokens.
     */
    skip?: number;
    distinct?:
      | VerificationTokenScalarFieldEnum
      | VerificationTokenScalarFieldEnum[];
  };

  /**
   * VerificationToken create
   */
  export type VerificationTokenCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null;
    /**
     * The data needed to create a VerificationToken.
     */
    data: XOR<
      VerificationTokenCreateInput,
      VerificationTokenUncheckedCreateInput
    >;
  };

  /**
   * VerificationToken createMany
   */
  export type VerificationTokenCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many VerificationTokens.
     */
    data: VerificationTokenCreateManyInput | VerificationTokenCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * VerificationToken createManyAndReturn
   */
  export type VerificationTokenCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null;
    /**
     * The data used to create many VerificationTokens.
     */
    data: VerificationTokenCreateManyInput | VerificationTokenCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * VerificationToken update
   */
  export type VerificationTokenUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null;
    /**
     * The data needed to update a VerificationToken.
     */
    data: XOR<
      VerificationTokenUpdateInput,
      VerificationTokenUncheckedUpdateInput
    >;
    /**
     * Choose, which VerificationToken to update.
     */
    where: VerificationTokenWhereUniqueInput;
  };

  /**
   * VerificationToken updateMany
   */
  export type VerificationTokenUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update VerificationTokens.
     */
    data: XOR<
      VerificationTokenUpdateManyMutationInput,
      VerificationTokenUncheckedUpdateManyInput
    >;
    /**
     * Filter which VerificationTokens to update
     */
    where?: VerificationTokenWhereInput;
    /**
     * Limit how many VerificationTokens to update.
     */
    limit?: number;
  };

  /**
   * VerificationToken updateManyAndReturn
   */
  export type VerificationTokenUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null;
    /**
     * The data used to update VerificationTokens.
     */
    data: XOR<
      VerificationTokenUpdateManyMutationInput,
      VerificationTokenUncheckedUpdateManyInput
    >;
    /**
     * Filter which VerificationTokens to update
     */
    where?: VerificationTokenWhereInput;
    /**
     * Limit how many VerificationTokens to update.
     */
    limit?: number;
  };

  /**
   * VerificationToken upsert
   */
  export type VerificationTokenUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null;
    /**
     * The filter to search for the VerificationToken to update in case it exists.
     */
    where: VerificationTokenWhereUniqueInput;
    /**
     * In case the VerificationToken found by the `where` argument doesn't exist, create a new VerificationToken with this data.
     */
    create: XOR<
      VerificationTokenCreateInput,
      VerificationTokenUncheckedCreateInput
    >;
    /**
     * In case the VerificationToken was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      VerificationTokenUpdateInput,
      VerificationTokenUncheckedUpdateInput
    >;
  };

  /**
   * VerificationToken delete
   */
  export type VerificationTokenDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null;
    /**
     * Filter which VerificationToken to delete.
     */
    where: VerificationTokenWhereUniqueInput;
  };

  /**
   * VerificationToken deleteMany
   */
  export type VerificationTokenDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which VerificationTokens to delete
     */
    where?: VerificationTokenWhereInput;
    /**
     * Limit how many VerificationTokens to delete.
     */
    limit?: number;
  };

  /**
   * VerificationToken without action
   */
  export type VerificationTokenDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VerificationToken
     */
    select?: VerificationTokenSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VerificationToken
     */
    omit?: VerificationTokenOmit<ExtArgs> | null;
  };

  /**
   * Model Organization
   */

  export type AggregateOrganization = {
    _count: OrganizationCountAggregateOutputType | null;
    _min: OrganizationMinAggregateOutputType | null;
    _max: OrganizationMaxAggregateOutputType | null;
  };

  export type OrganizationMinAggregateOutputType = {
    id: string | null;
    name: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type OrganizationMaxAggregateOutputType = {
    id: string | null;
    name: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type OrganizationCountAggregateOutputType = {
    id: number;
    name: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
  };

  export type OrganizationMinAggregateInputType = {
    id?: true;
    name?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type OrganizationMaxAggregateInputType = {
    id?: true;
    name?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type OrganizationCountAggregateInputType = {
    id?: true;
    name?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
  };

  export type OrganizationAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Organization to aggregate.
     */
    where?: OrganizationWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Organizations to fetch.
     */
    orderBy?:
      | OrganizationOrderByWithRelationInput
      | OrganizationOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: OrganizationWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Organizations from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Organizations.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Organizations
     **/
    _count?: true | OrganizationCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: OrganizationMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: OrganizationMaxAggregateInputType;
  };

  export type GetOrganizationAggregateType<
    T extends OrganizationAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateOrganization]: P extends "_count" | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOrganization[P]>
      : GetScalarType<T[P], AggregateOrganization[P]>;
  };

  export type OrganizationGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: OrganizationWhereInput;
    orderBy?:
      | OrganizationOrderByWithAggregationInput
      | OrganizationOrderByWithAggregationInput[];
    by: OrganizationScalarFieldEnum[] | OrganizationScalarFieldEnum;
    having?: OrganizationScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: OrganizationCountAggregateInputType | true;
    _min?: OrganizationMinAggregateInputType;
    _max?: OrganizationMaxAggregateInputType;
  };

  export type OrganizationGroupByOutputType = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: OrganizationCountAggregateOutputType | null;
    _min: OrganizationMinAggregateOutputType | null;
    _max: OrganizationMaxAggregateOutputType | null;
  };

  type GetOrganizationGroupByPayload<T extends OrganizationGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<OrganizationGroupByOutputType, T["by"]> & {
          [P in keyof T &
            keyof OrganizationGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OrganizationGroupByOutputType[P]>
            : GetScalarType<T[P], OrganizationGroupByOutputType[P]>;
        }
      >
    >;

  export type OrganizationSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      name?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      members?: boolean | Organization$membersArgs<ExtArgs>;
      auditLogs?: boolean | Organization$auditLogsArgs<ExtArgs>;
      featureFlags?: boolean | Organization$featureFlagsArgs<ExtArgs>;
      applications?: boolean | Organization$applicationsArgs<ExtArgs>;
      screenerQuestions?: boolean | Organization$screenerQuestionsArgs<ExtArgs>;
      sessions?: boolean | Organization$sessionsArgs<ExtArgs>;
      _count?: boolean | OrganizationCountOutputTypeDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["organization"]
  >;

  export type OrganizationSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      name?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs["result"]["organization"]
  >;

  export type OrganizationSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      name?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs["result"]["organization"]
  >;

  export type OrganizationSelectScalar = {
    id?: boolean;
    name?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
  };

  export type OrganizationOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    "id" | "name" | "createdAt" | "updatedAt",
    ExtArgs["result"]["organization"]
  >;
  export type OrganizationInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    members?: boolean | Organization$membersArgs<ExtArgs>;
    auditLogs?: boolean | Organization$auditLogsArgs<ExtArgs>;
    featureFlags?: boolean | Organization$featureFlagsArgs<ExtArgs>;
    applications?: boolean | Organization$applicationsArgs<ExtArgs>;
    screenerQuestions?: boolean | Organization$screenerQuestionsArgs<ExtArgs>;
    sessions?: boolean | Organization$sessionsArgs<ExtArgs>;
    _count?: boolean | OrganizationCountOutputTypeDefaultArgs<ExtArgs>;
  };
  export type OrganizationIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {};
  export type OrganizationIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {};

  export type $OrganizationPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "Organization";
    objects: {
      members: Prisma.$OrganizationMemberPayload<ExtArgs>[];
      auditLogs: Prisma.$AuditLogPayload<ExtArgs>[];
      featureFlags: Prisma.$FeatureFlagPayload<ExtArgs>[];
      applications: Prisma.$VolunteerApplicationPayload<ExtArgs>[];
      screenerQuestions: Prisma.$ScreenerQuestionPayload<ExtArgs>[];
      sessions: Prisma.$SessionPayload<ExtArgs>[];
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
      },
      ExtArgs["result"]["organization"]
    >;
    composites: {};
  };

  type OrganizationGetPayload<
    S extends boolean | null | undefined | OrganizationDefaultArgs,
  > = $Result.GetResult<Prisma.$OrganizationPayload, S>;

  type OrganizationCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    OrganizationFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: OrganizationCountAggregateInputType | true;
  };

  export interface OrganizationDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["Organization"];
      meta: { name: "Organization" };
    };
    /**
     * Find zero or one Organization that matches the filter.
     * @param {OrganizationFindUniqueArgs} args - Arguments to find a Organization
     * @example
     * // Get one Organization
     * const organization = await prisma.organization.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends OrganizationFindUniqueArgs>(
      args: SelectSubset<T, OrganizationFindUniqueArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      $Result.GetResult<
        Prisma.$OrganizationPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one Organization that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {OrganizationFindUniqueOrThrowArgs} args - Arguments to find a Organization
     * @example
     * // Get one Organization
     * const organization = await prisma.organization.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends OrganizationFindUniqueOrThrowArgs>(
      args: SelectSubset<T, OrganizationFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      $Result.GetResult<
        Prisma.$OrganizationPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first Organization that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationFindFirstArgs} args - Arguments to find a Organization
     * @example
     * // Get one Organization
     * const organization = await prisma.organization.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends OrganizationFindFirstArgs>(
      args?: SelectSubset<T, OrganizationFindFirstArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      $Result.GetResult<
        Prisma.$OrganizationPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first Organization that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationFindFirstOrThrowArgs} args - Arguments to find a Organization
     * @example
     * // Get one Organization
     * const organization = await prisma.organization.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends OrganizationFindFirstOrThrowArgs>(
      args?: SelectSubset<T, OrganizationFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      $Result.GetResult<
        Prisma.$OrganizationPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more Organizations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Organizations
     * const organizations = await prisma.organization.findMany()
     *
     * // Get first 10 Organizations
     * const organizations = await prisma.organization.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const organizationWithIdOnly = await prisma.organization.findMany({ select: { id: true } })
     *
     */
    findMany<T extends OrganizationFindManyArgs>(
      args?: SelectSubset<T, OrganizationFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$OrganizationPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a Organization.
     * @param {OrganizationCreateArgs} args - Arguments to create a Organization.
     * @example
     * // Create one Organization
     * const Organization = await prisma.organization.create({
     *   data: {
     *     // ... data to create a Organization
     *   }
     * })
     *
     */
    create<T extends OrganizationCreateArgs>(
      args: SelectSubset<T, OrganizationCreateArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      $Result.GetResult<
        Prisma.$OrganizationPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many Organizations.
     * @param {OrganizationCreateManyArgs} args - Arguments to create many Organizations.
     * @example
     * // Create many Organizations
     * const organization = await prisma.organization.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends OrganizationCreateManyArgs>(
      args?: SelectSubset<T, OrganizationCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many Organizations and returns the data saved in the database.
     * @param {OrganizationCreateManyAndReturnArgs} args - Arguments to create many Organizations.
     * @example
     * // Create many Organizations
     * const organization = await prisma.organization.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Organizations and only return the `id`
     * const organizationWithIdOnly = await prisma.organization.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends OrganizationCreateManyAndReturnArgs>(
      args?: SelectSubset<T, OrganizationCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$OrganizationPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a Organization.
     * @param {OrganizationDeleteArgs} args - Arguments to delete one Organization.
     * @example
     * // Delete one Organization
     * const Organization = await prisma.organization.delete({
     *   where: {
     *     // ... filter to delete one Organization
     *   }
     * })
     *
     */
    delete<T extends OrganizationDeleteArgs>(
      args: SelectSubset<T, OrganizationDeleteArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      $Result.GetResult<
        Prisma.$OrganizationPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one Organization.
     * @param {OrganizationUpdateArgs} args - Arguments to update one Organization.
     * @example
     * // Update one Organization
     * const organization = await prisma.organization.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends OrganizationUpdateArgs>(
      args: SelectSubset<T, OrganizationUpdateArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      $Result.GetResult<
        Prisma.$OrganizationPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more Organizations.
     * @param {OrganizationDeleteManyArgs} args - Arguments to filter Organizations to delete.
     * @example
     * // Delete a few Organizations
     * const { count } = await prisma.organization.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends OrganizationDeleteManyArgs>(
      args?: SelectSubset<T, OrganizationDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Organizations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Organizations
     * const organization = await prisma.organization.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends OrganizationUpdateManyArgs>(
      args: SelectSubset<T, OrganizationUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Organizations and returns the data updated in the database.
     * @param {OrganizationUpdateManyAndReturnArgs} args - Arguments to update many Organizations.
     * @example
     * // Update many Organizations
     * const organization = await prisma.organization.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more Organizations and only return the `id`
     * const organizationWithIdOnly = await prisma.organization.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends OrganizationUpdateManyAndReturnArgs>(
      args: SelectSubset<T, OrganizationUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$OrganizationPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one Organization.
     * @param {OrganizationUpsertArgs} args - Arguments to update or create a Organization.
     * @example
     * // Update or create a Organization
     * const organization = await prisma.organization.upsert({
     *   create: {
     *     // ... data to create a Organization
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Organization we want to update
     *   }
     * })
     */
    upsert<T extends OrganizationUpsertArgs>(
      args: SelectSubset<T, OrganizationUpsertArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      $Result.GetResult<
        Prisma.$OrganizationPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of Organizations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationCountArgs} args - Arguments to filter Organizations to count.
     * @example
     * // Count the number of Organizations
     * const count = await prisma.organization.count({
     *   where: {
     *     // ... the filter for the Organizations we want to count
     *   }
     * })
     **/
    count<T extends OrganizationCountArgs>(
      args?: Subset<T, OrganizationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], OrganizationCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a Organization.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends OrganizationAggregateArgs>(
      args: Subset<T, OrganizationAggregateArgs>,
    ): Prisma.PrismaPromise<GetOrganizationAggregateType<T>>;

    /**
     * Group by Organization.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends OrganizationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OrganizationGroupByArgs["orderBy"] }
        : { orderBy?: OrganizationGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, OrganizationGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetOrganizationGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the Organization model
     */
    readonly fields: OrganizationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Organization.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__OrganizationClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    members<T extends Organization$membersArgs<ExtArgs> = {}>(
      args?: Subset<T, Organization$membersArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$OrganizationMemberPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    auditLogs<T extends Organization$auditLogsArgs<ExtArgs> = {}>(
      args?: Subset<T, Organization$auditLogsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$AuditLogPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    featureFlags<T extends Organization$featureFlagsArgs<ExtArgs> = {}>(
      args?: Subset<T, Organization$featureFlagsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$FeatureFlagPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    applications<T extends Organization$applicationsArgs<ExtArgs> = {}>(
      args?: Subset<T, Organization$applicationsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$VolunteerApplicationPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    screenerQuestions<
      T extends Organization$screenerQuestionsArgs<ExtArgs> = {},
    >(
      args?: Subset<T, Organization$screenerQuestionsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$ScreenerQuestionPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    sessions<T extends Organization$sessionsArgs<ExtArgs> = {}>(
      args?: Subset<T, Organization$sessionsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$SessionPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the Organization model
   */
  interface OrganizationFieldRefs {
    readonly id: FieldRef<"Organization", "String">;
    readonly name: FieldRef<"Organization", "String">;
    readonly createdAt: FieldRef<"Organization", "DateTime">;
    readonly updatedAt: FieldRef<"Organization", "DateTime">;
  }

  // Custom InputTypes
  /**
   * Organization findUnique
   */
  export type OrganizationFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null;
    /**
     * Filter, which Organization to fetch.
     */
    where: OrganizationWhereUniqueInput;
  };

  /**
   * Organization findUniqueOrThrow
   */
  export type OrganizationFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null;
    /**
     * Filter, which Organization to fetch.
     */
    where: OrganizationWhereUniqueInput;
  };

  /**
   * Organization findFirst
   */
  export type OrganizationFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null;
    /**
     * Filter, which Organization to fetch.
     */
    where?: OrganizationWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Organizations to fetch.
     */
    orderBy?:
      | OrganizationOrderByWithRelationInput
      | OrganizationOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Organizations.
     */
    cursor?: OrganizationWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Organizations from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Organizations.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Organizations.
     */
    distinct?: OrganizationScalarFieldEnum | OrganizationScalarFieldEnum[];
  };

  /**
   * Organization findFirstOrThrow
   */
  export type OrganizationFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null;
    /**
     * Filter, which Organization to fetch.
     */
    where?: OrganizationWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Organizations to fetch.
     */
    orderBy?:
      | OrganizationOrderByWithRelationInput
      | OrganizationOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Organizations.
     */
    cursor?: OrganizationWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Organizations from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Organizations.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Organizations.
     */
    distinct?: OrganizationScalarFieldEnum | OrganizationScalarFieldEnum[];
  };

  /**
   * Organization findMany
   */
  export type OrganizationFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null;
    /**
     * Filter, which Organizations to fetch.
     */
    where?: OrganizationWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Organizations to fetch.
     */
    orderBy?:
      | OrganizationOrderByWithRelationInput
      | OrganizationOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Organizations.
     */
    cursor?: OrganizationWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Organizations from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Organizations.
     */
    skip?: number;
    distinct?: OrganizationScalarFieldEnum | OrganizationScalarFieldEnum[];
  };

  /**
   * Organization create
   */
  export type OrganizationCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null;
    /**
     * The data needed to create a Organization.
     */
    data: XOR<OrganizationCreateInput, OrganizationUncheckedCreateInput>;
  };

  /**
   * Organization createMany
   */
  export type OrganizationCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many Organizations.
     */
    data: OrganizationCreateManyInput | OrganizationCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * Organization createManyAndReturn
   */
  export type OrganizationCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * The data used to create many Organizations.
     */
    data: OrganizationCreateManyInput | OrganizationCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * Organization update
   */
  export type OrganizationUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null;
    /**
     * The data needed to update a Organization.
     */
    data: XOR<OrganizationUpdateInput, OrganizationUncheckedUpdateInput>;
    /**
     * Choose, which Organization to update.
     */
    where: OrganizationWhereUniqueInput;
  };

  /**
   * Organization updateMany
   */
  export type OrganizationUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update Organizations.
     */
    data: XOR<
      OrganizationUpdateManyMutationInput,
      OrganizationUncheckedUpdateManyInput
    >;
    /**
     * Filter which Organizations to update
     */
    where?: OrganizationWhereInput;
    /**
     * Limit how many Organizations to update.
     */
    limit?: number;
  };

  /**
   * Organization updateManyAndReturn
   */
  export type OrganizationUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * The data used to update Organizations.
     */
    data: XOR<
      OrganizationUpdateManyMutationInput,
      OrganizationUncheckedUpdateManyInput
    >;
    /**
     * Filter which Organizations to update
     */
    where?: OrganizationWhereInput;
    /**
     * Limit how many Organizations to update.
     */
    limit?: number;
  };

  /**
   * Organization upsert
   */
  export type OrganizationUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null;
    /**
     * The filter to search for the Organization to update in case it exists.
     */
    where: OrganizationWhereUniqueInput;
    /**
     * In case the Organization found by the `where` argument doesn't exist, create a new Organization with this data.
     */
    create: XOR<OrganizationCreateInput, OrganizationUncheckedCreateInput>;
    /**
     * In case the Organization was found with the provided `where` argument, update it with this data.
     */
    update: XOR<OrganizationUpdateInput, OrganizationUncheckedUpdateInput>;
  };

  /**
   * Organization delete
   */
  export type OrganizationDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null;
    /**
     * Filter which Organization to delete.
     */
    where: OrganizationWhereUniqueInput;
  };

  /**
   * Organization deleteMany
   */
  export type OrganizationDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Organizations to delete
     */
    where?: OrganizationWhereInput;
    /**
     * Limit how many Organizations to delete.
     */
    limit?: number;
  };

  /**
   * Organization.members
   */
  export type Organization$membersArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberInclude<ExtArgs> | null;
    where?: OrganizationMemberWhereInput;
    orderBy?:
      | OrganizationMemberOrderByWithRelationInput
      | OrganizationMemberOrderByWithRelationInput[];
    cursor?: OrganizationMemberWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?:
      | OrganizationMemberScalarFieldEnum
      | OrganizationMemberScalarFieldEnum[];
  };

  /**
   * Organization.auditLogs
   */
  export type Organization$auditLogsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null;
    where?: AuditLogWhereInput;
    orderBy?:
      | AuditLogOrderByWithRelationInput
      | AuditLogOrderByWithRelationInput[];
    cursor?: AuditLogWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: AuditLogScalarFieldEnum | AuditLogScalarFieldEnum[];
  };

  /**
   * Organization.featureFlags
   */
  export type Organization$featureFlagsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagInclude<ExtArgs> | null;
    where?: FeatureFlagWhereInput;
    orderBy?:
      | FeatureFlagOrderByWithRelationInput
      | FeatureFlagOrderByWithRelationInput[];
    cursor?: FeatureFlagWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: FeatureFlagScalarFieldEnum | FeatureFlagScalarFieldEnum[];
  };

  /**
   * Organization.applications
   */
  export type Organization$applicationsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationInclude<ExtArgs> | null;
    where?: VolunteerApplicationWhereInput;
    orderBy?:
      | VolunteerApplicationOrderByWithRelationInput
      | VolunteerApplicationOrderByWithRelationInput[];
    cursor?: VolunteerApplicationWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?:
      | VolunteerApplicationScalarFieldEnum
      | VolunteerApplicationScalarFieldEnum[];
  };

  /**
   * Organization.screenerQuestions
   */
  export type Organization$screenerQuestionsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionInclude<ExtArgs> | null;
    where?: ScreenerQuestionWhereInput;
    orderBy?:
      | ScreenerQuestionOrderByWithRelationInput
      | ScreenerQuestionOrderByWithRelationInput[];
    cursor?: ScreenerQuestionWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?:
      | ScreenerQuestionScalarFieldEnum
      | ScreenerQuestionScalarFieldEnum[];
  };

  /**
   * Organization.sessions
   */
  export type Organization$sessionsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null;
    where?: SessionWhereInput;
    orderBy?:
      | SessionOrderByWithRelationInput
      | SessionOrderByWithRelationInput[];
    cursor?: SessionWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[];
  };

  /**
   * Organization without action
   */
  export type OrganizationDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null;
  };

  /**
   * Model OrganizationMember
   */

  export type AggregateOrganizationMember = {
    _count: OrganizationMemberCountAggregateOutputType | null;
    _min: OrganizationMemberMinAggregateOutputType | null;
    _max: OrganizationMemberMaxAggregateOutputType | null;
  };

  export type OrganizationMemberMinAggregateOutputType = {
    id: string | null;
    organizationId: string | null;
    userId: string | null;
    role: $Enums.Role | null;
    createdAt: Date | null;
  };

  export type OrganizationMemberMaxAggregateOutputType = {
    id: string | null;
    organizationId: string | null;
    userId: string | null;
    role: $Enums.Role | null;
    createdAt: Date | null;
  };

  export type OrganizationMemberCountAggregateOutputType = {
    id: number;
    organizationId: number;
    userId: number;
    role: number;
    createdAt: number;
    _all: number;
  };

  export type OrganizationMemberMinAggregateInputType = {
    id?: true;
    organizationId?: true;
    userId?: true;
    role?: true;
    createdAt?: true;
  };

  export type OrganizationMemberMaxAggregateInputType = {
    id?: true;
    organizationId?: true;
    userId?: true;
    role?: true;
    createdAt?: true;
  };

  export type OrganizationMemberCountAggregateInputType = {
    id?: true;
    organizationId?: true;
    userId?: true;
    role?: true;
    createdAt?: true;
    _all?: true;
  };

  export type OrganizationMemberAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which OrganizationMember to aggregate.
     */
    where?: OrganizationMemberWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of OrganizationMembers to fetch.
     */
    orderBy?:
      | OrganizationMemberOrderByWithRelationInput
      | OrganizationMemberOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: OrganizationMemberWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` OrganizationMembers from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` OrganizationMembers.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned OrganizationMembers
     **/
    _count?: true | OrganizationMemberCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: OrganizationMemberMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: OrganizationMemberMaxAggregateInputType;
  };

  export type GetOrganizationMemberAggregateType<
    T extends OrganizationMemberAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateOrganizationMember]: P extends
      | "_count"
      | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOrganizationMember[P]>
      : GetScalarType<T[P], AggregateOrganizationMember[P]>;
  };

  export type OrganizationMemberGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: OrganizationMemberWhereInput;
    orderBy?:
      | OrganizationMemberOrderByWithAggregationInput
      | OrganizationMemberOrderByWithAggregationInput[];
    by: OrganizationMemberScalarFieldEnum[] | OrganizationMemberScalarFieldEnum;
    having?: OrganizationMemberScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: OrganizationMemberCountAggregateInputType | true;
    _min?: OrganizationMemberMinAggregateInputType;
    _max?: OrganizationMemberMaxAggregateInputType;
  };

  export type OrganizationMemberGroupByOutputType = {
    id: string;
    organizationId: string;
    userId: string;
    role: $Enums.Role;
    createdAt: Date;
    _count: OrganizationMemberCountAggregateOutputType | null;
    _min: OrganizationMemberMinAggregateOutputType | null;
    _max: OrganizationMemberMaxAggregateOutputType | null;
  };

  type GetOrganizationMemberGroupByPayload<
    T extends OrganizationMemberGroupByArgs,
  > = Prisma.PrismaPromise<
    Array<
      PickEnumerable<OrganizationMemberGroupByOutputType, T["by"]> & {
        [P in keyof T &
          keyof OrganizationMemberGroupByOutputType]: P extends "_count"
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], OrganizationMemberGroupByOutputType[P]>
          : GetScalarType<T[P], OrganizationMemberGroupByOutputType[P]>;
      }
    >
  >;

  export type OrganizationMemberSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      organizationId?: boolean;
      userId?: boolean;
      role?: boolean;
      createdAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
      user?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["organizationMember"]
  >;

  export type OrganizationMemberSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      organizationId?: boolean;
      userId?: boolean;
      role?: boolean;
      createdAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
      user?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["organizationMember"]
  >;

  export type OrganizationMemberSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      organizationId?: boolean;
      userId?: boolean;
      role?: boolean;
      createdAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
      user?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["organizationMember"]
  >;

  export type OrganizationMemberSelectScalar = {
    id?: boolean;
    organizationId?: boolean;
    userId?: boolean;
    role?: boolean;
    createdAt?: boolean;
  };

  export type OrganizationMemberOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    "id" | "organizationId" | "userId" | "role" | "createdAt",
    ExtArgs["result"]["organizationMember"]
  >;
  export type OrganizationMemberInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    user?: boolean | UserDefaultArgs<ExtArgs>;
  };
  export type OrganizationMemberIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    user?: boolean | UserDefaultArgs<ExtArgs>;
  };
  export type OrganizationMemberIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    user?: boolean | UserDefaultArgs<ExtArgs>;
  };

  export type $OrganizationMemberPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "OrganizationMember";
    objects: {
      organization: Prisma.$OrganizationPayload<ExtArgs>;
      user: Prisma.$UserPayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        organizationId: string;
        userId: string;
        role: $Enums.Role;
        createdAt: Date;
      },
      ExtArgs["result"]["organizationMember"]
    >;
    composites: {};
  };

  type OrganizationMemberGetPayload<
    S extends boolean | null | undefined | OrganizationMemberDefaultArgs,
  > = $Result.GetResult<Prisma.$OrganizationMemberPayload, S>;

  type OrganizationMemberCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    OrganizationMemberFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: OrganizationMemberCountAggregateInputType | true;
  };

  export interface OrganizationMemberDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["OrganizationMember"];
      meta: { name: "OrganizationMember" };
    };
    /**
     * Find zero or one OrganizationMember that matches the filter.
     * @param {OrganizationMemberFindUniqueArgs} args - Arguments to find a OrganizationMember
     * @example
     * // Get one OrganizationMember
     * const organizationMember = await prisma.organizationMember.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends OrganizationMemberFindUniqueArgs>(
      args: SelectSubset<T, OrganizationMemberFindUniqueArgs<ExtArgs>>,
    ): Prisma__OrganizationMemberClient<
      $Result.GetResult<
        Prisma.$OrganizationMemberPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one OrganizationMember that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {OrganizationMemberFindUniqueOrThrowArgs} args - Arguments to find a OrganizationMember
     * @example
     * // Get one OrganizationMember
     * const organizationMember = await prisma.organizationMember.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends OrganizationMemberFindUniqueOrThrowArgs>(
      args: SelectSubset<T, OrganizationMemberFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__OrganizationMemberClient<
      $Result.GetResult<
        Prisma.$OrganizationMemberPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first OrganizationMember that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationMemberFindFirstArgs} args - Arguments to find a OrganizationMember
     * @example
     * // Get one OrganizationMember
     * const organizationMember = await prisma.organizationMember.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends OrganizationMemberFindFirstArgs>(
      args?: SelectSubset<T, OrganizationMemberFindFirstArgs<ExtArgs>>,
    ): Prisma__OrganizationMemberClient<
      $Result.GetResult<
        Prisma.$OrganizationMemberPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first OrganizationMember that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationMemberFindFirstOrThrowArgs} args - Arguments to find a OrganizationMember
     * @example
     * // Get one OrganizationMember
     * const organizationMember = await prisma.organizationMember.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends OrganizationMemberFindFirstOrThrowArgs>(
      args?: SelectSubset<T, OrganizationMemberFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__OrganizationMemberClient<
      $Result.GetResult<
        Prisma.$OrganizationMemberPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more OrganizationMembers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationMemberFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all OrganizationMembers
     * const organizationMembers = await prisma.organizationMember.findMany()
     *
     * // Get first 10 OrganizationMembers
     * const organizationMembers = await prisma.organizationMember.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const organizationMemberWithIdOnly = await prisma.organizationMember.findMany({ select: { id: true } })
     *
     */
    findMany<T extends OrganizationMemberFindManyArgs>(
      args?: SelectSubset<T, OrganizationMemberFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$OrganizationMemberPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a OrganizationMember.
     * @param {OrganizationMemberCreateArgs} args - Arguments to create a OrganizationMember.
     * @example
     * // Create one OrganizationMember
     * const OrganizationMember = await prisma.organizationMember.create({
     *   data: {
     *     // ... data to create a OrganizationMember
     *   }
     * })
     *
     */
    create<T extends OrganizationMemberCreateArgs>(
      args: SelectSubset<T, OrganizationMemberCreateArgs<ExtArgs>>,
    ): Prisma__OrganizationMemberClient<
      $Result.GetResult<
        Prisma.$OrganizationMemberPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many OrganizationMembers.
     * @param {OrganizationMemberCreateManyArgs} args - Arguments to create many OrganizationMembers.
     * @example
     * // Create many OrganizationMembers
     * const organizationMember = await prisma.organizationMember.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends OrganizationMemberCreateManyArgs>(
      args?: SelectSubset<T, OrganizationMemberCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many OrganizationMembers and returns the data saved in the database.
     * @param {OrganizationMemberCreateManyAndReturnArgs} args - Arguments to create many OrganizationMembers.
     * @example
     * // Create many OrganizationMembers
     * const organizationMember = await prisma.organizationMember.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many OrganizationMembers and only return the `id`
     * const organizationMemberWithIdOnly = await prisma.organizationMember.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends OrganizationMemberCreateManyAndReturnArgs>(
      args?: SelectSubset<
        T,
        OrganizationMemberCreateManyAndReturnArgs<ExtArgs>
      >,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$OrganizationMemberPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a OrganizationMember.
     * @param {OrganizationMemberDeleteArgs} args - Arguments to delete one OrganizationMember.
     * @example
     * // Delete one OrganizationMember
     * const OrganizationMember = await prisma.organizationMember.delete({
     *   where: {
     *     // ... filter to delete one OrganizationMember
     *   }
     * })
     *
     */
    delete<T extends OrganizationMemberDeleteArgs>(
      args: SelectSubset<T, OrganizationMemberDeleteArgs<ExtArgs>>,
    ): Prisma__OrganizationMemberClient<
      $Result.GetResult<
        Prisma.$OrganizationMemberPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one OrganizationMember.
     * @param {OrganizationMemberUpdateArgs} args - Arguments to update one OrganizationMember.
     * @example
     * // Update one OrganizationMember
     * const organizationMember = await prisma.organizationMember.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends OrganizationMemberUpdateArgs>(
      args: SelectSubset<T, OrganizationMemberUpdateArgs<ExtArgs>>,
    ): Prisma__OrganizationMemberClient<
      $Result.GetResult<
        Prisma.$OrganizationMemberPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more OrganizationMembers.
     * @param {OrganizationMemberDeleteManyArgs} args - Arguments to filter OrganizationMembers to delete.
     * @example
     * // Delete a few OrganizationMembers
     * const { count } = await prisma.organizationMember.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends OrganizationMemberDeleteManyArgs>(
      args?: SelectSubset<T, OrganizationMemberDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more OrganizationMembers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationMemberUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many OrganizationMembers
     * const organizationMember = await prisma.organizationMember.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends OrganizationMemberUpdateManyArgs>(
      args: SelectSubset<T, OrganizationMemberUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more OrganizationMembers and returns the data updated in the database.
     * @param {OrganizationMemberUpdateManyAndReturnArgs} args - Arguments to update many OrganizationMembers.
     * @example
     * // Update many OrganizationMembers
     * const organizationMember = await prisma.organizationMember.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more OrganizationMembers and only return the `id`
     * const organizationMemberWithIdOnly = await prisma.organizationMember.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends OrganizationMemberUpdateManyAndReturnArgs>(
      args: SelectSubset<T, OrganizationMemberUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$OrganizationMemberPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one OrganizationMember.
     * @param {OrganizationMemberUpsertArgs} args - Arguments to update or create a OrganizationMember.
     * @example
     * // Update or create a OrganizationMember
     * const organizationMember = await prisma.organizationMember.upsert({
     *   create: {
     *     // ... data to create a OrganizationMember
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the OrganizationMember we want to update
     *   }
     * })
     */
    upsert<T extends OrganizationMemberUpsertArgs>(
      args: SelectSubset<T, OrganizationMemberUpsertArgs<ExtArgs>>,
    ): Prisma__OrganizationMemberClient<
      $Result.GetResult<
        Prisma.$OrganizationMemberPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of OrganizationMembers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationMemberCountArgs} args - Arguments to filter OrganizationMembers to count.
     * @example
     * // Count the number of OrganizationMembers
     * const count = await prisma.organizationMember.count({
     *   where: {
     *     // ... the filter for the OrganizationMembers we want to count
     *   }
     * })
     **/
    count<T extends OrganizationMemberCountArgs>(
      args?: Subset<T, OrganizationMemberCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<
              T["select"],
              OrganizationMemberCountAggregateOutputType
            >
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a OrganizationMember.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationMemberAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends OrganizationMemberAggregateArgs>(
      args: Subset<T, OrganizationMemberAggregateArgs>,
    ): Prisma.PrismaPromise<GetOrganizationMemberAggregateType<T>>;

    /**
     * Group by OrganizationMember.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationMemberGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends OrganizationMemberGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OrganizationMemberGroupByArgs["orderBy"] }
        : { orderBy?: OrganizationMemberGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, OrganizationMemberGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetOrganizationMemberGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the OrganizationMember model
     */
    readonly fields: OrganizationMemberFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for OrganizationMember.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__OrganizationMemberClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organization<T extends OrganizationDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, OrganizationDefaultArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      | $Result.GetResult<
          Prisma.$OrganizationPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    user<T extends UserDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, UserDefaultArgs<ExtArgs>>,
    ): Prisma__UserClient<
      | $Result.GetResult<
          Prisma.$UserPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the OrganizationMember model
   */
  interface OrganizationMemberFieldRefs {
    readonly id: FieldRef<"OrganizationMember", "String">;
    readonly organizationId: FieldRef<"OrganizationMember", "String">;
    readonly userId: FieldRef<"OrganizationMember", "String">;
    readonly role: FieldRef<"OrganizationMember", "Role">;
    readonly createdAt: FieldRef<"OrganizationMember", "DateTime">;
  }

  // Custom InputTypes
  /**
   * OrganizationMember findUnique
   */
  export type OrganizationMemberFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberInclude<ExtArgs> | null;
    /**
     * Filter, which OrganizationMember to fetch.
     */
    where: OrganizationMemberWhereUniqueInput;
  };

  /**
   * OrganizationMember findUniqueOrThrow
   */
  export type OrganizationMemberFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberInclude<ExtArgs> | null;
    /**
     * Filter, which OrganizationMember to fetch.
     */
    where: OrganizationMemberWhereUniqueInput;
  };

  /**
   * OrganizationMember findFirst
   */
  export type OrganizationMemberFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberInclude<ExtArgs> | null;
    /**
     * Filter, which OrganizationMember to fetch.
     */
    where?: OrganizationMemberWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of OrganizationMembers to fetch.
     */
    orderBy?:
      | OrganizationMemberOrderByWithRelationInput
      | OrganizationMemberOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for OrganizationMembers.
     */
    cursor?: OrganizationMemberWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` OrganizationMembers from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` OrganizationMembers.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of OrganizationMembers.
     */
    distinct?:
      | OrganizationMemberScalarFieldEnum
      | OrganizationMemberScalarFieldEnum[];
  };

  /**
   * OrganizationMember findFirstOrThrow
   */
  export type OrganizationMemberFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberInclude<ExtArgs> | null;
    /**
     * Filter, which OrganizationMember to fetch.
     */
    where?: OrganizationMemberWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of OrganizationMembers to fetch.
     */
    orderBy?:
      | OrganizationMemberOrderByWithRelationInput
      | OrganizationMemberOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for OrganizationMembers.
     */
    cursor?: OrganizationMemberWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` OrganizationMembers from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` OrganizationMembers.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of OrganizationMembers.
     */
    distinct?:
      | OrganizationMemberScalarFieldEnum
      | OrganizationMemberScalarFieldEnum[];
  };

  /**
   * OrganizationMember findMany
   */
  export type OrganizationMemberFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberInclude<ExtArgs> | null;
    /**
     * Filter, which OrganizationMembers to fetch.
     */
    where?: OrganizationMemberWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of OrganizationMembers to fetch.
     */
    orderBy?:
      | OrganizationMemberOrderByWithRelationInput
      | OrganizationMemberOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing OrganizationMembers.
     */
    cursor?: OrganizationMemberWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` OrganizationMembers from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` OrganizationMembers.
     */
    skip?: number;
    distinct?:
      | OrganizationMemberScalarFieldEnum
      | OrganizationMemberScalarFieldEnum[];
  };

  /**
   * OrganizationMember create
   */
  export type OrganizationMemberCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberInclude<ExtArgs> | null;
    /**
     * The data needed to create a OrganizationMember.
     */
    data: XOR<
      OrganizationMemberCreateInput,
      OrganizationMemberUncheckedCreateInput
    >;
  };

  /**
   * OrganizationMember createMany
   */
  export type OrganizationMemberCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many OrganizationMembers.
     */
    data:
      | OrganizationMemberCreateManyInput
      | OrganizationMemberCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * OrganizationMember createManyAndReturn
   */
  export type OrganizationMemberCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * The data used to create many OrganizationMembers.
     */
    data:
      | OrganizationMemberCreateManyInput
      | OrganizationMemberCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * OrganizationMember update
   */
  export type OrganizationMemberUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberInclude<ExtArgs> | null;
    /**
     * The data needed to update a OrganizationMember.
     */
    data: XOR<
      OrganizationMemberUpdateInput,
      OrganizationMemberUncheckedUpdateInput
    >;
    /**
     * Choose, which OrganizationMember to update.
     */
    where: OrganizationMemberWhereUniqueInput;
  };

  /**
   * OrganizationMember updateMany
   */
  export type OrganizationMemberUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update OrganizationMembers.
     */
    data: XOR<
      OrganizationMemberUpdateManyMutationInput,
      OrganizationMemberUncheckedUpdateManyInput
    >;
    /**
     * Filter which OrganizationMembers to update
     */
    where?: OrganizationMemberWhereInput;
    /**
     * Limit how many OrganizationMembers to update.
     */
    limit?: number;
  };

  /**
   * OrganizationMember updateManyAndReturn
   */
  export type OrganizationMemberUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * The data used to update OrganizationMembers.
     */
    data: XOR<
      OrganizationMemberUpdateManyMutationInput,
      OrganizationMemberUncheckedUpdateManyInput
    >;
    /**
     * Filter which OrganizationMembers to update
     */
    where?: OrganizationMemberWhereInput;
    /**
     * Limit how many OrganizationMembers to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * OrganizationMember upsert
   */
  export type OrganizationMemberUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberInclude<ExtArgs> | null;
    /**
     * The filter to search for the OrganizationMember to update in case it exists.
     */
    where: OrganizationMemberWhereUniqueInput;
    /**
     * In case the OrganizationMember found by the `where` argument doesn't exist, create a new OrganizationMember with this data.
     */
    create: XOR<
      OrganizationMemberCreateInput,
      OrganizationMemberUncheckedCreateInput
    >;
    /**
     * In case the OrganizationMember was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      OrganizationMemberUpdateInput,
      OrganizationMemberUncheckedUpdateInput
    >;
  };

  /**
   * OrganizationMember delete
   */
  export type OrganizationMemberDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberInclude<ExtArgs> | null;
    /**
     * Filter which OrganizationMember to delete.
     */
    where: OrganizationMemberWhereUniqueInput;
  };

  /**
   * OrganizationMember deleteMany
   */
  export type OrganizationMemberDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which OrganizationMembers to delete
     */
    where?: OrganizationMemberWhereInput;
    /**
     * Limit how many OrganizationMembers to delete.
     */
    limit?: number;
  };

  /**
   * OrganizationMember without action
   */
  export type OrganizationMemberDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OrganizationMember
     */
    select?: OrganizationMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the OrganizationMember
     */
    omit?: OrganizationMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationMemberInclude<ExtArgs> | null;
  };

  /**
   * Model AuditLog
   */

  export type AggregateAuditLog = {
    _count: AuditLogCountAggregateOutputType | null;
    _min: AuditLogMinAggregateOutputType | null;
    _max: AuditLogMaxAggregateOutputType | null;
  };

  export type AuditLogMinAggregateOutputType = {
    id: string | null;
    actorId: string | null;
    orgId: string | null;
    action: string | null;
    entityType: string | null;
    entityId: string | null;
    createdAt: Date | null;
  };

  export type AuditLogMaxAggregateOutputType = {
    id: string | null;
    actorId: string | null;
    orgId: string | null;
    action: string | null;
    entityType: string | null;
    entityId: string | null;
    createdAt: Date | null;
  };

  export type AuditLogCountAggregateOutputType = {
    id: number;
    actorId: number;
    orgId: number;
    action: number;
    entityType: number;
    entityId: number;
    metadata: number;
    createdAt: number;
    _all: number;
  };

  export type AuditLogMinAggregateInputType = {
    id?: true;
    actorId?: true;
    orgId?: true;
    action?: true;
    entityType?: true;
    entityId?: true;
    createdAt?: true;
  };

  export type AuditLogMaxAggregateInputType = {
    id?: true;
    actorId?: true;
    orgId?: true;
    action?: true;
    entityType?: true;
    entityId?: true;
    createdAt?: true;
  };

  export type AuditLogCountAggregateInputType = {
    id?: true;
    actorId?: true;
    orgId?: true;
    action?: true;
    entityType?: true;
    entityId?: true;
    metadata?: true;
    createdAt?: true;
    _all?: true;
  };

  export type AuditLogAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which AuditLog to aggregate.
     */
    where?: AuditLogWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of AuditLogs to fetch.
     */
    orderBy?:
      | AuditLogOrderByWithRelationInput
      | AuditLogOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: AuditLogWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` AuditLogs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` AuditLogs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned AuditLogs
     **/
    _count?: true | AuditLogCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: AuditLogMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: AuditLogMaxAggregateInputType;
  };

  export type GetAuditLogAggregateType<T extends AuditLogAggregateArgs> = {
    [P in keyof T & keyof AggregateAuditLog]: P extends "_count" | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAuditLog[P]>
      : GetScalarType<T[P], AggregateAuditLog[P]>;
  };

  export type AuditLogGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: AuditLogWhereInput;
    orderBy?:
      | AuditLogOrderByWithAggregationInput
      | AuditLogOrderByWithAggregationInput[];
    by: AuditLogScalarFieldEnum[] | AuditLogScalarFieldEnum;
    having?: AuditLogScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: AuditLogCountAggregateInputType | true;
    _min?: AuditLogMinAggregateInputType;
    _max?: AuditLogMaxAggregateInputType;
  };

  export type AuditLogGroupByOutputType = {
    id: string;
    actorId: string | null;
    orgId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: JsonValue | null;
    createdAt: Date;
    _count: AuditLogCountAggregateOutputType | null;
    _min: AuditLogMinAggregateOutputType | null;
    _max: AuditLogMaxAggregateOutputType | null;
  };

  type GetAuditLogGroupByPayload<T extends AuditLogGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<AuditLogGroupByOutputType, T["by"]> & {
          [P in keyof T & keyof AuditLogGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AuditLogGroupByOutputType[P]>
            : GetScalarType<T[P], AuditLogGroupByOutputType[P]>;
        }
      >
    >;

  export type AuditLogSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      actorId?: boolean;
      orgId?: boolean;
      action?: boolean;
      entityType?: boolean;
      entityId?: boolean;
      metadata?: boolean;
      createdAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
      actor?: boolean | AuditLog$actorArgs<ExtArgs>;
    },
    ExtArgs["result"]["auditLog"]
  >;

  export type AuditLogSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      actorId?: boolean;
      orgId?: boolean;
      action?: boolean;
      entityType?: boolean;
      entityId?: boolean;
      metadata?: boolean;
      createdAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
      actor?: boolean | AuditLog$actorArgs<ExtArgs>;
    },
    ExtArgs["result"]["auditLog"]
  >;

  export type AuditLogSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      actorId?: boolean;
      orgId?: boolean;
      action?: boolean;
      entityType?: boolean;
      entityId?: boolean;
      metadata?: boolean;
      createdAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
      actor?: boolean | AuditLog$actorArgs<ExtArgs>;
    },
    ExtArgs["result"]["auditLog"]
  >;

  export type AuditLogSelectScalar = {
    id?: boolean;
    actorId?: boolean;
    orgId?: boolean;
    action?: boolean;
    entityType?: boolean;
    entityId?: boolean;
    metadata?: boolean;
    createdAt?: boolean;
  };

  export type AuditLogOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "actorId"
    | "orgId"
    | "action"
    | "entityType"
    | "entityId"
    | "metadata"
    | "createdAt",
    ExtArgs["result"]["auditLog"]
  >;
  export type AuditLogInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    actor?: boolean | AuditLog$actorArgs<ExtArgs>;
  };
  export type AuditLogIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    actor?: boolean | AuditLog$actorArgs<ExtArgs>;
  };
  export type AuditLogIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    actor?: boolean | AuditLog$actorArgs<ExtArgs>;
  };

  export type $AuditLogPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "AuditLog";
    objects: {
      organization: Prisma.$OrganizationPayload<ExtArgs>;
      actor: Prisma.$UserPayload<ExtArgs> | null;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        actorId: string | null;
        orgId: string;
        action: string;
        entityType: string;
        entityId: string | null;
        metadata: Prisma.JsonValue | null;
        createdAt: Date;
      },
      ExtArgs["result"]["auditLog"]
    >;
    composites: {};
  };

  type AuditLogGetPayload<
    S extends boolean | null | undefined | AuditLogDefaultArgs,
  > = $Result.GetResult<Prisma.$AuditLogPayload, S>;

  type AuditLogCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<AuditLogFindManyArgs, "select" | "include" | "distinct" | "omit"> & {
    select?: AuditLogCountAggregateInputType | true;
  };

  export interface AuditLogDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["AuditLog"];
      meta: { name: "AuditLog" };
    };
    /**
     * Find zero or one AuditLog that matches the filter.
     * @param {AuditLogFindUniqueArgs} args - Arguments to find a AuditLog
     * @example
     * // Get one AuditLog
     * const auditLog = await prisma.auditLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AuditLogFindUniqueArgs>(
      args: SelectSubset<T, AuditLogFindUniqueArgs<ExtArgs>>,
    ): Prisma__AuditLogClient<
      $Result.GetResult<
        Prisma.$AuditLogPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one AuditLog that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AuditLogFindUniqueOrThrowArgs} args - Arguments to find a AuditLog
     * @example
     * // Get one AuditLog
     * const auditLog = await prisma.auditLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AuditLogFindUniqueOrThrowArgs>(
      args: SelectSubset<T, AuditLogFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__AuditLogClient<
      $Result.GetResult<
        Prisma.$AuditLogPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first AuditLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogFindFirstArgs} args - Arguments to find a AuditLog
     * @example
     * // Get one AuditLog
     * const auditLog = await prisma.auditLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AuditLogFindFirstArgs>(
      args?: SelectSubset<T, AuditLogFindFirstArgs<ExtArgs>>,
    ): Prisma__AuditLogClient<
      $Result.GetResult<
        Prisma.$AuditLogPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first AuditLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogFindFirstOrThrowArgs} args - Arguments to find a AuditLog
     * @example
     * // Get one AuditLog
     * const auditLog = await prisma.auditLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AuditLogFindFirstOrThrowArgs>(
      args?: SelectSubset<T, AuditLogFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__AuditLogClient<
      $Result.GetResult<
        Prisma.$AuditLogPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more AuditLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AuditLogs
     * const auditLogs = await prisma.auditLog.findMany()
     *
     * // Get first 10 AuditLogs
     * const auditLogs = await prisma.auditLog.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const auditLogWithIdOnly = await prisma.auditLog.findMany({ select: { id: true } })
     *
     */
    findMany<T extends AuditLogFindManyArgs>(
      args?: SelectSubset<T, AuditLogFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$AuditLogPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a AuditLog.
     * @param {AuditLogCreateArgs} args - Arguments to create a AuditLog.
     * @example
     * // Create one AuditLog
     * const AuditLog = await prisma.auditLog.create({
     *   data: {
     *     // ... data to create a AuditLog
     *   }
     * })
     *
     */
    create<T extends AuditLogCreateArgs>(
      args: SelectSubset<T, AuditLogCreateArgs<ExtArgs>>,
    ): Prisma__AuditLogClient<
      $Result.GetResult<
        Prisma.$AuditLogPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many AuditLogs.
     * @param {AuditLogCreateManyArgs} args - Arguments to create many AuditLogs.
     * @example
     * // Create many AuditLogs
     * const auditLog = await prisma.auditLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends AuditLogCreateManyArgs>(
      args?: SelectSubset<T, AuditLogCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many AuditLogs and returns the data saved in the database.
     * @param {AuditLogCreateManyAndReturnArgs} args - Arguments to create many AuditLogs.
     * @example
     * // Create many AuditLogs
     * const auditLog = await prisma.auditLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many AuditLogs and only return the `id`
     * const auditLogWithIdOnly = await prisma.auditLog.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends AuditLogCreateManyAndReturnArgs>(
      args?: SelectSubset<T, AuditLogCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$AuditLogPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a AuditLog.
     * @param {AuditLogDeleteArgs} args - Arguments to delete one AuditLog.
     * @example
     * // Delete one AuditLog
     * const AuditLog = await prisma.auditLog.delete({
     *   where: {
     *     // ... filter to delete one AuditLog
     *   }
     * })
     *
     */
    delete<T extends AuditLogDeleteArgs>(
      args: SelectSubset<T, AuditLogDeleteArgs<ExtArgs>>,
    ): Prisma__AuditLogClient<
      $Result.GetResult<
        Prisma.$AuditLogPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one AuditLog.
     * @param {AuditLogUpdateArgs} args - Arguments to update one AuditLog.
     * @example
     * // Update one AuditLog
     * const auditLog = await prisma.auditLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends AuditLogUpdateArgs>(
      args: SelectSubset<T, AuditLogUpdateArgs<ExtArgs>>,
    ): Prisma__AuditLogClient<
      $Result.GetResult<
        Prisma.$AuditLogPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more AuditLogs.
     * @param {AuditLogDeleteManyArgs} args - Arguments to filter AuditLogs to delete.
     * @example
     * // Delete a few AuditLogs
     * const { count } = await prisma.auditLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends AuditLogDeleteManyArgs>(
      args?: SelectSubset<T, AuditLogDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more AuditLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AuditLogs
     * const auditLog = await prisma.auditLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends AuditLogUpdateManyArgs>(
      args: SelectSubset<T, AuditLogUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more AuditLogs and returns the data updated in the database.
     * @param {AuditLogUpdateManyAndReturnArgs} args - Arguments to update many AuditLogs.
     * @example
     * // Update many AuditLogs
     * const auditLog = await prisma.auditLog.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more AuditLogs and only return the `id`
     * const auditLogWithIdOnly = await prisma.auditLog.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends AuditLogUpdateManyAndReturnArgs>(
      args: SelectSubset<T, AuditLogUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$AuditLogPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one AuditLog.
     * @param {AuditLogUpsertArgs} args - Arguments to update or create a AuditLog.
     * @example
     * // Update or create a AuditLog
     * const auditLog = await prisma.auditLog.upsert({
     *   create: {
     *     // ... data to create a AuditLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AuditLog we want to update
     *   }
     * })
     */
    upsert<T extends AuditLogUpsertArgs>(
      args: SelectSubset<T, AuditLogUpsertArgs<ExtArgs>>,
    ): Prisma__AuditLogClient<
      $Result.GetResult<
        Prisma.$AuditLogPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of AuditLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogCountArgs} args - Arguments to filter AuditLogs to count.
     * @example
     * // Count the number of AuditLogs
     * const count = await prisma.auditLog.count({
     *   where: {
     *     // ... the filter for the AuditLogs we want to count
     *   }
     * })
     **/
    count<T extends AuditLogCountArgs>(
      args?: Subset<T, AuditLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], AuditLogCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a AuditLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends AuditLogAggregateArgs>(
      args: Subset<T, AuditLogAggregateArgs>,
    ): Prisma.PrismaPromise<GetAuditLogAggregateType<T>>;

    /**
     * Group by AuditLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuditLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends AuditLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AuditLogGroupByArgs["orderBy"] }
        : { orderBy?: AuditLogGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, AuditLogGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetAuditLogGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the AuditLog model
     */
    readonly fields: AuditLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AuditLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AuditLogClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organization<T extends OrganizationDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, OrganizationDefaultArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      | $Result.GetResult<
          Prisma.$OrganizationPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    actor<T extends AuditLog$actorArgs<ExtArgs> = {}>(
      args?: Subset<T, AuditLog$actorArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<
        Prisma.$UserPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the AuditLog model
   */
  interface AuditLogFieldRefs {
    readonly id: FieldRef<"AuditLog", "String">;
    readonly actorId: FieldRef<"AuditLog", "String">;
    readonly orgId: FieldRef<"AuditLog", "String">;
    readonly action: FieldRef<"AuditLog", "String">;
    readonly entityType: FieldRef<"AuditLog", "String">;
    readonly entityId: FieldRef<"AuditLog", "String">;
    readonly metadata: FieldRef<"AuditLog", "Json">;
    readonly createdAt: FieldRef<"AuditLog", "DateTime">;
  }

  // Custom InputTypes
  /**
   * AuditLog findUnique
   */
  export type AuditLogFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null;
    /**
     * Filter, which AuditLog to fetch.
     */
    where: AuditLogWhereUniqueInput;
  };

  /**
   * AuditLog findUniqueOrThrow
   */
  export type AuditLogFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null;
    /**
     * Filter, which AuditLog to fetch.
     */
    where: AuditLogWhereUniqueInput;
  };

  /**
   * AuditLog findFirst
   */
  export type AuditLogFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null;
    /**
     * Filter, which AuditLog to fetch.
     */
    where?: AuditLogWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of AuditLogs to fetch.
     */
    orderBy?:
      | AuditLogOrderByWithRelationInput
      | AuditLogOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for AuditLogs.
     */
    cursor?: AuditLogWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` AuditLogs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` AuditLogs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of AuditLogs.
     */
    distinct?: AuditLogScalarFieldEnum | AuditLogScalarFieldEnum[];
  };

  /**
   * AuditLog findFirstOrThrow
   */
  export type AuditLogFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null;
    /**
     * Filter, which AuditLog to fetch.
     */
    where?: AuditLogWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of AuditLogs to fetch.
     */
    orderBy?:
      | AuditLogOrderByWithRelationInput
      | AuditLogOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for AuditLogs.
     */
    cursor?: AuditLogWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` AuditLogs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` AuditLogs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of AuditLogs.
     */
    distinct?: AuditLogScalarFieldEnum | AuditLogScalarFieldEnum[];
  };

  /**
   * AuditLog findMany
   */
  export type AuditLogFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null;
    /**
     * Filter, which AuditLogs to fetch.
     */
    where?: AuditLogWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of AuditLogs to fetch.
     */
    orderBy?:
      | AuditLogOrderByWithRelationInput
      | AuditLogOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing AuditLogs.
     */
    cursor?: AuditLogWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` AuditLogs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` AuditLogs.
     */
    skip?: number;
    distinct?: AuditLogScalarFieldEnum | AuditLogScalarFieldEnum[];
  };

  /**
   * AuditLog create
   */
  export type AuditLogCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null;
    /**
     * The data needed to create a AuditLog.
     */
    data: XOR<AuditLogCreateInput, AuditLogUncheckedCreateInput>;
  };

  /**
   * AuditLog createMany
   */
  export type AuditLogCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many AuditLogs.
     */
    data: AuditLogCreateManyInput | AuditLogCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * AuditLog createManyAndReturn
   */
  export type AuditLogCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * The data used to create many AuditLogs.
     */
    data: AuditLogCreateManyInput | AuditLogCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * AuditLog update
   */
  export type AuditLogUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null;
    /**
     * The data needed to update a AuditLog.
     */
    data: XOR<AuditLogUpdateInput, AuditLogUncheckedUpdateInput>;
    /**
     * Choose, which AuditLog to update.
     */
    where: AuditLogWhereUniqueInput;
  };

  /**
   * AuditLog updateMany
   */
  export type AuditLogUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update AuditLogs.
     */
    data: XOR<
      AuditLogUpdateManyMutationInput,
      AuditLogUncheckedUpdateManyInput
    >;
    /**
     * Filter which AuditLogs to update
     */
    where?: AuditLogWhereInput;
    /**
     * Limit how many AuditLogs to update.
     */
    limit?: number;
  };

  /**
   * AuditLog updateManyAndReturn
   */
  export type AuditLogUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * The data used to update AuditLogs.
     */
    data: XOR<
      AuditLogUpdateManyMutationInput,
      AuditLogUncheckedUpdateManyInput
    >;
    /**
     * Filter which AuditLogs to update
     */
    where?: AuditLogWhereInput;
    /**
     * Limit how many AuditLogs to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * AuditLog upsert
   */
  export type AuditLogUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null;
    /**
     * The filter to search for the AuditLog to update in case it exists.
     */
    where: AuditLogWhereUniqueInput;
    /**
     * In case the AuditLog found by the `where` argument doesn't exist, create a new AuditLog with this data.
     */
    create: XOR<AuditLogCreateInput, AuditLogUncheckedCreateInput>;
    /**
     * In case the AuditLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AuditLogUpdateInput, AuditLogUncheckedUpdateInput>;
  };

  /**
   * AuditLog delete
   */
  export type AuditLogDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null;
    /**
     * Filter which AuditLog to delete.
     */
    where: AuditLogWhereUniqueInput;
  };

  /**
   * AuditLog deleteMany
   */
  export type AuditLogDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which AuditLogs to delete
     */
    where?: AuditLogWhereInput;
    /**
     * Limit how many AuditLogs to delete.
     */
    limit?: number;
  };

  /**
   * AuditLog.actor
   */
  export type AuditLog$actorArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    where?: UserWhereInput;
  };

  /**
   * AuditLog without action
   */
  export type AuditLogDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the AuditLog
     */
    select?: AuditLogSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AuditLog
     */
    omit?: AuditLogOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuditLogInclude<ExtArgs> | null;
  };

  /**
   * Model FeatureFlag
   */

  export type AggregateFeatureFlag = {
    _count: FeatureFlagCountAggregateOutputType | null;
    _min: FeatureFlagMinAggregateOutputType | null;
    _max: FeatureFlagMaxAggregateOutputType | null;
  };

  export type FeatureFlagMinAggregateOutputType = {
    id: string | null;
    orgId: string | null;
    key: string | null;
    enabled: boolean | null;
    createdAt: Date | null;
  };

  export type FeatureFlagMaxAggregateOutputType = {
    id: string | null;
    orgId: string | null;
    key: string | null;
    enabled: boolean | null;
    createdAt: Date | null;
  };

  export type FeatureFlagCountAggregateOutputType = {
    id: number;
    orgId: number;
    key: number;
    enabled: number;
    createdAt: number;
    _all: number;
  };

  export type FeatureFlagMinAggregateInputType = {
    id?: true;
    orgId?: true;
    key?: true;
    enabled?: true;
    createdAt?: true;
  };

  export type FeatureFlagMaxAggregateInputType = {
    id?: true;
    orgId?: true;
    key?: true;
    enabled?: true;
    createdAt?: true;
  };

  export type FeatureFlagCountAggregateInputType = {
    id?: true;
    orgId?: true;
    key?: true;
    enabled?: true;
    createdAt?: true;
    _all?: true;
  };

  export type FeatureFlagAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which FeatureFlag to aggregate.
     */
    where?: FeatureFlagWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of FeatureFlags to fetch.
     */
    orderBy?:
      | FeatureFlagOrderByWithRelationInput
      | FeatureFlagOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: FeatureFlagWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` FeatureFlags from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` FeatureFlags.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned FeatureFlags
     **/
    _count?: true | FeatureFlagCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: FeatureFlagMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: FeatureFlagMaxAggregateInputType;
  };

  export type GetFeatureFlagAggregateType<T extends FeatureFlagAggregateArgs> =
    {
      [P in keyof T & keyof AggregateFeatureFlag]: P extends "_count" | "count"
        ? T[P] extends true
          ? number
          : GetScalarType<T[P], AggregateFeatureFlag[P]>
        : GetScalarType<T[P], AggregateFeatureFlag[P]>;
    };

  export type FeatureFlagGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: FeatureFlagWhereInput;
    orderBy?:
      | FeatureFlagOrderByWithAggregationInput
      | FeatureFlagOrderByWithAggregationInput[];
    by: FeatureFlagScalarFieldEnum[] | FeatureFlagScalarFieldEnum;
    having?: FeatureFlagScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: FeatureFlagCountAggregateInputType | true;
    _min?: FeatureFlagMinAggregateInputType;
    _max?: FeatureFlagMaxAggregateInputType;
  };

  export type FeatureFlagGroupByOutputType = {
    id: string;
    orgId: string;
    key: string;
    enabled: boolean;
    createdAt: Date;
    _count: FeatureFlagCountAggregateOutputType | null;
    _min: FeatureFlagMinAggregateOutputType | null;
    _max: FeatureFlagMaxAggregateOutputType | null;
  };

  type GetFeatureFlagGroupByPayload<T extends FeatureFlagGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<FeatureFlagGroupByOutputType, T["by"]> & {
          [P in keyof T &
            keyof FeatureFlagGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], FeatureFlagGroupByOutputType[P]>
            : GetScalarType<T[P], FeatureFlagGroupByOutputType[P]>;
        }
      >
    >;

  export type FeatureFlagSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      orgId?: boolean;
      key?: boolean;
      enabled?: boolean;
      createdAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["featureFlag"]
  >;

  export type FeatureFlagSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      orgId?: boolean;
      key?: boolean;
      enabled?: boolean;
      createdAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["featureFlag"]
  >;

  export type FeatureFlagSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      orgId?: boolean;
      key?: boolean;
      enabled?: boolean;
      createdAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["featureFlag"]
  >;

  export type FeatureFlagSelectScalar = {
    id?: boolean;
    orgId?: boolean;
    key?: boolean;
    enabled?: boolean;
    createdAt?: boolean;
  };

  export type FeatureFlagOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    "id" | "orgId" | "key" | "enabled" | "createdAt",
    ExtArgs["result"]["featureFlag"]
  >;
  export type FeatureFlagInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
  };
  export type FeatureFlagIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
  };
  export type FeatureFlagIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
  };

  export type $FeatureFlagPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "FeatureFlag";
    objects: {
      organization: Prisma.$OrganizationPayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        orgId: string;
        key: string;
        enabled: boolean;
        createdAt: Date;
      },
      ExtArgs["result"]["featureFlag"]
    >;
    composites: {};
  };

  type FeatureFlagGetPayload<
    S extends boolean | null | undefined | FeatureFlagDefaultArgs,
  > = $Result.GetResult<Prisma.$FeatureFlagPayload, S>;

  type FeatureFlagCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    FeatureFlagFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: FeatureFlagCountAggregateInputType | true;
  };

  export interface FeatureFlagDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["FeatureFlag"];
      meta: { name: "FeatureFlag" };
    };
    /**
     * Find zero or one FeatureFlag that matches the filter.
     * @param {FeatureFlagFindUniqueArgs} args - Arguments to find a FeatureFlag
     * @example
     * // Get one FeatureFlag
     * const featureFlag = await prisma.featureFlag.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends FeatureFlagFindUniqueArgs>(
      args: SelectSubset<T, FeatureFlagFindUniqueArgs<ExtArgs>>,
    ): Prisma__FeatureFlagClient<
      $Result.GetResult<
        Prisma.$FeatureFlagPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one FeatureFlag that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {FeatureFlagFindUniqueOrThrowArgs} args - Arguments to find a FeatureFlag
     * @example
     * // Get one FeatureFlag
     * const featureFlag = await prisma.featureFlag.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends FeatureFlagFindUniqueOrThrowArgs>(
      args: SelectSubset<T, FeatureFlagFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__FeatureFlagClient<
      $Result.GetResult<
        Prisma.$FeatureFlagPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first FeatureFlag that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FeatureFlagFindFirstArgs} args - Arguments to find a FeatureFlag
     * @example
     * // Get one FeatureFlag
     * const featureFlag = await prisma.featureFlag.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends FeatureFlagFindFirstArgs>(
      args?: SelectSubset<T, FeatureFlagFindFirstArgs<ExtArgs>>,
    ): Prisma__FeatureFlagClient<
      $Result.GetResult<
        Prisma.$FeatureFlagPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first FeatureFlag that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FeatureFlagFindFirstOrThrowArgs} args - Arguments to find a FeatureFlag
     * @example
     * // Get one FeatureFlag
     * const featureFlag = await prisma.featureFlag.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends FeatureFlagFindFirstOrThrowArgs>(
      args?: SelectSubset<T, FeatureFlagFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__FeatureFlagClient<
      $Result.GetResult<
        Prisma.$FeatureFlagPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more FeatureFlags that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FeatureFlagFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all FeatureFlags
     * const featureFlags = await prisma.featureFlag.findMany()
     *
     * // Get first 10 FeatureFlags
     * const featureFlags = await prisma.featureFlag.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const featureFlagWithIdOnly = await prisma.featureFlag.findMany({ select: { id: true } })
     *
     */
    findMany<T extends FeatureFlagFindManyArgs>(
      args?: SelectSubset<T, FeatureFlagFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$FeatureFlagPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a FeatureFlag.
     * @param {FeatureFlagCreateArgs} args - Arguments to create a FeatureFlag.
     * @example
     * // Create one FeatureFlag
     * const FeatureFlag = await prisma.featureFlag.create({
     *   data: {
     *     // ... data to create a FeatureFlag
     *   }
     * })
     *
     */
    create<T extends FeatureFlagCreateArgs>(
      args: SelectSubset<T, FeatureFlagCreateArgs<ExtArgs>>,
    ): Prisma__FeatureFlagClient<
      $Result.GetResult<
        Prisma.$FeatureFlagPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many FeatureFlags.
     * @param {FeatureFlagCreateManyArgs} args - Arguments to create many FeatureFlags.
     * @example
     * // Create many FeatureFlags
     * const featureFlag = await prisma.featureFlag.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends FeatureFlagCreateManyArgs>(
      args?: SelectSubset<T, FeatureFlagCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many FeatureFlags and returns the data saved in the database.
     * @param {FeatureFlagCreateManyAndReturnArgs} args - Arguments to create many FeatureFlags.
     * @example
     * // Create many FeatureFlags
     * const featureFlag = await prisma.featureFlag.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many FeatureFlags and only return the `id`
     * const featureFlagWithIdOnly = await prisma.featureFlag.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends FeatureFlagCreateManyAndReturnArgs>(
      args?: SelectSubset<T, FeatureFlagCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$FeatureFlagPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a FeatureFlag.
     * @param {FeatureFlagDeleteArgs} args - Arguments to delete one FeatureFlag.
     * @example
     * // Delete one FeatureFlag
     * const FeatureFlag = await prisma.featureFlag.delete({
     *   where: {
     *     // ... filter to delete one FeatureFlag
     *   }
     * })
     *
     */
    delete<T extends FeatureFlagDeleteArgs>(
      args: SelectSubset<T, FeatureFlagDeleteArgs<ExtArgs>>,
    ): Prisma__FeatureFlagClient<
      $Result.GetResult<
        Prisma.$FeatureFlagPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one FeatureFlag.
     * @param {FeatureFlagUpdateArgs} args - Arguments to update one FeatureFlag.
     * @example
     * // Update one FeatureFlag
     * const featureFlag = await prisma.featureFlag.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends FeatureFlagUpdateArgs>(
      args: SelectSubset<T, FeatureFlagUpdateArgs<ExtArgs>>,
    ): Prisma__FeatureFlagClient<
      $Result.GetResult<
        Prisma.$FeatureFlagPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more FeatureFlags.
     * @param {FeatureFlagDeleteManyArgs} args - Arguments to filter FeatureFlags to delete.
     * @example
     * // Delete a few FeatureFlags
     * const { count } = await prisma.featureFlag.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends FeatureFlagDeleteManyArgs>(
      args?: SelectSubset<T, FeatureFlagDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more FeatureFlags.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FeatureFlagUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many FeatureFlags
     * const featureFlag = await prisma.featureFlag.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends FeatureFlagUpdateManyArgs>(
      args: SelectSubset<T, FeatureFlagUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more FeatureFlags and returns the data updated in the database.
     * @param {FeatureFlagUpdateManyAndReturnArgs} args - Arguments to update many FeatureFlags.
     * @example
     * // Update many FeatureFlags
     * const featureFlag = await prisma.featureFlag.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more FeatureFlags and only return the `id`
     * const featureFlagWithIdOnly = await prisma.featureFlag.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends FeatureFlagUpdateManyAndReturnArgs>(
      args: SelectSubset<T, FeatureFlagUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$FeatureFlagPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one FeatureFlag.
     * @param {FeatureFlagUpsertArgs} args - Arguments to update or create a FeatureFlag.
     * @example
     * // Update or create a FeatureFlag
     * const featureFlag = await prisma.featureFlag.upsert({
     *   create: {
     *     // ... data to create a FeatureFlag
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the FeatureFlag we want to update
     *   }
     * })
     */
    upsert<T extends FeatureFlagUpsertArgs>(
      args: SelectSubset<T, FeatureFlagUpsertArgs<ExtArgs>>,
    ): Prisma__FeatureFlagClient<
      $Result.GetResult<
        Prisma.$FeatureFlagPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of FeatureFlags.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FeatureFlagCountArgs} args - Arguments to filter FeatureFlags to count.
     * @example
     * // Count the number of FeatureFlags
     * const count = await prisma.featureFlag.count({
     *   where: {
     *     // ... the filter for the FeatureFlags we want to count
     *   }
     * })
     **/
    count<T extends FeatureFlagCountArgs>(
      args?: Subset<T, FeatureFlagCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], FeatureFlagCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a FeatureFlag.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FeatureFlagAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends FeatureFlagAggregateArgs>(
      args: Subset<T, FeatureFlagAggregateArgs>,
    ): Prisma.PrismaPromise<GetFeatureFlagAggregateType<T>>;

    /**
     * Group by FeatureFlag.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FeatureFlagGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends FeatureFlagGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: FeatureFlagGroupByArgs["orderBy"] }
        : { orderBy?: FeatureFlagGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, FeatureFlagGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetFeatureFlagGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the FeatureFlag model
     */
    readonly fields: FeatureFlagFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for FeatureFlag.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__FeatureFlagClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organization<T extends OrganizationDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, OrganizationDefaultArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      | $Result.GetResult<
          Prisma.$OrganizationPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the FeatureFlag model
   */
  interface FeatureFlagFieldRefs {
    readonly id: FieldRef<"FeatureFlag", "String">;
    readonly orgId: FieldRef<"FeatureFlag", "String">;
    readonly key: FieldRef<"FeatureFlag", "String">;
    readonly enabled: FieldRef<"FeatureFlag", "Boolean">;
    readonly createdAt: FieldRef<"FeatureFlag", "DateTime">;
  }

  // Custom InputTypes
  /**
   * FeatureFlag findUnique
   */
  export type FeatureFlagFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagInclude<ExtArgs> | null;
    /**
     * Filter, which FeatureFlag to fetch.
     */
    where: FeatureFlagWhereUniqueInput;
  };

  /**
   * FeatureFlag findUniqueOrThrow
   */
  export type FeatureFlagFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagInclude<ExtArgs> | null;
    /**
     * Filter, which FeatureFlag to fetch.
     */
    where: FeatureFlagWhereUniqueInput;
  };

  /**
   * FeatureFlag findFirst
   */
  export type FeatureFlagFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagInclude<ExtArgs> | null;
    /**
     * Filter, which FeatureFlag to fetch.
     */
    where?: FeatureFlagWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of FeatureFlags to fetch.
     */
    orderBy?:
      | FeatureFlagOrderByWithRelationInput
      | FeatureFlagOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for FeatureFlags.
     */
    cursor?: FeatureFlagWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` FeatureFlags from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` FeatureFlags.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of FeatureFlags.
     */
    distinct?: FeatureFlagScalarFieldEnum | FeatureFlagScalarFieldEnum[];
  };

  /**
   * FeatureFlag findFirstOrThrow
   */
  export type FeatureFlagFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagInclude<ExtArgs> | null;
    /**
     * Filter, which FeatureFlag to fetch.
     */
    where?: FeatureFlagWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of FeatureFlags to fetch.
     */
    orderBy?:
      | FeatureFlagOrderByWithRelationInput
      | FeatureFlagOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for FeatureFlags.
     */
    cursor?: FeatureFlagWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` FeatureFlags from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` FeatureFlags.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of FeatureFlags.
     */
    distinct?: FeatureFlagScalarFieldEnum | FeatureFlagScalarFieldEnum[];
  };

  /**
   * FeatureFlag findMany
   */
  export type FeatureFlagFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagInclude<ExtArgs> | null;
    /**
     * Filter, which FeatureFlags to fetch.
     */
    where?: FeatureFlagWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of FeatureFlags to fetch.
     */
    orderBy?:
      | FeatureFlagOrderByWithRelationInput
      | FeatureFlagOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing FeatureFlags.
     */
    cursor?: FeatureFlagWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` FeatureFlags from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` FeatureFlags.
     */
    skip?: number;
    distinct?: FeatureFlagScalarFieldEnum | FeatureFlagScalarFieldEnum[];
  };

  /**
   * FeatureFlag create
   */
  export type FeatureFlagCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagInclude<ExtArgs> | null;
    /**
     * The data needed to create a FeatureFlag.
     */
    data: XOR<FeatureFlagCreateInput, FeatureFlagUncheckedCreateInput>;
  };

  /**
   * FeatureFlag createMany
   */
  export type FeatureFlagCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many FeatureFlags.
     */
    data: FeatureFlagCreateManyInput | FeatureFlagCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * FeatureFlag createManyAndReturn
   */
  export type FeatureFlagCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * The data used to create many FeatureFlags.
     */
    data: FeatureFlagCreateManyInput | FeatureFlagCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * FeatureFlag update
   */
  export type FeatureFlagUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagInclude<ExtArgs> | null;
    /**
     * The data needed to update a FeatureFlag.
     */
    data: XOR<FeatureFlagUpdateInput, FeatureFlagUncheckedUpdateInput>;
    /**
     * Choose, which FeatureFlag to update.
     */
    where: FeatureFlagWhereUniqueInput;
  };

  /**
   * FeatureFlag updateMany
   */
  export type FeatureFlagUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update FeatureFlags.
     */
    data: XOR<
      FeatureFlagUpdateManyMutationInput,
      FeatureFlagUncheckedUpdateManyInput
    >;
    /**
     * Filter which FeatureFlags to update
     */
    where?: FeatureFlagWhereInput;
    /**
     * Limit how many FeatureFlags to update.
     */
    limit?: number;
  };

  /**
   * FeatureFlag updateManyAndReturn
   */
  export type FeatureFlagUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * The data used to update FeatureFlags.
     */
    data: XOR<
      FeatureFlagUpdateManyMutationInput,
      FeatureFlagUncheckedUpdateManyInput
    >;
    /**
     * Filter which FeatureFlags to update
     */
    where?: FeatureFlagWhereInput;
    /**
     * Limit how many FeatureFlags to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * FeatureFlag upsert
   */
  export type FeatureFlagUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagInclude<ExtArgs> | null;
    /**
     * The filter to search for the FeatureFlag to update in case it exists.
     */
    where: FeatureFlagWhereUniqueInput;
    /**
     * In case the FeatureFlag found by the `where` argument doesn't exist, create a new FeatureFlag with this data.
     */
    create: XOR<FeatureFlagCreateInput, FeatureFlagUncheckedCreateInput>;
    /**
     * In case the FeatureFlag was found with the provided `where` argument, update it with this data.
     */
    update: XOR<FeatureFlagUpdateInput, FeatureFlagUncheckedUpdateInput>;
  };

  /**
   * FeatureFlag delete
   */
  export type FeatureFlagDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagInclude<ExtArgs> | null;
    /**
     * Filter which FeatureFlag to delete.
     */
    where: FeatureFlagWhereUniqueInput;
  };

  /**
   * FeatureFlag deleteMany
   */
  export type FeatureFlagDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which FeatureFlags to delete
     */
    where?: FeatureFlagWhereInput;
    /**
     * Limit how many FeatureFlags to delete.
     */
    limit?: number;
  };

  /**
   * FeatureFlag without action
   */
  export type FeatureFlagDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the FeatureFlag
     */
    select?: FeatureFlagSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the FeatureFlag
     */
    omit?: FeatureFlagOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FeatureFlagInclude<ExtArgs> | null;
  };

  /**
   * Model VolunteerApplication
   */

  export type AggregateVolunteerApplication = {
    _count: VolunteerApplicationCountAggregateOutputType | null;
    _min: VolunteerApplicationMinAggregateOutputType | null;
    _max: VolunteerApplicationMaxAggregateOutputType | null;
  };

  export type VolunteerApplicationMinAggregateOutputType = {
    id: string | null;
    orgId: string | null;
    submittedByEmail: string | null;
    status: $Enums.ApplicationStatus | null;
    screeningStatus: $Enums.ScreeningStatus | null;
    submittedAt: Date | null;
  };

  export type VolunteerApplicationMaxAggregateOutputType = {
    id: string | null;
    orgId: string | null;
    submittedByEmail: string | null;
    status: $Enums.ApplicationStatus | null;
    screeningStatus: $Enums.ScreeningStatus | null;
    submittedAt: Date | null;
  };

  export type VolunteerApplicationCountAggregateOutputType = {
    id: number;
    orgId: number;
    submittedByEmail: number;
    status: number;
    screeningStatus: number;
    screeningReasons: number;
    submittedAt: number;
    _all: number;
  };

  export type VolunteerApplicationMinAggregateInputType = {
    id?: true;
    orgId?: true;
    submittedByEmail?: true;
    status?: true;
    screeningStatus?: true;
    submittedAt?: true;
  };

  export type VolunteerApplicationMaxAggregateInputType = {
    id?: true;
    orgId?: true;
    submittedByEmail?: true;
    status?: true;
    screeningStatus?: true;
    submittedAt?: true;
  };

  export type VolunteerApplicationCountAggregateInputType = {
    id?: true;
    orgId?: true;
    submittedByEmail?: true;
    status?: true;
    screeningStatus?: true;
    screeningReasons?: true;
    submittedAt?: true;
    _all?: true;
  };

  export type VolunteerApplicationAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which VolunteerApplication to aggregate.
     */
    where?: VolunteerApplicationWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of VolunteerApplications to fetch.
     */
    orderBy?:
      | VolunteerApplicationOrderByWithRelationInput
      | VolunteerApplicationOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: VolunteerApplicationWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` VolunteerApplications from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` VolunteerApplications.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned VolunteerApplications
     **/
    _count?: true | VolunteerApplicationCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: VolunteerApplicationMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: VolunteerApplicationMaxAggregateInputType;
  };

  export type GetVolunteerApplicationAggregateType<
    T extends VolunteerApplicationAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateVolunteerApplication]: P extends
      | "_count"
      | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateVolunteerApplication[P]>
      : GetScalarType<T[P], AggregateVolunteerApplication[P]>;
  };

  export type VolunteerApplicationGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: VolunteerApplicationWhereInput;
    orderBy?:
      | VolunteerApplicationOrderByWithAggregationInput
      | VolunteerApplicationOrderByWithAggregationInput[];
    by:
      | VolunteerApplicationScalarFieldEnum[]
      | VolunteerApplicationScalarFieldEnum;
    having?: VolunteerApplicationScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: VolunteerApplicationCountAggregateInputType | true;
    _min?: VolunteerApplicationMinAggregateInputType;
    _max?: VolunteerApplicationMaxAggregateInputType;
  };

  export type VolunteerApplicationGroupByOutputType = {
    id: string;
    orgId: string;
    submittedByEmail: string;
    status: $Enums.ApplicationStatus;
    screeningStatus: $Enums.ScreeningStatus;
    screeningReasons: JsonValue;
    submittedAt: Date;
    _count: VolunteerApplicationCountAggregateOutputType | null;
    _min: VolunteerApplicationMinAggregateOutputType | null;
    _max: VolunteerApplicationMaxAggregateOutputType | null;
  };

  type GetVolunteerApplicationGroupByPayload<
    T extends VolunteerApplicationGroupByArgs,
  > = Prisma.PrismaPromise<
    Array<
      PickEnumerable<VolunteerApplicationGroupByOutputType, T["by"]> & {
        [P in keyof T &
          keyof VolunteerApplicationGroupByOutputType]: P extends "_count"
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], VolunteerApplicationGroupByOutputType[P]>
          : GetScalarType<T[P], VolunteerApplicationGroupByOutputType[P]>;
      }
    >
  >;

  export type VolunteerApplicationSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      orgId?: boolean;
      submittedByEmail?: boolean;
      status?: boolean;
      screeningStatus?: boolean;
      screeningReasons?: boolean;
      submittedAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
      answers?: boolean | VolunteerApplication$answersArgs<ExtArgs>;
      _count?:
        | boolean
        | VolunteerApplicationCountOutputTypeDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["volunteerApplication"]
  >;

  export type VolunteerApplicationSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      orgId?: boolean;
      submittedByEmail?: boolean;
      status?: boolean;
      screeningStatus?: boolean;
      screeningReasons?: boolean;
      submittedAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["volunteerApplication"]
  >;

  export type VolunteerApplicationSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      orgId?: boolean;
      submittedByEmail?: boolean;
      status?: boolean;
      screeningStatus?: boolean;
      screeningReasons?: boolean;
      submittedAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["volunteerApplication"]
  >;

  export type VolunteerApplicationSelectScalar = {
    id?: boolean;
    orgId?: boolean;
    submittedByEmail?: boolean;
    status?: boolean;
    screeningStatus?: boolean;
    screeningReasons?: boolean;
    submittedAt?: boolean;
  };

  export type VolunteerApplicationOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "orgId"
    | "submittedByEmail"
    | "status"
    | "screeningStatus"
    | "screeningReasons"
    | "submittedAt",
    ExtArgs["result"]["volunteerApplication"]
  >;
  export type VolunteerApplicationInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    answers?: boolean | VolunteerApplication$answersArgs<ExtArgs>;
    _count?: boolean | VolunteerApplicationCountOutputTypeDefaultArgs<ExtArgs>;
  };
  export type VolunteerApplicationIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
  };
  export type VolunteerApplicationIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
  };

  export type $VolunteerApplicationPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "VolunteerApplication";
    objects: {
      organization: Prisma.$OrganizationPayload<ExtArgs>;
      answers: Prisma.$VolunteerAnswerPayload<ExtArgs>[];
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        orgId: string;
        submittedByEmail: string;
        status: $Enums.ApplicationStatus;
        screeningStatus: $Enums.ScreeningStatus;
        screeningReasons: Prisma.JsonValue;
        submittedAt: Date;
      },
      ExtArgs["result"]["volunteerApplication"]
    >;
    composites: {};
  };

  type VolunteerApplicationGetPayload<
    S extends boolean | null | undefined | VolunteerApplicationDefaultArgs,
  > = $Result.GetResult<Prisma.$VolunteerApplicationPayload, S>;

  type VolunteerApplicationCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    VolunteerApplicationFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: VolunteerApplicationCountAggregateInputType | true;
  };

  export interface VolunteerApplicationDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["VolunteerApplication"];
      meta: { name: "VolunteerApplication" };
    };
    /**
     * Find zero or one VolunteerApplication that matches the filter.
     * @param {VolunteerApplicationFindUniqueArgs} args - Arguments to find a VolunteerApplication
     * @example
     * // Get one VolunteerApplication
     * const volunteerApplication = await prisma.volunteerApplication.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends VolunteerApplicationFindUniqueArgs>(
      args: SelectSubset<T, VolunteerApplicationFindUniqueArgs<ExtArgs>>,
    ): Prisma__VolunteerApplicationClient<
      $Result.GetResult<
        Prisma.$VolunteerApplicationPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one VolunteerApplication that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {VolunteerApplicationFindUniqueOrThrowArgs} args - Arguments to find a VolunteerApplication
     * @example
     * // Get one VolunteerApplication
     * const volunteerApplication = await prisma.volunteerApplication.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends VolunteerApplicationFindUniqueOrThrowArgs>(
      args: SelectSubset<T, VolunteerApplicationFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__VolunteerApplicationClient<
      $Result.GetResult<
        Prisma.$VolunteerApplicationPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first VolunteerApplication that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerApplicationFindFirstArgs} args - Arguments to find a VolunteerApplication
     * @example
     * // Get one VolunteerApplication
     * const volunteerApplication = await prisma.volunteerApplication.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends VolunteerApplicationFindFirstArgs>(
      args?: SelectSubset<T, VolunteerApplicationFindFirstArgs<ExtArgs>>,
    ): Prisma__VolunteerApplicationClient<
      $Result.GetResult<
        Prisma.$VolunteerApplicationPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first VolunteerApplication that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerApplicationFindFirstOrThrowArgs} args - Arguments to find a VolunteerApplication
     * @example
     * // Get one VolunteerApplication
     * const volunteerApplication = await prisma.volunteerApplication.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends VolunteerApplicationFindFirstOrThrowArgs>(
      args?: SelectSubset<T, VolunteerApplicationFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__VolunteerApplicationClient<
      $Result.GetResult<
        Prisma.$VolunteerApplicationPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more VolunteerApplications that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerApplicationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all VolunteerApplications
     * const volunteerApplications = await prisma.volunteerApplication.findMany()
     *
     * // Get first 10 VolunteerApplications
     * const volunteerApplications = await prisma.volunteerApplication.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const volunteerApplicationWithIdOnly = await prisma.volunteerApplication.findMany({ select: { id: true } })
     *
     */
    findMany<T extends VolunteerApplicationFindManyArgs>(
      args?: SelectSubset<T, VolunteerApplicationFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$VolunteerApplicationPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a VolunteerApplication.
     * @param {VolunteerApplicationCreateArgs} args - Arguments to create a VolunteerApplication.
     * @example
     * // Create one VolunteerApplication
     * const VolunteerApplication = await prisma.volunteerApplication.create({
     *   data: {
     *     // ... data to create a VolunteerApplication
     *   }
     * })
     *
     */
    create<T extends VolunteerApplicationCreateArgs>(
      args: SelectSubset<T, VolunteerApplicationCreateArgs<ExtArgs>>,
    ): Prisma__VolunteerApplicationClient<
      $Result.GetResult<
        Prisma.$VolunteerApplicationPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many VolunteerApplications.
     * @param {VolunteerApplicationCreateManyArgs} args - Arguments to create many VolunteerApplications.
     * @example
     * // Create many VolunteerApplications
     * const volunteerApplication = await prisma.volunteerApplication.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends VolunteerApplicationCreateManyArgs>(
      args?: SelectSubset<T, VolunteerApplicationCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many VolunteerApplications and returns the data saved in the database.
     * @param {VolunteerApplicationCreateManyAndReturnArgs} args - Arguments to create many VolunteerApplications.
     * @example
     * // Create many VolunteerApplications
     * const volunteerApplication = await prisma.volunteerApplication.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many VolunteerApplications and only return the `id`
     * const volunteerApplicationWithIdOnly = await prisma.volunteerApplication.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends VolunteerApplicationCreateManyAndReturnArgs>(
      args?: SelectSubset<
        T,
        VolunteerApplicationCreateManyAndReturnArgs<ExtArgs>
      >,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$VolunteerApplicationPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a VolunteerApplication.
     * @param {VolunteerApplicationDeleteArgs} args - Arguments to delete one VolunteerApplication.
     * @example
     * // Delete one VolunteerApplication
     * const VolunteerApplication = await prisma.volunteerApplication.delete({
     *   where: {
     *     // ... filter to delete one VolunteerApplication
     *   }
     * })
     *
     */
    delete<T extends VolunteerApplicationDeleteArgs>(
      args: SelectSubset<T, VolunteerApplicationDeleteArgs<ExtArgs>>,
    ): Prisma__VolunteerApplicationClient<
      $Result.GetResult<
        Prisma.$VolunteerApplicationPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one VolunteerApplication.
     * @param {VolunteerApplicationUpdateArgs} args - Arguments to update one VolunteerApplication.
     * @example
     * // Update one VolunteerApplication
     * const volunteerApplication = await prisma.volunteerApplication.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends VolunteerApplicationUpdateArgs>(
      args: SelectSubset<T, VolunteerApplicationUpdateArgs<ExtArgs>>,
    ): Prisma__VolunteerApplicationClient<
      $Result.GetResult<
        Prisma.$VolunteerApplicationPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more VolunteerApplications.
     * @param {VolunteerApplicationDeleteManyArgs} args - Arguments to filter VolunteerApplications to delete.
     * @example
     * // Delete a few VolunteerApplications
     * const { count } = await prisma.volunteerApplication.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends VolunteerApplicationDeleteManyArgs>(
      args?: SelectSubset<T, VolunteerApplicationDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more VolunteerApplications.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerApplicationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many VolunteerApplications
     * const volunteerApplication = await prisma.volunteerApplication.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends VolunteerApplicationUpdateManyArgs>(
      args: SelectSubset<T, VolunteerApplicationUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more VolunteerApplications and returns the data updated in the database.
     * @param {VolunteerApplicationUpdateManyAndReturnArgs} args - Arguments to update many VolunteerApplications.
     * @example
     * // Update many VolunteerApplications
     * const volunteerApplication = await prisma.volunteerApplication.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more VolunteerApplications and only return the `id`
     * const volunteerApplicationWithIdOnly = await prisma.volunteerApplication.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends VolunteerApplicationUpdateManyAndReturnArgs>(
      args: SelectSubset<
        T,
        VolunteerApplicationUpdateManyAndReturnArgs<ExtArgs>
      >,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$VolunteerApplicationPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one VolunteerApplication.
     * @param {VolunteerApplicationUpsertArgs} args - Arguments to update or create a VolunteerApplication.
     * @example
     * // Update or create a VolunteerApplication
     * const volunteerApplication = await prisma.volunteerApplication.upsert({
     *   create: {
     *     // ... data to create a VolunteerApplication
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the VolunteerApplication we want to update
     *   }
     * })
     */
    upsert<T extends VolunteerApplicationUpsertArgs>(
      args: SelectSubset<T, VolunteerApplicationUpsertArgs<ExtArgs>>,
    ): Prisma__VolunteerApplicationClient<
      $Result.GetResult<
        Prisma.$VolunteerApplicationPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of VolunteerApplications.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerApplicationCountArgs} args - Arguments to filter VolunteerApplications to count.
     * @example
     * // Count the number of VolunteerApplications
     * const count = await prisma.volunteerApplication.count({
     *   where: {
     *     // ... the filter for the VolunteerApplications we want to count
     *   }
     * })
     **/
    count<T extends VolunteerApplicationCountArgs>(
      args?: Subset<T, VolunteerApplicationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<
              T["select"],
              VolunteerApplicationCountAggregateOutputType
            >
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a VolunteerApplication.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerApplicationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends VolunteerApplicationAggregateArgs>(
      args: Subset<T, VolunteerApplicationAggregateArgs>,
    ): Prisma.PrismaPromise<GetVolunteerApplicationAggregateType<T>>;

    /**
     * Group by VolunteerApplication.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerApplicationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends VolunteerApplicationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: VolunteerApplicationGroupByArgs["orderBy"] }
        : { orderBy?: VolunteerApplicationGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, VolunteerApplicationGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetVolunteerApplicationGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the VolunteerApplication model
     */
    readonly fields: VolunteerApplicationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for VolunteerApplication.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__VolunteerApplicationClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organization<T extends OrganizationDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, OrganizationDefaultArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      | $Result.GetResult<
          Prisma.$OrganizationPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    answers<T extends VolunteerApplication$answersArgs<ExtArgs> = {}>(
      args?: Subset<T, VolunteerApplication$answersArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<
          Prisma.$VolunteerAnswerPayload<ExtArgs>,
          T,
          "findMany",
          GlobalOmitOptions
        >
      | Null
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the VolunteerApplication model
   */
  interface VolunteerApplicationFieldRefs {
    readonly id: FieldRef<"VolunteerApplication", "String">;
    readonly orgId: FieldRef<"VolunteerApplication", "String">;
    readonly submittedByEmail: FieldRef<"VolunteerApplication", "String">;
    readonly status: FieldRef<"VolunteerApplication", "ApplicationStatus">;
    readonly screeningStatus: FieldRef<
      "VolunteerApplication",
      "ScreeningStatus"
    >;
    readonly screeningReasons: FieldRef<"VolunteerApplication", "Json">;
    readonly submittedAt: FieldRef<"VolunteerApplication", "DateTime">;
  }

  // Custom InputTypes
  /**
   * VolunteerApplication findUnique
   */
  export type VolunteerApplicationFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationInclude<ExtArgs> | null;
    /**
     * Filter, which VolunteerApplication to fetch.
     */
    where: VolunteerApplicationWhereUniqueInput;
  };

  /**
   * VolunteerApplication findUniqueOrThrow
   */
  export type VolunteerApplicationFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationInclude<ExtArgs> | null;
    /**
     * Filter, which VolunteerApplication to fetch.
     */
    where: VolunteerApplicationWhereUniqueInput;
  };

  /**
   * VolunteerApplication findFirst
   */
  export type VolunteerApplicationFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationInclude<ExtArgs> | null;
    /**
     * Filter, which VolunteerApplication to fetch.
     */
    where?: VolunteerApplicationWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of VolunteerApplications to fetch.
     */
    orderBy?:
      | VolunteerApplicationOrderByWithRelationInput
      | VolunteerApplicationOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for VolunteerApplications.
     */
    cursor?: VolunteerApplicationWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` VolunteerApplications from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` VolunteerApplications.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of VolunteerApplications.
     */
    distinct?:
      | VolunteerApplicationScalarFieldEnum
      | VolunteerApplicationScalarFieldEnum[];
  };

  /**
   * VolunteerApplication findFirstOrThrow
   */
  export type VolunteerApplicationFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationInclude<ExtArgs> | null;
    /**
     * Filter, which VolunteerApplication to fetch.
     */
    where?: VolunteerApplicationWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of VolunteerApplications to fetch.
     */
    orderBy?:
      | VolunteerApplicationOrderByWithRelationInput
      | VolunteerApplicationOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for VolunteerApplications.
     */
    cursor?: VolunteerApplicationWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` VolunteerApplications from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` VolunteerApplications.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of VolunteerApplications.
     */
    distinct?:
      | VolunteerApplicationScalarFieldEnum
      | VolunteerApplicationScalarFieldEnum[];
  };

  /**
   * VolunteerApplication findMany
   */
  export type VolunteerApplicationFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationInclude<ExtArgs> | null;
    /**
     * Filter, which VolunteerApplications to fetch.
     */
    where?: VolunteerApplicationWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of VolunteerApplications to fetch.
     */
    orderBy?:
      | VolunteerApplicationOrderByWithRelationInput
      | VolunteerApplicationOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing VolunteerApplications.
     */
    cursor?: VolunteerApplicationWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` VolunteerApplications from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` VolunteerApplications.
     */
    skip?: number;
    distinct?:
      | VolunteerApplicationScalarFieldEnum
      | VolunteerApplicationScalarFieldEnum[];
  };

  /**
   * VolunteerApplication create
   */
  export type VolunteerApplicationCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationInclude<ExtArgs> | null;
    /**
     * The data needed to create a VolunteerApplication.
     */
    data: XOR<
      VolunteerApplicationCreateInput,
      VolunteerApplicationUncheckedCreateInput
    >;
  };

  /**
   * VolunteerApplication createMany
   */
  export type VolunteerApplicationCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many VolunteerApplications.
     */
    data:
      | VolunteerApplicationCreateManyInput
      | VolunteerApplicationCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * VolunteerApplication createManyAndReturn
   */
  export type VolunteerApplicationCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * The data used to create many VolunteerApplications.
     */
    data:
      | VolunteerApplicationCreateManyInput
      | VolunteerApplicationCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * VolunteerApplication update
   */
  export type VolunteerApplicationUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationInclude<ExtArgs> | null;
    /**
     * The data needed to update a VolunteerApplication.
     */
    data: XOR<
      VolunteerApplicationUpdateInput,
      VolunteerApplicationUncheckedUpdateInput
    >;
    /**
     * Choose, which VolunteerApplication to update.
     */
    where: VolunteerApplicationWhereUniqueInput;
  };

  /**
   * VolunteerApplication updateMany
   */
  export type VolunteerApplicationUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update VolunteerApplications.
     */
    data: XOR<
      VolunteerApplicationUpdateManyMutationInput,
      VolunteerApplicationUncheckedUpdateManyInput
    >;
    /**
     * Filter which VolunteerApplications to update
     */
    where?: VolunteerApplicationWhereInput;
    /**
     * Limit how many VolunteerApplications to update.
     */
    limit?: number;
  };

  /**
   * VolunteerApplication updateManyAndReturn
   */
  export type VolunteerApplicationUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * The data used to update VolunteerApplications.
     */
    data: XOR<
      VolunteerApplicationUpdateManyMutationInput,
      VolunteerApplicationUncheckedUpdateManyInput
    >;
    /**
     * Filter which VolunteerApplications to update
     */
    where?: VolunteerApplicationWhereInput;
    /**
     * Limit how many VolunteerApplications to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * VolunteerApplication upsert
   */
  export type VolunteerApplicationUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationInclude<ExtArgs> | null;
    /**
     * The filter to search for the VolunteerApplication to update in case it exists.
     */
    where: VolunteerApplicationWhereUniqueInput;
    /**
     * In case the VolunteerApplication found by the `where` argument doesn't exist, create a new VolunteerApplication with this data.
     */
    create: XOR<
      VolunteerApplicationCreateInput,
      VolunteerApplicationUncheckedCreateInput
    >;
    /**
     * In case the VolunteerApplication was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      VolunteerApplicationUpdateInput,
      VolunteerApplicationUncheckedUpdateInput
    >;
  };

  /**
   * VolunteerApplication delete
   */
  export type VolunteerApplicationDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationInclude<ExtArgs> | null;
    /**
     * Filter which VolunteerApplication to delete.
     */
    where: VolunteerApplicationWhereUniqueInput;
  };

  /**
   * VolunteerApplication deleteMany
   */
  export type VolunteerApplicationDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which VolunteerApplications to delete
     */
    where?: VolunteerApplicationWhereInput;
    /**
     * Limit how many VolunteerApplications to delete.
     */
    limit?: number;
  };

  /**
   * VolunteerApplication.answers
   */
  export type VolunteerApplication$answersArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerInclude<ExtArgs> | null;
    where?: VolunteerAnswerWhereInput;
    orderBy?:
      | VolunteerAnswerOrderByWithRelationInput
      | VolunteerAnswerOrderByWithRelationInput[];
    cursor?: VolunteerAnswerWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?:
      | VolunteerAnswerScalarFieldEnum
      | VolunteerAnswerScalarFieldEnum[];
  };

  /**
   * VolunteerApplication without action
   */
  export type VolunteerApplicationDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerApplication
     */
    select?: VolunteerApplicationSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerApplication
     */
    omit?: VolunteerApplicationOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerApplicationInclude<ExtArgs> | null;
  };

  /**
   * Model VolunteerAnswer
   */

  export type AggregateVolunteerAnswer = {
    _count: VolunteerAnswerCountAggregateOutputType | null;
    _min: VolunteerAnswerMinAggregateOutputType | null;
    _max: VolunteerAnswerMaxAggregateOutputType | null;
  };

  export type VolunteerAnswerMinAggregateOutputType = {
    id: string | null;
    applicationId: string | null;
    questionId: string | null;
  };

  export type VolunteerAnswerMaxAggregateOutputType = {
    id: string | null;
    applicationId: string | null;
    questionId: string | null;
  };

  export type VolunteerAnswerCountAggregateOutputType = {
    id: number;
    applicationId: number;
    questionId: number;
    answerJson: number;
    _all: number;
  };

  export type VolunteerAnswerMinAggregateInputType = {
    id?: true;
    applicationId?: true;
    questionId?: true;
  };

  export type VolunteerAnswerMaxAggregateInputType = {
    id?: true;
    applicationId?: true;
    questionId?: true;
  };

  export type VolunteerAnswerCountAggregateInputType = {
    id?: true;
    applicationId?: true;
    questionId?: true;
    answerJson?: true;
    _all?: true;
  };

  export type VolunteerAnswerAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which VolunteerAnswer to aggregate.
     */
    where?: VolunteerAnswerWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of VolunteerAnswers to fetch.
     */
    orderBy?:
      | VolunteerAnswerOrderByWithRelationInput
      | VolunteerAnswerOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: VolunteerAnswerWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` VolunteerAnswers from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` VolunteerAnswers.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned VolunteerAnswers
     **/
    _count?: true | VolunteerAnswerCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: VolunteerAnswerMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: VolunteerAnswerMaxAggregateInputType;
  };

  export type GetVolunteerAnswerAggregateType<
    T extends VolunteerAnswerAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateVolunteerAnswer]: P extends
      | "_count"
      | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateVolunteerAnswer[P]>
      : GetScalarType<T[P], AggregateVolunteerAnswer[P]>;
  };

  export type VolunteerAnswerGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: VolunteerAnswerWhereInput;
    orderBy?:
      | VolunteerAnswerOrderByWithAggregationInput
      | VolunteerAnswerOrderByWithAggregationInput[];
    by: VolunteerAnswerScalarFieldEnum[] | VolunteerAnswerScalarFieldEnum;
    having?: VolunteerAnswerScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: VolunteerAnswerCountAggregateInputType | true;
    _min?: VolunteerAnswerMinAggregateInputType;
    _max?: VolunteerAnswerMaxAggregateInputType;
  };

  export type VolunteerAnswerGroupByOutputType = {
    id: string;
    applicationId: string;
    questionId: string;
    answerJson: JsonValue;
    _count: VolunteerAnswerCountAggregateOutputType | null;
    _min: VolunteerAnswerMinAggregateOutputType | null;
    _max: VolunteerAnswerMaxAggregateOutputType | null;
  };

  type GetVolunteerAnswerGroupByPayload<T extends VolunteerAnswerGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<VolunteerAnswerGroupByOutputType, T["by"]> & {
          [P in keyof T &
            keyof VolunteerAnswerGroupByOutputType]: P extends "_count"
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], VolunteerAnswerGroupByOutputType[P]>
            : GetScalarType<T[P], VolunteerAnswerGroupByOutputType[P]>;
        }
      >
    >;

  export type VolunteerAnswerSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      applicationId?: boolean;
      questionId?: boolean;
      answerJson?: boolean;
      application?: boolean | VolunteerApplicationDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["volunteerAnswer"]
  >;

  export type VolunteerAnswerSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      applicationId?: boolean;
      questionId?: boolean;
      answerJson?: boolean;
      application?: boolean | VolunteerApplicationDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["volunteerAnswer"]
  >;

  export type VolunteerAnswerSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      applicationId?: boolean;
      questionId?: boolean;
      answerJson?: boolean;
      application?: boolean | VolunteerApplicationDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["volunteerAnswer"]
  >;

  export type VolunteerAnswerSelectScalar = {
    id?: boolean;
    applicationId?: boolean;
    questionId?: boolean;
    answerJson?: boolean;
  };

  export type VolunteerAnswerOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    "id" | "applicationId" | "questionId" | "answerJson",
    ExtArgs["result"]["volunteerAnswer"]
  >;
  export type VolunteerAnswerInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    application?: boolean | VolunteerApplicationDefaultArgs<ExtArgs>;
  };
  export type VolunteerAnswerIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    application?: boolean | VolunteerApplicationDefaultArgs<ExtArgs>;
  };
  export type VolunteerAnswerIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    application?: boolean | VolunteerApplicationDefaultArgs<ExtArgs>;
  };

  export type $VolunteerAnswerPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "VolunteerAnswer";
    objects: {
      application: Prisma.$VolunteerApplicationPayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        applicationId: string;
        questionId: string;
        answerJson: Prisma.JsonValue;
      },
      ExtArgs["result"]["volunteerAnswer"]
    >;
    composites: {};
  };

  type VolunteerAnswerGetPayload<
    S extends boolean | null | undefined | VolunteerAnswerDefaultArgs,
  > = $Result.GetResult<Prisma.$VolunteerAnswerPayload, S>;

  type VolunteerAnswerCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    VolunteerAnswerFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: VolunteerAnswerCountAggregateInputType | true;
  };

  export interface VolunteerAnswerDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["VolunteerAnswer"];
      meta: { name: "VolunteerAnswer" };
    };
    /**
     * Find zero or one VolunteerAnswer that matches the filter.
     * @param {VolunteerAnswerFindUniqueArgs} args - Arguments to find a VolunteerAnswer
     * @example
     * // Get one VolunteerAnswer
     * const volunteerAnswer = await prisma.volunteerAnswer.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends VolunteerAnswerFindUniqueArgs>(
      args: SelectSubset<T, VolunteerAnswerFindUniqueArgs<ExtArgs>>,
    ): Prisma__VolunteerAnswerClient<
      $Result.GetResult<
        Prisma.$VolunteerAnswerPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one VolunteerAnswer that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {VolunteerAnswerFindUniqueOrThrowArgs} args - Arguments to find a VolunteerAnswer
     * @example
     * // Get one VolunteerAnswer
     * const volunteerAnswer = await prisma.volunteerAnswer.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends VolunteerAnswerFindUniqueOrThrowArgs>(
      args: SelectSubset<T, VolunteerAnswerFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__VolunteerAnswerClient<
      $Result.GetResult<
        Prisma.$VolunteerAnswerPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first VolunteerAnswer that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerAnswerFindFirstArgs} args - Arguments to find a VolunteerAnswer
     * @example
     * // Get one VolunteerAnswer
     * const volunteerAnswer = await prisma.volunteerAnswer.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends VolunteerAnswerFindFirstArgs>(
      args?: SelectSubset<T, VolunteerAnswerFindFirstArgs<ExtArgs>>,
    ): Prisma__VolunteerAnswerClient<
      $Result.GetResult<
        Prisma.$VolunteerAnswerPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first VolunteerAnswer that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerAnswerFindFirstOrThrowArgs} args - Arguments to find a VolunteerAnswer
     * @example
     * // Get one VolunteerAnswer
     * const volunteerAnswer = await prisma.volunteerAnswer.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends VolunteerAnswerFindFirstOrThrowArgs>(
      args?: SelectSubset<T, VolunteerAnswerFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__VolunteerAnswerClient<
      $Result.GetResult<
        Prisma.$VolunteerAnswerPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more VolunteerAnswers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerAnswerFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all VolunteerAnswers
     * const volunteerAnswers = await prisma.volunteerAnswer.findMany()
     *
     * // Get first 10 VolunteerAnswers
     * const volunteerAnswers = await prisma.volunteerAnswer.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const volunteerAnswerWithIdOnly = await prisma.volunteerAnswer.findMany({ select: { id: true } })
     *
     */
    findMany<T extends VolunteerAnswerFindManyArgs>(
      args?: SelectSubset<T, VolunteerAnswerFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$VolunteerAnswerPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a VolunteerAnswer.
     * @param {VolunteerAnswerCreateArgs} args - Arguments to create a VolunteerAnswer.
     * @example
     * // Create one VolunteerAnswer
     * const VolunteerAnswer = await prisma.volunteerAnswer.create({
     *   data: {
     *     // ... data to create a VolunteerAnswer
     *   }
     * })
     *
     */
    create<T extends VolunteerAnswerCreateArgs>(
      args: SelectSubset<T, VolunteerAnswerCreateArgs<ExtArgs>>,
    ): Prisma__VolunteerAnswerClient<
      $Result.GetResult<
        Prisma.$VolunteerAnswerPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many VolunteerAnswers.
     * @param {VolunteerAnswerCreateManyArgs} args - Arguments to create many VolunteerAnswers.
     * @example
     * // Create many VolunteerAnswers
     * const volunteerAnswer = await prisma.volunteerAnswer.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends VolunteerAnswerCreateManyArgs>(
      args?: SelectSubset<T, VolunteerAnswerCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many VolunteerAnswers and returns the data saved in the database.
     * @param {VolunteerAnswerCreateManyAndReturnArgs} args - Arguments to create many VolunteerAnswers.
     * @example
     * // Create many VolunteerAnswers
     * const volunteerAnswer = await prisma.volunteerAnswer.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many VolunteerAnswers and only return the `id`
     * const volunteerAnswerWithIdOnly = await prisma.volunteerAnswer.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends VolunteerAnswerCreateManyAndReturnArgs>(
      args?: SelectSubset<T, VolunteerAnswerCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$VolunteerAnswerPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a VolunteerAnswer.
     * @param {VolunteerAnswerDeleteArgs} args - Arguments to delete one VolunteerAnswer.
     * @example
     * // Delete one VolunteerAnswer
     * const VolunteerAnswer = await prisma.volunteerAnswer.delete({
     *   where: {
     *     // ... filter to delete one VolunteerAnswer
     *   }
     * })
     *
     */
    delete<T extends VolunteerAnswerDeleteArgs>(
      args: SelectSubset<T, VolunteerAnswerDeleteArgs<ExtArgs>>,
    ): Prisma__VolunteerAnswerClient<
      $Result.GetResult<
        Prisma.$VolunteerAnswerPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one VolunteerAnswer.
     * @param {VolunteerAnswerUpdateArgs} args - Arguments to update one VolunteerAnswer.
     * @example
     * // Update one VolunteerAnswer
     * const volunteerAnswer = await prisma.volunteerAnswer.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends VolunteerAnswerUpdateArgs>(
      args: SelectSubset<T, VolunteerAnswerUpdateArgs<ExtArgs>>,
    ): Prisma__VolunteerAnswerClient<
      $Result.GetResult<
        Prisma.$VolunteerAnswerPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more VolunteerAnswers.
     * @param {VolunteerAnswerDeleteManyArgs} args - Arguments to filter VolunteerAnswers to delete.
     * @example
     * // Delete a few VolunteerAnswers
     * const { count } = await prisma.volunteerAnswer.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends VolunteerAnswerDeleteManyArgs>(
      args?: SelectSubset<T, VolunteerAnswerDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more VolunteerAnswers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerAnswerUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many VolunteerAnswers
     * const volunteerAnswer = await prisma.volunteerAnswer.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends VolunteerAnswerUpdateManyArgs>(
      args: SelectSubset<T, VolunteerAnswerUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more VolunteerAnswers and returns the data updated in the database.
     * @param {VolunteerAnswerUpdateManyAndReturnArgs} args - Arguments to update many VolunteerAnswers.
     * @example
     * // Update many VolunteerAnswers
     * const volunteerAnswer = await prisma.volunteerAnswer.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more VolunteerAnswers and only return the `id`
     * const volunteerAnswerWithIdOnly = await prisma.volunteerAnswer.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends VolunteerAnswerUpdateManyAndReturnArgs>(
      args: SelectSubset<T, VolunteerAnswerUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$VolunteerAnswerPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one VolunteerAnswer.
     * @param {VolunteerAnswerUpsertArgs} args - Arguments to update or create a VolunteerAnswer.
     * @example
     * // Update or create a VolunteerAnswer
     * const volunteerAnswer = await prisma.volunteerAnswer.upsert({
     *   create: {
     *     // ... data to create a VolunteerAnswer
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the VolunteerAnswer we want to update
     *   }
     * })
     */
    upsert<T extends VolunteerAnswerUpsertArgs>(
      args: SelectSubset<T, VolunteerAnswerUpsertArgs<ExtArgs>>,
    ): Prisma__VolunteerAnswerClient<
      $Result.GetResult<
        Prisma.$VolunteerAnswerPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of VolunteerAnswers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerAnswerCountArgs} args - Arguments to filter VolunteerAnswers to count.
     * @example
     * // Count the number of VolunteerAnswers
     * const count = await prisma.volunteerAnswer.count({
     *   where: {
     *     // ... the filter for the VolunteerAnswers we want to count
     *   }
     * })
     **/
    count<T extends VolunteerAnswerCountArgs>(
      args?: Subset<T, VolunteerAnswerCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], VolunteerAnswerCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a VolunteerAnswer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerAnswerAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends VolunteerAnswerAggregateArgs>(
      args: Subset<T, VolunteerAnswerAggregateArgs>,
    ): Prisma.PrismaPromise<GetVolunteerAnswerAggregateType<T>>;

    /**
     * Group by VolunteerAnswer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VolunteerAnswerGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends VolunteerAnswerGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: VolunteerAnswerGroupByArgs["orderBy"] }
        : { orderBy?: VolunteerAnswerGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, VolunteerAnswerGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetVolunteerAnswerGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the VolunteerAnswer model
     */
    readonly fields: VolunteerAnswerFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for VolunteerAnswer.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__VolunteerAnswerClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    application<T extends VolunteerApplicationDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, VolunteerApplicationDefaultArgs<ExtArgs>>,
    ): Prisma__VolunteerApplicationClient<
      | $Result.GetResult<
          Prisma.$VolunteerApplicationPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the VolunteerAnswer model
   */
  interface VolunteerAnswerFieldRefs {
    readonly id: FieldRef<"VolunteerAnswer", "String">;
    readonly applicationId: FieldRef<"VolunteerAnswer", "String">;
    readonly questionId: FieldRef<"VolunteerAnswer", "String">;
    readonly answerJson: FieldRef<"VolunteerAnswer", "Json">;
  }

  // Custom InputTypes
  /**
   * VolunteerAnswer findUnique
   */
  export type VolunteerAnswerFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerInclude<ExtArgs> | null;
    /**
     * Filter, which VolunteerAnswer to fetch.
     */
    where: VolunteerAnswerWhereUniqueInput;
  };

  /**
   * VolunteerAnswer findUniqueOrThrow
   */
  export type VolunteerAnswerFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerInclude<ExtArgs> | null;
    /**
     * Filter, which VolunteerAnswer to fetch.
     */
    where: VolunteerAnswerWhereUniqueInput;
  };

  /**
   * VolunteerAnswer findFirst
   */
  export type VolunteerAnswerFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerInclude<ExtArgs> | null;
    /**
     * Filter, which VolunteerAnswer to fetch.
     */
    where?: VolunteerAnswerWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of VolunteerAnswers to fetch.
     */
    orderBy?:
      | VolunteerAnswerOrderByWithRelationInput
      | VolunteerAnswerOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for VolunteerAnswers.
     */
    cursor?: VolunteerAnswerWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` VolunteerAnswers from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` VolunteerAnswers.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of VolunteerAnswers.
     */
    distinct?:
      | VolunteerAnswerScalarFieldEnum
      | VolunteerAnswerScalarFieldEnum[];
  };

  /**
   * VolunteerAnswer findFirstOrThrow
   */
  export type VolunteerAnswerFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerInclude<ExtArgs> | null;
    /**
     * Filter, which VolunteerAnswer to fetch.
     */
    where?: VolunteerAnswerWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of VolunteerAnswers to fetch.
     */
    orderBy?:
      | VolunteerAnswerOrderByWithRelationInput
      | VolunteerAnswerOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for VolunteerAnswers.
     */
    cursor?: VolunteerAnswerWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` VolunteerAnswers from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` VolunteerAnswers.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of VolunteerAnswers.
     */
    distinct?:
      | VolunteerAnswerScalarFieldEnum
      | VolunteerAnswerScalarFieldEnum[];
  };

  /**
   * VolunteerAnswer findMany
   */
  export type VolunteerAnswerFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerInclude<ExtArgs> | null;
    /**
     * Filter, which VolunteerAnswers to fetch.
     */
    where?: VolunteerAnswerWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of VolunteerAnswers to fetch.
     */
    orderBy?:
      | VolunteerAnswerOrderByWithRelationInput
      | VolunteerAnswerOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing VolunteerAnswers.
     */
    cursor?: VolunteerAnswerWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` VolunteerAnswers from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` VolunteerAnswers.
     */
    skip?: number;
    distinct?:
      | VolunteerAnswerScalarFieldEnum
      | VolunteerAnswerScalarFieldEnum[];
  };

  /**
   * VolunteerAnswer create
   */
  export type VolunteerAnswerCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerInclude<ExtArgs> | null;
    /**
     * The data needed to create a VolunteerAnswer.
     */
    data: XOR<VolunteerAnswerCreateInput, VolunteerAnswerUncheckedCreateInput>;
  };

  /**
   * VolunteerAnswer createMany
   */
  export type VolunteerAnswerCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many VolunteerAnswers.
     */
    data: VolunteerAnswerCreateManyInput | VolunteerAnswerCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * VolunteerAnswer createManyAndReturn
   */
  export type VolunteerAnswerCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * The data used to create many VolunteerAnswers.
     */
    data: VolunteerAnswerCreateManyInput | VolunteerAnswerCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * VolunteerAnswer update
   */
  export type VolunteerAnswerUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerInclude<ExtArgs> | null;
    /**
     * The data needed to update a VolunteerAnswer.
     */
    data: XOR<VolunteerAnswerUpdateInput, VolunteerAnswerUncheckedUpdateInput>;
    /**
     * Choose, which VolunteerAnswer to update.
     */
    where: VolunteerAnswerWhereUniqueInput;
  };

  /**
   * VolunteerAnswer updateMany
   */
  export type VolunteerAnswerUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update VolunteerAnswers.
     */
    data: XOR<
      VolunteerAnswerUpdateManyMutationInput,
      VolunteerAnswerUncheckedUpdateManyInput
    >;
    /**
     * Filter which VolunteerAnswers to update
     */
    where?: VolunteerAnswerWhereInput;
    /**
     * Limit how many VolunteerAnswers to update.
     */
    limit?: number;
  };

  /**
   * VolunteerAnswer updateManyAndReturn
   */
  export type VolunteerAnswerUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * The data used to update VolunteerAnswers.
     */
    data: XOR<
      VolunteerAnswerUpdateManyMutationInput,
      VolunteerAnswerUncheckedUpdateManyInput
    >;
    /**
     * Filter which VolunteerAnswers to update
     */
    where?: VolunteerAnswerWhereInput;
    /**
     * Limit how many VolunteerAnswers to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * VolunteerAnswer upsert
   */
  export type VolunteerAnswerUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerInclude<ExtArgs> | null;
    /**
     * The filter to search for the VolunteerAnswer to update in case it exists.
     */
    where: VolunteerAnswerWhereUniqueInput;
    /**
     * In case the VolunteerAnswer found by the `where` argument doesn't exist, create a new VolunteerAnswer with this data.
     */
    create: XOR<
      VolunteerAnswerCreateInput,
      VolunteerAnswerUncheckedCreateInput
    >;
    /**
     * In case the VolunteerAnswer was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      VolunteerAnswerUpdateInput,
      VolunteerAnswerUncheckedUpdateInput
    >;
  };

  /**
   * VolunteerAnswer delete
   */
  export type VolunteerAnswerDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerInclude<ExtArgs> | null;
    /**
     * Filter which VolunteerAnswer to delete.
     */
    where: VolunteerAnswerWhereUniqueInput;
  };

  /**
   * VolunteerAnswer deleteMany
   */
  export type VolunteerAnswerDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which VolunteerAnswers to delete
     */
    where?: VolunteerAnswerWhereInput;
    /**
     * Limit how many VolunteerAnswers to delete.
     */
    limit?: number;
  };

  /**
   * VolunteerAnswer without action
   */
  export type VolunteerAnswerDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the VolunteerAnswer
     */
    select?: VolunteerAnswerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VolunteerAnswer
     */
    omit?: VolunteerAnswerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: VolunteerAnswerInclude<ExtArgs> | null;
  };

  /**
   * Model ScreenerQuestion
   */

  export type AggregateScreenerQuestion = {
    _count: ScreenerQuestionCountAggregateOutputType | null;
    _avg: ScreenerQuestionAvgAggregateOutputType | null;
    _sum: ScreenerQuestionSumAggregateOutputType | null;
    _min: ScreenerQuestionMinAggregateOutputType | null;
    _max: ScreenerQuestionMaxAggregateOutputType | null;
  };

  export type ScreenerQuestionAvgAggregateOutputType = {
    order: number | null;
  };

  export type ScreenerQuestionSumAggregateOutputType = {
    order: number | null;
  };

  export type ScreenerQuestionMinAggregateOutputType = {
    id: string | null;
    orgId: string | null;
    key: string | null;
    prompt: string | null;
    type: $Enums.ScreenerQuestionType | null;
    isActive: boolean | null;
    order: number | null;
    createdAt: Date | null;
  };

  export type ScreenerQuestionMaxAggregateOutputType = {
    id: string | null;
    orgId: string | null;
    key: string | null;
    prompt: string | null;
    type: $Enums.ScreenerQuestionType | null;
    isActive: boolean | null;
    order: number | null;
    createdAt: Date | null;
  };

  export type ScreenerQuestionCountAggregateOutputType = {
    id: number;
    orgId: number;
    key: number;
    prompt: number;
    type: number;
    configJson: number;
    isActive: number;
    order: number;
    createdAt: number;
    _all: number;
  };

  export type ScreenerQuestionAvgAggregateInputType = {
    order?: true;
  };

  export type ScreenerQuestionSumAggregateInputType = {
    order?: true;
  };

  export type ScreenerQuestionMinAggregateInputType = {
    id?: true;
    orgId?: true;
    key?: true;
    prompt?: true;
    type?: true;
    isActive?: true;
    order?: true;
    createdAt?: true;
  };

  export type ScreenerQuestionMaxAggregateInputType = {
    id?: true;
    orgId?: true;
    key?: true;
    prompt?: true;
    type?: true;
    isActive?: true;
    order?: true;
    createdAt?: true;
  };

  export type ScreenerQuestionCountAggregateInputType = {
    id?: true;
    orgId?: true;
    key?: true;
    prompt?: true;
    type?: true;
    configJson?: true;
    isActive?: true;
    order?: true;
    createdAt?: true;
    _all?: true;
  };

  export type ScreenerQuestionAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which ScreenerQuestion to aggregate.
     */
    where?: ScreenerQuestionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of ScreenerQuestions to fetch.
     */
    orderBy?:
      | ScreenerQuestionOrderByWithRelationInput
      | ScreenerQuestionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: ScreenerQuestionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` ScreenerQuestions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` ScreenerQuestions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned ScreenerQuestions
     **/
    _count?: true | ScreenerQuestionCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: ScreenerQuestionAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: ScreenerQuestionSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: ScreenerQuestionMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: ScreenerQuestionMaxAggregateInputType;
  };

  export type GetScreenerQuestionAggregateType<
    T extends ScreenerQuestionAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateScreenerQuestion]: P extends
      | "_count"
      | "count"
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateScreenerQuestion[P]>
      : GetScalarType<T[P], AggregateScreenerQuestion[P]>;
  };

  export type ScreenerQuestionGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: ScreenerQuestionWhereInput;
    orderBy?:
      | ScreenerQuestionOrderByWithAggregationInput
      | ScreenerQuestionOrderByWithAggregationInput[];
    by: ScreenerQuestionScalarFieldEnum[] | ScreenerQuestionScalarFieldEnum;
    having?: ScreenerQuestionScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: ScreenerQuestionCountAggregateInputType | true;
    _avg?: ScreenerQuestionAvgAggregateInputType;
    _sum?: ScreenerQuestionSumAggregateInputType;
    _min?: ScreenerQuestionMinAggregateInputType;
    _max?: ScreenerQuestionMaxAggregateInputType;
  };

  export type ScreenerQuestionGroupByOutputType = {
    id: string;
    orgId: string;
    key: string;
    prompt: string;
    type: $Enums.ScreenerQuestionType;
    configJson: JsonValue;
    isActive: boolean;
    order: number;
    createdAt: Date;
    _count: ScreenerQuestionCountAggregateOutputType | null;
    _avg: ScreenerQuestionAvgAggregateOutputType | null;
    _sum: ScreenerQuestionSumAggregateOutputType | null;
    _min: ScreenerQuestionMinAggregateOutputType | null;
    _max: ScreenerQuestionMaxAggregateOutputType | null;
  };

  type GetScreenerQuestionGroupByPayload<
    T extends ScreenerQuestionGroupByArgs,
  > = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ScreenerQuestionGroupByOutputType, T["by"]> & {
        [P in keyof T &
          keyof ScreenerQuestionGroupByOutputType]: P extends "_count"
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], ScreenerQuestionGroupByOutputType[P]>
          : GetScalarType<T[P], ScreenerQuestionGroupByOutputType[P]>;
      }
    >
  >;

  export type ScreenerQuestionSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      orgId?: boolean;
      key?: boolean;
      prompt?: boolean;
      type?: boolean;
      configJson?: boolean;
      isActive?: boolean;
      order?: boolean;
      createdAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["screenerQuestion"]
  >;

  export type ScreenerQuestionSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      orgId?: boolean;
      key?: boolean;
      prompt?: boolean;
      type?: boolean;
      configJson?: boolean;
      isActive?: boolean;
      order?: boolean;
      createdAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["screenerQuestion"]
  >;

  export type ScreenerQuestionSelectUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      orgId?: boolean;
      key?: boolean;
      prompt?: boolean;
      type?: boolean;
      configJson?: boolean;
      isActive?: boolean;
      order?: boolean;
      createdAt?: boolean;
      organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
    },
    ExtArgs["result"]["screenerQuestion"]
  >;

  export type ScreenerQuestionSelectScalar = {
    id?: boolean;
    orgId?: boolean;
    key?: boolean;
    prompt?: boolean;
    type?: boolean;
    configJson?: boolean;
    isActive?: boolean;
    order?: boolean;
    createdAt?: boolean;
  };

  export type ScreenerQuestionOmit<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetOmit<
    | "id"
    | "orgId"
    | "key"
    | "prompt"
    | "type"
    | "configJson"
    | "isActive"
    | "order"
    | "createdAt",
    ExtArgs["result"]["screenerQuestion"]
  >;
  export type ScreenerQuestionInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
  };
  export type ScreenerQuestionIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
  };
  export type ScreenerQuestionIncludeUpdateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>;
  };

  export type $ScreenerQuestionPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: "ScreenerQuestion";
    objects: {
      organization: Prisma.$OrganizationPayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        orgId: string;
        key: string;
        prompt: string;
        type: $Enums.ScreenerQuestionType;
        configJson: Prisma.JsonValue;
        isActive: boolean;
        order: number;
        createdAt: Date;
      },
      ExtArgs["result"]["screenerQuestion"]
    >;
    composites: {};
  };

  type ScreenerQuestionGetPayload<
    S extends boolean | null | undefined | ScreenerQuestionDefaultArgs,
  > = $Result.GetResult<Prisma.$ScreenerQuestionPayload, S>;

  type ScreenerQuestionCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<
    ScreenerQuestionFindManyArgs,
    "select" | "include" | "distinct" | "omit"
  > & {
    select?: ScreenerQuestionCountAggregateInputType | true;
  };

  export interface ScreenerQuestionDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>["model"]["ScreenerQuestion"];
      meta: { name: "ScreenerQuestion" };
    };
    /**
     * Find zero or one ScreenerQuestion that matches the filter.
     * @param {ScreenerQuestionFindUniqueArgs} args - Arguments to find a ScreenerQuestion
     * @example
     * // Get one ScreenerQuestion
     * const screenerQuestion = await prisma.screenerQuestion.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ScreenerQuestionFindUniqueArgs>(
      args: SelectSubset<T, ScreenerQuestionFindUniqueArgs<ExtArgs>>,
    ): Prisma__ScreenerQuestionClient<
      $Result.GetResult<
        Prisma.$ScreenerQuestionPayload<ExtArgs>,
        T,
        "findUnique",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one ScreenerQuestion that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ScreenerQuestionFindUniqueOrThrowArgs} args - Arguments to find a ScreenerQuestion
     * @example
     * // Get one ScreenerQuestion
     * const screenerQuestion = await prisma.screenerQuestion.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ScreenerQuestionFindUniqueOrThrowArgs>(
      args: SelectSubset<T, ScreenerQuestionFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__ScreenerQuestionClient<
      $Result.GetResult<
        Prisma.$ScreenerQuestionPayload<ExtArgs>,
        T,
        "findUniqueOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first ScreenerQuestion that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScreenerQuestionFindFirstArgs} args - Arguments to find a ScreenerQuestion
     * @example
     * // Get one ScreenerQuestion
     * const screenerQuestion = await prisma.screenerQuestion.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ScreenerQuestionFindFirstArgs>(
      args?: SelectSubset<T, ScreenerQuestionFindFirstArgs<ExtArgs>>,
    ): Prisma__ScreenerQuestionClient<
      $Result.GetResult<
        Prisma.$ScreenerQuestionPayload<ExtArgs>,
        T,
        "findFirst",
        GlobalOmitOptions
      > | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first ScreenerQuestion that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScreenerQuestionFindFirstOrThrowArgs} args - Arguments to find a ScreenerQuestion
     * @example
     * // Get one ScreenerQuestion
     * const screenerQuestion = await prisma.screenerQuestion.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ScreenerQuestionFindFirstOrThrowArgs>(
      args?: SelectSubset<T, ScreenerQuestionFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__ScreenerQuestionClient<
      $Result.GetResult<
        Prisma.$ScreenerQuestionPayload<ExtArgs>,
        T,
        "findFirstOrThrow",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more ScreenerQuestions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScreenerQuestionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ScreenerQuestions
     * const screenerQuestions = await prisma.screenerQuestion.findMany()
     *
     * // Get first 10 ScreenerQuestions
     * const screenerQuestions = await prisma.screenerQuestion.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const screenerQuestionWithIdOnly = await prisma.screenerQuestion.findMany({ select: { id: true } })
     *
     */
    findMany<T extends ScreenerQuestionFindManyArgs>(
      args?: SelectSubset<T, ScreenerQuestionFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$ScreenerQuestionPayload<ExtArgs>,
        T,
        "findMany",
        GlobalOmitOptions
      >
    >;

    /**
     * Create a ScreenerQuestion.
     * @param {ScreenerQuestionCreateArgs} args - Arguments to create a ScreenerQuestion.
     * @example
     * // Create one ScreenerQuestion
     * const ScreenerQuestion = await prisma.screenerQuestion.create({
     *   data: {
     *     // ... data to create a ScreenerQuestion
     *   }
     * })
     *
     */
    create<T extends ScreenerQuestionCreateArgs>(
      args: SelectSubset<T, ScreenerQuestionCreateArgs<ExtArgs>>,
    ): Prisma__ScreenerQuestionClient<
      $Result.GetResult<
        Prisma.$ScreenerQuestionPayload<ExtArgs>,
        T,
        "create",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Create many ScreenerQuestions.
     * @param {ScreenerQuestionCreateManyArgs} args - Arguments to create many ScreenerQuestions.
     * @example
     * // Create many ScreenerQuestions
     * const screenerQuestion = await prisma.screenerQuestion.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends ScreenerQuestionCreateManyArgs>(
      args?: SelectSubset<T, ScreenerQuestionCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many ScreenerQuestions and returns the data saved in the database.
     * @param {ScreenerQuestionCreateManyAndReturnArgs} args - Arguments to create many ScreenerQuestions.
     * @example
     * // Create many ScreenerQuestions
     * const screenerQuestion = await prisma.screenerQuestion.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many ScreenerQuestions and only return the `id`
     * const screenerQuestionWithIdOnly = await prisma.screenerQuestion.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends ScreenerQuestionCreateManyAndReturnArgs>(
      args?: SelectSubset<T, ScreenerQuestionCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$ScreenerQuestionPayload<ExtArgs>,
        T,
        "createManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Delete a ScreenerQuestion.
     * @param {ScreenerQuestionDeleteArgs} args - Arguments to delete one ScreenerQuestion.
     * @example
     * // Delete one ScreenerQuestion
     * const ScreenerQuestion = await prisma.screenerQuestion.delete({
     *   where: {
     *     // ... filter to delete one ScreenerQuestion
     *   }
     * })
     *
     */
    delete<T extends ScreenerQuestionDeleteArgs>(
      args: SelectSubset<T, ScreenerQuestionDeleteArgs<ExtArgs>>,
    ): Prisma__ScreenerQuestionClient<
      $Result.GetResult<
        Prisma.$ScreenerQuestionPayload<ExtArgs>,
        T,
        "delete",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Update one ScreenerQuestion.
     * @param {ScreenerQuestionUpdateArgs} args - Arguments to update one ScreenerQuestion.
     * @example
     * // Update one ScreenerQuestion
     * const screenerQuestion = await prisma.screenerQuestion.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends ScreenerQuestionUpdateArgs>(
      args: SelectSubset<T, ScreenerQuestionUpdateArgs<ExtArgs>>,
    ): Prisma__ScreenerQuestionClient<
      $Result.GetResult<
        Prisma.$ScreenerQuestionPayload<ExtArgs>,
        T,
        "update",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Delete zero or more ScreenerQuestions.
     * @param {ScreenerQuestionDeleteManyArgs} args - Arguments to filter ScreenerQuestions to delete.
     * @example
     * // Delete a few ScreenerQuestions
     * const { count } = await prisma.screenerQuestion.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends ScreenerQuestionDeleteManyArgs>(
      args?: SelectSubset<T, ScreenerQuestionDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more ScreenerQuestions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScreenerQuestionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ScreenerQuestions
     * const screenerQuestion = await prisma.screenerQuestion.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends ScreenerQuestionUpdateManyArgs>(
      args: SelectSubset<T, ScreenerQuestionUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more ScreenerQuestions and returns the data updated in the database.
     * @param {ScreenerQuestionUpdateManyAndReturnArgs} args - Arguments to update many ScreenerQuestions.
     * @example
     * // Update many ScreenerQuestions
     * const screenerQuestion = await prisma.screenerQuestion.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more ScreenerQuestions and only return the `id`
     * const screenerQuestionWithIdOnly = await prisma.screenerQuestion.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends ScreenerQuestionUpdateManyAndReturnArgs>(
      args: SelectSubset<T, ScreenerQuestionUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$ScreenerQuestionPayload<ExtArgs>,
        T,
        "updateManyAndReturn",
        GlobalOmitOptions
      >
    >;

    /**
     * Create or update one ScreenerQuestion.
     * @param {ScreenerQuestionUpsertArgs} args - Arguments to update or create a ScreenerQuestion.
     * @example
     * // Update or create a ScreenerQuestion
     * const screenerQuestion = await prisma.screenerQuestion.upsert({
     *   create: {
     *     // ... data to create a ScreenerQuestion
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ScreenerQuestion we want to update
     *   }
     * })
     */
    upsert<T extends ScreenerQuestionUpsertArgs>(
      args: SelectSubset<T, ScreenerQuestionUpsertArgs<ExtArgs>>,
    ): Prisma__ScreenerQuestionClient<
      $Result.GetResult<
        Prisma.$ScreenerQuestionPayload<ExtArgs>,
        T,
        "upsert",
        GlobalOmitOptions
      >,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Count the number of ScreenerQuestions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScreenerQuestionCountArgs} args - Arguments to filter ScreenerQuestions to count.
     * @example
     * // Count the number of ScreenerQuestions
     * const count = await prisma.screenerQuestion.count({
     *   where: {
     *     // ... the filter for the ScreenerQuestions we want to count
     *   }
     * })
     **/
    count<T extends ScreenerQuestionCountArgs>(
      args?: Subset<T, ScreenerQuestionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<"select", any>
        ? T["select"] extends true
          ? number
          : GetScalarType<T["select"], ScreenerQuestionCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a ScreenerQuestion.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScreenerQuestionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends ScreenerQuestionAggregateArgs>(
      args: Subset<T, ScreenerQuestionAggregateArgs>,
    ): Prisma.PrismaPromise<GetScreenerQuestionAggregateType<T>>;

    /**
     * Group by ScreenerQuestion.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScreenerQuestionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends ScreenerQuestionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<"skip", Keys<T>>,
        Extends<"take", Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ScreenerQuestionGroupByArgs["orderBy"] }
        : { orderBy?: ScreenerQuestionGroupByArgs["orderBy"] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T["orderBy"]>>
      >,
      ByFields extends MaybeTupleToUnion<T["by"]>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T["having"]>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T["by"] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      "Field ",
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : "take" extends Keys<T>
            ? "orderBy" extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : "skip" extends Keys<T>
              ? "orderBy" extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, ScreenerQuestionGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetScreenerQuestionGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the ScreenerQuestion model
     */
    readonly fields: ScreenerQuestionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ScreenerQuestion.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ScreenerQuestionClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organization<T extends OrganizationDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, OrganizationDefaultArgs<ExtArgs>>,
    ): Prisma__OrganizationClient<
      | $Result.GetResult<
          Prisma.$OrganizationPayload<ExtArgs>,
          T,
          "findUniqueOrThrow",
          GlobalOmitOptions
        >
      | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the ScreenerQuestion model
   */
  interface ScreenerQuestionFieldRefs {
    readonly id: FieldRef<"ScreenerQuestion", "String">;
    readonly orgId: FieldRef<"ScreenerQuestion", "String">;
    readonly key: FieldRef<"ScreenerQuestion", "String">;
    readonly prompt: FieldRef<"ScreenerQuestion", "String">;
    readonly type: FieldRef<"ScreenerQuestion", "ScreenerQuestionType">;
    readonly configJson: FieldRef<"ScreenerQuestion", "Json">;
    readonly isActive: FieldRef<"ScreenerQuestion", "Boolean">;
    readonly order: FieldRef<"ScreenerQuestion", "Int">;
    readonly createdAt: FieldRef<"ScreenerQuestion", "DateTime">;
  }

  // Custom InputTypes
  /**
   * ScreenerQuestion findUnique
   */
  export type ScreenerQuestionFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionInclude<ExtArgs> | null;
    /**
     * Filter, which ScreenerQuestion to fetch.
     */
    where: ScreenerQuestionWhereUniqueInput;
  };

  /**
   * ScreenerQuestion findUniqueOrThrow
   */
  export type ScreenerQuestionFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionInclude<ExtArgs> | null;
    /**
     * Filter, which ScreenerQuestion to fetch.
     */
    where: ScreenerQuestionWhereUniqueInput;
  };

  /**
   * ScreenerQuestion findFirst
   */
  export type ScreenerQuestionFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionInclude<ExtArgs> | null;
    /**
     * Filter, which ScreenerQuestion to fetch.
     */
    where?: ScreenerQuestionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of ScreenerQuestions to fetch.
     */
    orderBy?:
      | ScreenerQuestionOrderByWithRelationInput
      | ScreenerQuestionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for ScreenerQuestions.
     */
    cursor?: ScreenerQuestionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` ScreenerQuestions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` ScreenerQuestions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of ScreenerQuestions.
     */
    distinct?:
      | ScreenerQuestionScalarFieldEnum
      | ScreenerQuestionScalarFieldEnum[];
  };

  /**
   * ScreenerQuestion findFirstOrThrow
   */
  export type ScreenerQuestionFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionInclude<ExtArgs> | null;
    /**
     * Filter, which ScreenerQuestion to fetch.
     */
    where?: ScreenerQuestionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of ScreenerQuestions to fetch.
     */
    orderBy?:
      | ScreenerQuestionOrderByWithRelationInput
      | ScreenerQuestionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for ScreenerQuestions.
     */
    cursor?: ScreenerQuestionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` ScreenerQuestions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` ScreenerQuestions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of ScreenerQuestions.
     */
    distinct?:
      | ScreenerQuestionScalarFieldEnum
      | ScreenerQuestionScalarFieldEnum[];
  };

  /**
   * ScreenerQuestion findMany
   */
  export type ScreenerQuestionFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionInclude<ExtArgs> | null;
    /**
     * Filter, which ScreenerQuestions to fetch.
     */
    where?: ScreenerQuestionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of ScreenerQuestions to fetch.
     */
    orderBy?:
      | ScreenerQuestionOrderByWithRelationInput
      | ScreenerQuestionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing ScreenerQuestions.
     */
    cursor?: ScreenerQuestionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` ScreenerQuestions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` ScreenerQuestions.
     */
    skip?: number;
    distinct?:
      | ScreenerQuestionScalarFieldEnum
      | ScreenerQuestionScalarFieldEnum[];
  };

  /**
   * ScreenerQuestion create
   */
  export type ScreenerQuestionCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionInclude<ExtArgs> | null;
    /**
     * The data needed to create a ScreenerQuestion.
     */
    data: XOR<
      ScreenerQuestionCreateInput,
      ScreenerQuestionUncheckedCreateInput
    >;
  };

  /**
   * ScreenerQuestion createMany
   */
  export type ScreenerQuestionCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many ScreenerQuestions.
     */
    data: ScreenerQuestionCreateManyInput | ScreenerQuestionCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * ScreenerQuestion createManyAndReturn
   */
  export type ScreenerQuestionCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * The data used to create many ScreenerQuestions.
     */
    data: ScreenerQuestionCreateManyInput | ScreenerQuestionCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * ScreenerQuestion update
   */
  export type ScreenerQuestionUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionInclude<ExtArgs> | null;
    /**
     * The data needed to update a ScreenerQuestion.
     */
    data: XOR<
      ScreenerQuestionUpdateInput,
      ScreenerQuestionUncheckedUpdateInput
    >;
    /**
     * Choose, which ScreenerQuestion to update.
     */
    where: ScreenerQuestionWhereUniqueInput;
  };

  /**
   * ScreenerQuestion updateMany
   */
  export type ScreenerQuestionUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update ScreenerQuestions.
     */
    data: XOR<
      ScreenerQuestionUpdateManyMutationInput,
      ScreenerQuestionUncheckedUpdateManyInput
    >;
    /**
     * Filter which ScreenerQuestions to update
     */
    where?: ScreenerQuestionWhereInput;
    /**
     * Limit how many ScreenerQuestions to update.
     */
    limit?: number;
  };

  /**
   * ScreenerQuestion updateManyAndReturn
   */
  export type ScreenerQuestionUpdateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * The data used to update ScreenerQuestions.
     */
    data: XOR<
      ScreenerQuestionUpdateManyMutationInput,
      ScreenerQuestionUncheckedUpdateManyInput
    >;
    /**
     * Filter which ScreenerQuestions to update
     */
    where?: ScreenerQuestionWhereInput;
    /**
     * Limit how many ScreenerQuestions to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * ScreenerQuestion upsert
   */
  export type ScreenerQuestionUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionInclude<ExtArgs> | null;
    /**
     * The filter to search for the ScreenerQuestion to update in case it exists.
     */
    where: ScreenerQuestionWhereUniqueInput;
    /**
     * In case the ScreenerQuestion found by the `where` argument doesn't exist, create a new ScreenerQuestion with this data.
     */
    create: XOR<
      ScreenerQuestionCreateInput,
      ScreenerQuestionUncheckedCreateInput
    >;
    /**
     * In case the ScreenerQuestion was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      ScreenerQuestionUpdateInput,
      ScreenerQuestionUncheckedUpdateInput
    >;
  };

  /**
   * ScreenerQuestion delete
   */
  export type ScreenerQuestionDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionInclude<ExtArgs> | null;
    /**
     * Filter which ScreenerQuestion to delete.
     */
    where: ScreenerQuestionWhereUniqueInput;
  };

  /**
   * ScreenerQuestion deleteMany
   */
  export type ScreenerQuestionDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which ScreenerQuestions to delete
     */
    where?: ScreenerQuestionWhereInput;
    /**
     * Limit how many ScreenerQuestions to delete.
     */
    limit?: number;
  };

  /**
   * ScreenerQuestion without action
   */
  export type ScreenerQuestionDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the ScreenerQuestion
     */
    select?: ScreenerQuestionSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ScreenerQuestion
     */
    omit?: ScreenerQuestionOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScreenerQuestionInclude<ExtArgs> | null;
  };

  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: "ReadUncommitted";
    ReadCommitted: "ReadCommitted";
    RepeatableRead: "RepeatableRead";
    Serializable: "Serializable";
  };

  export type TransactionIsolationLevel =
    (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];

  export const UserScalarFieldEnum: {
    id: "id";
    name: "name";
    email: "email";
    emailVerified: "emailVerified";
    image: "image";
    createdAt: "createdAt";
    updatedAt: "updatedAt";
  };

  export type UserScalarFieldEnum =
    (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum];

  export const AccountScalarFieldEnum: {
    id: "id";
    userId: "userId";
    type: "type";
    provider: "provider";
    providerAccountId: "providerAccountId";
    refresh_token: "refresh_token";
    access_token: "access_token";
    expires_at: "expires_at";
    token_type: "token_type";
    scope: "scope";
    id_token: "id_token";
    session_state: "session_state";
  };

  export type AccountScalarFieldEnum =
    (typeof AccountScalarFieldEnum)[keyof typeof AccountScalarFieldEnum];

  export const SessionScalarFieldEnum: {
    id: "id";
    sessionToken: "sessionToken";
    userId: "userId";
    expires: "expires";
    currentOrgId: "currentOrgId";
    createdAt: "createdAt";
    updatedAt: "updatedAt";
  };

  export type SessionScalarFieldEnum =
    (typeof SessionScalarFieldEnum)[keyof typeof SessionScalarFieldEnum];

  export const VerificationTokenScalarFieldEnum: {
    identifier: "identifier";
    token: "token";
    expires: "expires";
  };

  export type VerificationTokenScalarFieldEnum =
    (typeof VerificationTokenScalarFieldEnum)[keyof typeof VerificationTokenScalarFieldEnum];

  export const OrganizationScalarFieldEnum: {
    id: "id";
    name: "name";
    createdAt: "createdAt";
    updatedAt: "updatedAt";
  };

  export type OrganizationScalarFieldEnum =
    (typeof OrganizationScalarFieldEnum)[keyof typeof OrganizationScalarFieldEnum];

  export const OrganizationMemberScalarFieldEnum: {
    id: "id";
    organizationId: "organizationId";
    userId: "userId";
    role: "role";
    createdAt: "createdAt";
  };

  export type OrganizationMemberScalarFieldEnum =
    (typeof OrganizationMemberScalarFieldEnum)[keyof typeof OrganizationMemberScalarFieldEnum];

  export const AuditLogScalarFieldEnum: {
    id: "id";
    actorId: "actorId";
    orgId: "orgId";
    action: "action";
    entityType: "entityType";
    entityId: "entityId";
    metadata: "metadata";
    createdAt: "createdAt";
  };

  export type AuditLogScalarFieldEnum =
    (typeof AuditLogScalarFieldEnum)[keyof typeof AuditLogScalarFieldEnum];

  export const FeatureFlagScalarFieldEnum: {
    id: "id";
    orgId: "orgId";
    key: "key";
    enabled: "enabled";
    createdAt: "createdAt";
  };

  export type FeatureFlagScalarFieldEnum =
    (typeof FeatureFlagScalarFieldEnum)[keyof typeof FeatureFlagScalarFieldEnum];

  export const VolunteerApplicationScalarFieldEnum: {
    id: "id";
    orgId: "orgId";
    submittedByEmail: "submittedByEmail";
    status: "status";
    screeningStatus: "screeningStatus";
    screeningReasons: "screeningReasons";
    submittedAt: "submittedAt";
  };

  export type VolunteerApplicationScalarFieldEnum =
    (typeof VolunteerApplicationScalarFieldEnum)[keyof typeof VolunteerApplicationScalarFieldEnum];

  export const VolunteerAnswerScalarFieldEnum: {
    id: "id";
    applicationId: "applicationId";
    questionId: "questionId";
    answerJson: "answerJson";
  };

  export type VolunteerAnswerScalarFieldEnum =
    (typeof VolunteerAnswerScalarFieldEnum)[keyof typeof VolunteerAnswerScalarFieldEnum];

  export const ScreenerQuestionScalarFieldEnum: {
    id: "id";
    orgId: "orgId";
    key: "key";
    prompt: "prompt";
    type: "type";
    configJson: "configJson";
    isActive: "isActive";
    order: "order";
    createdAt: "createdAt";
  };

  export type ScreenerQuestionScalarFieldEnum =
    (typeof ScreenerQuestionScalarFieldEnum)[keyof typeof ScreenerQuestionScalarFieldEnum];

  export const SortOrder: {
    asc: "asc";
    desc: "desc";
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull;
    JsonNull: typeof JsonNull;
  };

  export type NullableJsonNullValueInput =
    (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput];

  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull;
  };

  export type JsonNullValueInput =
    (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput];

  export const QueryMode: {
    default: "default";
    insensitive: "insensitive";
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];

  export const NullsOrder: {
    first: "first";
    last: "last";
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];

  export const JsonNullValueFilter: {
    DbNull: typeof DbNull;
    JsonNull: typeof JsonNull;
    AnyNull: typeof AnyNull;
  };

  export type JsonNullValueFilter =
    (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter];

  /**
   * Field references
   */

  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "String"
  >;

  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "String[]"
  >;

  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "DateTime"
  >;

  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "DateTime[]"
  >;

  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Int"
  >;

  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Int[]"
  >;

  /**
   * Reference to a field of type 'Role'
   */
  export type EnumRoleFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Role"
  >;

  /**
   * Reference to a field of type 'Role[]'
   */
  export type ListEnumRoleFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Role[]"
  >;

  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Json"
  >;

  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "QueryMode"
  >;

  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Boolean"
  >;

  /**
   * Reference to a field of type 'ApplicationStatus'
   */
  export type EnumApplicationStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "ApplicationStatus">;

  /**
   * Reference to a field of type 'ApplicationStatus[]'
   */
  export type ListEnumApplicationStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "ApplicationStatus[]">;

  /**
   * Reference to a field of type 'ScreeningStatus'
   */
  export type EnumScreeningStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "ScreeningStatus">;

  /**
   * Reference to a field of type 'ScreeningStatus[]'
   */
  export type ListEnumScreeningStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "ScreeningStatus[]">;

  /**
   * Reference to a field of type 'ScreenerQuestionType'
   */
  export type EnumScreenerQuestionTypeFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "ScreenerQuestionType">;

  /**
   * Reference to a field of type 'ScreenerQuestionType[]'
   */
  export type ListEnumScreenerQuestionTypeFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, "ScreenerQuestionType[]">;

  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Float"
  >;

  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    "Float[]"
  >;

  /**
   * Deep Input Types
   */

  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[];
    OR?: UserWhereInput[];
    NOT?: UserWhereInput | UserWhereInput[];
    id?: StringFilter<"User"> | string;
    name?: StringNullableFilter<"User"> | string | null;
    email?: StringNullableFilter<"User"> | string | null;
    emailVerified?: DateTimeNullableFilter<"User"> | Date | string | null;
    image?: StringNullableFilter<"User"> | string | null;
    createdAt?: DateTimeFilter<"User"> | Date | string;
    updatedAt?: DateTimeFilter<"User"> | Date | string;
    accounts?: AccountListRelationFilter;
    sessions?: SessionListRelationFilter;
    memberships?: OrganizationMemberListRelationFilter;
    auditLogs?: AuditLogListRelationFilter;
  };

  export type UserOrderByWithRelationInput = {
    id?: SortOrder;
    name?: SortOrderInput | SortOrder;
    email?: SortOrderInput | SortOrder;
    emailVerified?: SortOrderInput | SortOrder;
    image?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    accounts?: AccountOrderByRelationAggregateInput;
    sessions?: SessionOrderByRelationAggregateInput;
    memberships?: OrganizationMemberOrderByRelationAggregateInput;
    auditLogs?: AuditLogOrderByRelationAggregateInput;
  };

  export type UserWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      email?: string;
      AND?: UserWhereInput | UserWhereInput[];
      OR?: UserWhereInput[];
      NOT?: UserWhereInput | UserWhereInput[];
      name?: StringNullableFilter<"User"> | string | null;
      emailVerified?: DateTimeNullableFilter<"User"> | Date | string | null;
      image?: StringNullableFilter<"User"> | string | null;
      createdAt?: DateTimeFilter<"User"> | Date | string;
      updatedAt?: DateTimeFilter<"User"> | Date | string;
      accounts?: AccountListRelationFilter;
      sessions?: SessionListRelationFilter;
      memberships?: OrganizationMemberListRelationFilter;
      auditLogs?: AuditLogListRelationFilter;
    },
    "id" | "email"
  >;

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder;
    name?: SortOrderInput | SortOrder;
    email?: SortOrderInput | SortOrder;
    emailVerified?: SortOrderInput | SortOrder;
    image?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    _count?: UserCountOrderByAggregateInput;
    _max?: UserMaxOrderByAggregateInput;
    _min?: UserMinOrderByAggregateInput;
  };

  export type UserScalarWhereWithAggregatesInput = {
    AND?:
      | UserScalarWhereWithAggregatesInput
      | UserScalarWhereWithAggregatesInput[];
    OR?: UserScalarWhereWithAggregatesInput[];
    NOT?:
      | UserScalarWhereWithAggregatesInput
      | UserScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"User"> | string;
    name?: StringNullableWithAggregatesFilter<"User"> | string | null;
    email?: StringNullableWithAggregatesFilter<"User"> | string | null;
    emailVerified?:
      | DateTimeNullableWithAggregatesFilter<"User">
      | Date
      | string
      | null;
    image?: StringNullableWithAggregatesFilter<"User"> | string | null;
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string;
  };

  export type AccountWhereInput = {
    AND?: AccountWhereInput | AccountWhereInput[];
    OR?: AccountWhereInput[];
    NOT?: AccountWhereInput | AccountWhereInput[];
    id?: StringFilter<"Account"> | string;
    userId?: StringFilter<"Account"> | string;
    type?: StringFilter<"Account"> | string;
    provider?: StringFilter<"Account"> | string;
    providerAccountId?: StringFilter<"Account"> | string;
    refresh_token?: StringNullableFilter<"Account"> | string | null;
    access_token?: StringNullableFilter<"Account"> | string | null;
    expires_at?: IntNullableFilter<"Account"> | number | null;
    token_type?: StringNullableFilter<"Account"> | string | null;
    scope?: StringNullableFilter<"Account"> | string | null;
    id_token?: StringNullableFilter<"Account"> | string | null;
    session_state?: StringNullableFilter<"Account"> | string | null;
    user?: XOR<UserScalarRelationFilter, UserWhereInput>;
  };

  export type AccountOrderByWithRelationInput = {
    id?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    provider?: SortOrder;
    providerAccountId?: SortOrder;
    refresh_token?: SortOrderInput | SortOrder;
    access_token?: SortOrderInput | SortOrder;
    expires_at?: SortOrderInput | SortOrder;
    token_type?: SortOrderInput | SortOrder;
    scope?: SortOrderInput | SortOrder;
    id_token?: SortOrderInput | SortOrder;
    session_state?: SortOrderInput | SortOrder;
    user?: UserOrderByWithRelationInput;
  };

  export type AccountWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      provider_providerAccountId?: AccountProviderProviderAccountIdCompoundUniqueInput;
      AND?: AccountWhereInput | AccountWhereInput[];
      OR?: AccountWhereInput[];
      NOT?: AccountWhereInput | AccountWhereInput[];
      userId?: StringFilter<"Account"> | string;
      type?: StringFilter<"Account"> | string;
      provider?: StringFilter<"Account"> | string;
      providerAccountId?: StringFilter<"Account"> | string;
      refresh_token?: StringNullableFilter<"Account"> | string | null;
      access_token?: StringNullableFilter<"Account"> | string | null;
      expires_at?: IntNullableFilter<"Account"> | number | null;
      token_type?: StringNullableFilter<"Account"> | string | null;
      scope?: StringNullableFilter<"Account"> | string | null;
      id_token?: StringNullableFilter<"Account"> | string | null;
      session_state?: StringNullableFilter<"Account"> | string | null;
      user?: XOR<UserScalarRelationFilter, UserWhereInput>;
    },
    "id" | "provider_providerAccountId"
  >;

  export type AccountOrderByWithAggregationInput = {
    id?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    provider?: SortOrder;
    providerAccountId?: SortOrder;
    refresh_token?: SortOrderInput | SortOrder;
    access_token?: SortOrderInput | SortOrder;
    expires_at?: SortOrderInput | SortOrder;
    token_type?: SortOrderInput | SortOrder;
    scope?: SortOrderInput | SortOrder;
    id_token?: SortOrderInput | SortOrder;
    session_state?: SortOrderInput | SortOrder;
    _count?: AccountCountOrderByAggregateInput;
    _avg?: AccountAvgOrderByAggregateInput;
    _max?: AccountMaxOrderByAggregateInput;
    _min?: AccountMinOrderByAggregateInput;
    _sum?: AccountSumOrderByAggregateInput;
  };

  export type AccountScalarWhereWithAggregatesInput = {
    AND?:
      | AccountScalarWhereWithAggregatesInput
      | AccountScalarWhereWithAggregatesInput[];
    OR?: AccountScalarWhereWithAggregatesInput[];
    NOT?:
      | AccountScalarWhereWithAggregatesInput
      | AccountScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"Account"> | string;
    userId?: StringWithAggregatesFilter<"Account"> | string;
    type?: StringWithAggregatesFilter<"Account"> | string;
    provider?: StringWithAggregatesFilter<"Account"> | string;
    providerAccountId?: StringWithAggregatesFilter<"Account"> | string;
    refresh_token?:
      | StringNullableWithAggregatesFilter<"Account">
      | string
      | null;
    access_token?:
      | StringNullableWithAggregatesFilter<"Account">
      | string
      | null;
    expires_at?: IntNullableWithAggregatesFilter<"Account"> | number | null;
    token_type?: StringNullableWithAggregatesFilter<"Account"> | string | null;
    scope?: StringNullableWithAggregatesFilter<"Account"> | string | null;
    id_token?: StringNullableWithAggregatesFilter<"Account"> | string | null;
    session_state?:
      | StringNullableWithAggregatesFilter<"Account">
      | string
      | null;
  };

  export type SessionWhereInput = {
    AND?: SessionWhereInput | SessionWhereInput[];
    OR?: SessionWhereInput[];
    NOT?: SessionWhereInput | SessionWhereInput[];
    id?: StringFilter<"Session"> | string;
    sessionToken?: StringFilter<"Session"> | string;
    userId?: StringFilter<"Session"> | string;
    expires?: DateTimeFilter<"Session"> | Date | string;
    currentOrgId?: StringNullableFilter<"Session"> | string | null;
    createdAt?: DateTimeFilter<"Session"> | Date | string;
    updatedAt?: DateTimeFilter<"Session"> | Date | string;
    user?: XOR<UserScalarRelationFilter, UserWhereInput>;
    currentOrg?: XOR<
      OrganizationNullableScalarRelationFilter,
      OrganizationWhereInput
    > | null;
  };

  export type SessionOrderByWithRelationInput = {
    id?: SortOrder;
    sessionToken?: SortOrder;
    userId?: SortOrder;
    expires?: SortOrder;
    currentOrgId?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    user?: UserOrderByWithRelationInput;
    currentOrg?: OrganizationOrderByWithRelationInput;
  };

  export type SessionWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      sessionToken?: string;
      AND?: SessionWhereInput | SessionWhereInput[];
      OR?: SessionWhereInput[];
      NOT?: SessionWhereInput | SessionWhereInput[];
      userId?: StringFilter<"Session"> | string;
      expires?: DateTimeFilter<"Session"> | Date | string;
      currentOrgId?: StringNullableFilter<"Session"> | string | null;
      createdAt?: DateTimeFilter<"Session"> | Date | string;
      updatedAt?: DateTimeFilter<"Session"> | Date | string;
      user?: XOR<UserScalarRelationFilter, UserWhereInput>;
      currentOrg?: XOR<
        OrganizationNullableScalarRelationFilter,
        OrganizationWhereInput
      > | null;
    },
    "id" | "sessionToken"
  >;

  export type SessionOrderByWithAggregationInput = {
    id?: SortOrder;
    sessionToken?: SortOrder;
    userId?: SortOrder;
    expires?: SortOrder;
    currentOrgId?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    _count?: SessionCountOrderByAggregateInput;
    _max?: SessionMaxOrderByAggregateInput;
    _min?: SessionMinOrderByAggregateInput;
  };

  export type SessionScalarWhereWithAggregatesInput = {
    AND?:
      | SessionScalarWhereWithAggregatesInput
      | SessionScalarWhereWithAggregatesInput[];
    OR?: SessionScalarWhereWithAggregatesInput[];
    NOT?:
      | SessionScalarWhereWithAggregatesInput
      | SessionScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"Session"> | string;
    sessionToken?: StringWithAggregatesFilter<"Session"> | string;
    userId?: StringWithAggregatesFilter<"Session"> | string;
    expires?: DateTimeWithAggregatesFilter<"Session"> | Date | string;
    currentOrgId?:
      | StringNullableWithAggregatesFilter<"Session">
      | string
      | null;
    createdAt?: DateTimeWithAggregatesFilter<"Session"> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<"Session"> | Date | string;
  };

  export type VerificationTokenWhereInput = {
    AND?: VerificationTokenWhereInput | VerificationTokenWhereInput[];
    OR?: VerificationTokenWhereInput[];
    NOT?: VerificationTokenWhereInput | VerificationTokenWhereInput[];
    identifier?: StringFilter<"VerificationToken"> | string;
    token?: StringFilter<"VerificationToken"> | string;
    expires?: DateTimeFilter<"VerificationToken"> | Date | string;
  };

  export type VerificationTokenOrderByWithRelationInput = {
    identifier?: SortOrder;
    token?: SortOrder;
    expires?: SortOrder;
  };

  export type VerificationTokenWhereUniqueInput = Prisma.AtLeast<
    {
      token?: string;
      identifier_token?: VerificationTokenIdentifierTokenCompoundUniqueInput;
      AND?: VerificationTokenWhereInput | VerificationTokenWhereInput[];
      OR?: VerificationTokenWhereInput[];
      NOT?: VerificationTokenWhereInput | VerificationTokenWhereInput[];
      identifier?: StringFilter<"VerificationToken"> | string;
      expires?: DateTimeFilter<"VerificationToken"> | Date | string;
    },
    "token" | "identifier_token"
  >;

  export type VerificationTokenOrderByWithAggregationInput = {
    identifier?: SortOrder;
    token?: SortOrder;
    expires?: SortOrder;
    _count?: VerificationTokenCountOrderByAggregateInput;
    _max?: VerificationTokenMaxOrderByAggregateInput;
    _min?: VerificationTokenMinOrderByAggregateInput;
  };

  export type VerificationTokenScalarWhereWithAggregatesInput = {
    AND?:
      | VerificationTokenScalarWhereWithAggregatesInput
      | VerificationTokenScalarWhereWithAggregatesInput[];
    OR?: VerificationTokenScalarWhereWithAggregatesInput[];
    NOT?:
      | VerificationTokenScalarWhereWithAggregatesInput
      | VerificationTokenScalarWhereWithAggregatesInput[];
    identifier?: StringWithAggregatesFilter<"VerificationToken"> | string;
    token?: StringWithAggregatesFilter<"VerificationToken"> | string;
    expires?: DateTimeWithAggregatesFilter<"VerificationToken"> | Date | string;
  };

  export type OrganizationWhereInput = {
    AND?: OrganizationWhereInput | OrganizationWhereInput[];
    OR?: OrganizationWhereInput[];
    NOT?: OrganizationWhereInput | OrganizationWhereInput[];
    id?: StringFilter<"Organization"> | string;
    name?: StringFilter<"Organization"> | string;
    createdAt?: DateTimeFilter<"Organization"> | Date | string;
    updatedAt?: DateTimeFilter<"Organization"> | Date | string;
    members?: OrganizationMemberListRelationFilter;
    auditLogs?: AuditLogListRelationFilter;
    featureFlags?: FeatureFlagListRelationFilter;
    applications?: VolunteerApplicationListRelationFilter;
    screenerQuestions?: ScreenerQuestionListRelationFilter;
    sessions?: SessionListRelationFilter;
  };

  export type OrganizationOrderByWithRelationInput = {
    id?: SortOrder;
    name?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    members?: OrganizationMemberOrderByRelationAggregateInput;
    auditLogs?: AuditLogOrderByRelationAggregateInput;
    featureFlags?: FeatureFlagOrderByRelationAggregateInput;
    applications?: VolunteerApplicationOrderByRelationAggregateInput;
    screenerQuestions?: ScreenerQuestionOrderByRelationAggregateInput;
    sessions?: SessionOrderByRelationAggregateInput;
  };

  export type OrganizationWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      AND?: OrganizationWhereInput | OrganizationWhereInput[];
      OR?: OrganizationWhereInput[];
      NOT?: OrganizationWhereInput | OrganizationWhereInput[];
      name?: StringFilter<"Organization"> | string;
      createdAt?: DateTimeFilter<"Organization"> | Date | string;
      updatedAt?: DateTimeFilter<"Organization"> | Date | string;
      members?: OrganizationMemberListRelationFilter;
      auditLogs?: AuditLogListRelationFilter;
      featureFlags?: FeatureFlagListRelationFilter;
      applications?: VolunteerApplicationListRelationFilter;
      screenerQuestions?: ScreenerQuestionListRelationFilter;
      sessions?: SessionListRelationFilter;
    },
    "id"
  >;

  export type OrganizationOrderByWithAggregationInput = {
    id?: SortOrder;
    name?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    _count?: OrganizationCountOrderByAggregateInput;
    _max?: OrganizationMaxOrderByAggregateInput;
    _min?: OrganizationMinOrderByAggregateInput;
  };

  export type OrganizationScalarWhereWithAggregatesInput = {
    AND?:
      | OrganizationScalarWhereWithAggregatesInput
      | OrganizationScalarWhereWithAggregatesInput[];
    OR?: OrganizationScalarWhereWithAggregatesInput[];
    NOT?:
      | OrganizationScalarWhereWithAggregatesInput
      | OrganizationScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"Organization"> | string;
    name?: StringWithAggregatesFilter<"Organization"> | string;
    createdAt?: DateTimeWithAggregatesFilter<"Organization"> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<"Organization"> | Date | string;
  };

  export type OrganizationMemberWhereInput = {
    AND?: OrganizationMemberWhereInput | OrganizationMemberWhereInput[];
    OR?: OrganizationMemberWhereInput[];
    NOT?: OrganizationMemberWhereInput | OrganizationMemberWhereInput[];
    id?: StringFilter<"OrganizationMember"> | string;
    organizationId?: StringFilter<"OrganizationMember"> | string;
    userId?: StringFilter<"OrganizationMember"> | string;
    role?: EnumRoleFilter<"OrganizationMember"> | $Enums.Role;
    createdAt?: DateTimeFilter<"OrganizationMember"> | Date | string;
    organization?: XOR<
      OrganizationScalarRelationFilter,
      OrganizationWhereInput
    >;
    user?: XOR<UserScalarRelationFilter, UserWhereInput>;
  };

  export type OrganizationMemberOrderByWithRelationInput = {
    id?: SortOrder;
    organizationId?: SortOrder;
    userId?: SortOrder;
    role?: SortOrder;
    createdAt?: SortOrder;
    organization?: OrganizationOrderByWithRelationInput;
    user?: UserOrderByWithRelationInput;
  };

  export type OrganizationMemberWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      organizationId_userId?: OrganizationMemberOrganizationIdUserIdCompoundUniqueInput;
      AND?: OrganizationMemberWhereInput | OrganizationMemberWhereInput[];
      OR?: OrganizationMemberWhereInput[];
      NOT?: OrganizationMemberWhereInput | OrganizationMemberWhereInput[];
      organizationId?: StringFilter<"OrganizationMember"> | string;
      userId?: StringFilter<"OrganizationMember"> | string;
      role?: EnumRoleFilter<"OrganizationMember"> | $Enums.Role;
      createdAt?: DateTimeFilter<"OrganizationMember"> | Date | string;
      organization?: XOR<
        OrganizationScalarRelationFilter,
        OrganizationWhereInput
      >;
      user?: XOR<UserScalarRelationFilter, UserWhereInput>;
    },
    "id" | "organizationId_userId"
  >;

  export type OrganizationMemberOrderByWithAggregationInput = {
    id?: SortOrder;
    organizationId?: SortOrder;
    userId?: SortOrder;
    role?: SortOrder;
    createdAt?: SortOrder;
    _count?: OrganizationMemberCountOrderByAggregateInput;
    _max?: OrganizationMemberMaxOrderByAggregateInput;
    _min?: OrganizationMemberMinOrderByAggregateInput;
  };

  export type OrganizationMemberScalarWhereWithAggregatesInput = {
    AND?:
      | OrganizationMemberScalarWhereWithAggregatesInput
      | OrganizationMemberScalarWhereWithAggregatesInput[];
    OR?: OrganizationMemberScalarWhereWithAggregatesInput[];
    NOT?:
      | OrganizationMemberScalarWhereWithAggregatesInput
      | OrganizationMemberScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"OrganizationMember"> | string;
    organizationId?: StringWithAggregatesFilter<"OrganizationMember"> | string;
    userId?: StringWithAggregatesFilter<"OrganizationMember"> | string;
    role?: EnumRoleWithAggregatesFilter<"OrganizationMember"> | $Enums.Role;
    createdAt?:
      | DateTimeWithAggregatesFilter<"OrganizationMember">
      | Date
      | string;
  };

  export type AuditLogWhereInput = {
    AND?: AuditLogWhereInput | AuditLogWhereInput[];
    OR?: AuditLogWhereInput[];
    NOT?: AuditLogWhereInput | AuditLogWhereInput[];
    id?: StringFilter<"AuditLog"> | string;
    actorId?: StringNullableFilter<"AuditLog"> | string | null;
    orgId?: StringFilter<"AuditLog"> | string;
    action?: StringFilter<"AuditLog"> | string;
    entityType?: StringFilter<"AuditLog"> | string;
    entityId?: StringNullableFilter<"AuditLog"> | string | null;
    metadata?: JsonNullableFilter<"AuditLog">;
    createdAt?: DateTimeFilter<"AuditLog"> | Date | string;
    organization?: XOR<
      OrganizationScalarRelationFilter,
      OrganizationWhereInput
    >;
    actor?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null;
  };

  export type AuditLogOrderByWithRelationInput = {
    id?: SortOrder;
    actorId?: SortOrderInput | SortOrder;
    orgId?: SortOrder;
    action?: SortOrder;
    entityType?: SortOrder;
    entityId?: SortOrderInput | SortOrder;
    metadata?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    organization?: OrganizationOrderByWithRelationInput;
    actor?: UserOrderByWithRelationInput;
  };

  export type AuditLogWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      AND?: AuditLogWhereInput | AuditLogWhereInput[];
      OR?: AuditLogWhereInput[];
      NOT?: AuditLogWhereInput | AuditLogWhereInput[];
      actorId?: StringNullableFilter<"AuditLog"> | string | null;
      orgId?: StringFilter<"AuditLog"> | string;
      action?: StringFilter<"AuditLog"> | string;
      entityType?: StringFilter<"AuditLog"> | string;
      entityId?: StringNullableFilter<"AuditLog"> | string | null;
      metadata?: JsonNullableFilter<"AuditLog">;
      createdAt?: DateTimeFilter<"AuditLog"> | Date | string;
      organization?: XOR<
        OrganizationScalarRelationFilter,
        OrganizationWhereInput
      >;
      actor?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null;
    },
    "id"
  >;

  export type AuditLogOrderByWithAggregationInput = {
    id?: SortOrder;
    actorId?: SortOrderInput | SortOrder;
    orgId?: SortOrder;
    action?: SortOrder;
    entityType?: SortOrder;
    entityId?: SortOrderInput | SortOrder;
    metadata?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    _count?: AuditLogCountOrderByAggregateInput;
    _max?: AuditLogMaxOrderByAggregateInput;
    _min?: AuditLogMinOrderByAggregateInput;
  };

  export type AuditLogScalarWhereWithAggregatesInput = {
    AND?:
      | AuditLogScalarWhereWithAggregatesInput
      | AuditLogScalarWhereWithAggregatesInput[];
    OR?: AuditLogScalarWhereWithAggregatesInput[];
    NOT?:
      | AuditLogScalarWhereWithAggregatesInput
      | AuditLogScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"AuditLog"> | string;
    actorId?: StringNullableWithAggregatesFilter<"AuditLog"> | string | null;
    orgId?: StringWithAggregatesFilter<"AuditLog"> | string;
    action?: StringWithAggregatesFilter<"AuditLog"> | string;
    entityType?: StringWithAggregatesFilter<"AuditLog"> | string;
    entityId?: StringNullableWithAggregatesFilter<"AuditLog"> | string | null;
    metadata?: JsonNullableWithAggregatesFilter<"AuditLog">;
    createdAt?: DateTimeWithAggregatesFilter<"AuditLog"> | Date | string;
  };

  export type FeatureFlagWhereInput = {
    AND?: FeatureFlagWhereInput | FeatureFlagWhereInput[];
    OR?: FeatureFlagWhereInput[];
    NOT?: FeatureFlagWhereInput | FeatureFlagWhereInput[];
    id?: StringFilter<"FeatureFlag"> | string;
    orgId?: StringFilter<"FeatureFlag"> | string;
    key?: StringFilter<"FeatureFlag"> | string;
    enabled?: BoolFilter<"FeatureFlag"> | boolean;
    createdAt?: DateTimeFilter<"FeatureFlag"> | Date | string;
    organization?: XOR<
      OrganizationScalarRelationFilter,
      OrganizationWhereInput
    >;
  };

  export type FeatureFlagOrderByWithRelationInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    key?: SortOrder;
    enabled?: SortOrder;
    createdAt?: SortOrder;
    organization?: OrganizationOrderByWithRelationInput;
  };

  export type FeatureFlagWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      orgId_key?: FeatureFlagOrgIdKeyCompoundUniqueInput;
      AND?: FeatureFlagWhereInput | FeatureFlagWhereInput[];
      OR?: FeatureFlagWhereInput[];
      NOT?: FeatureFlagWhereInput | FeatureFlagWhereInput[];
      orgId?: StringFilter<"FeatureFlag"> | string;
      key?: StringFilter<"FeatureFlag"> | string;
      enabled?: BoolFilter<"FeatureFlag"> | boolean;
      createdAt?: DateTimeFilter<"FeatureFlag"> | Date | string;
      organization?: XOR<
        OrganizationScalarRelationFilter,
        OrganizationWhereInput
      >;
    },
    "id" | "orgId_key"
  >;

  export type FeatureFlagOrderByWithAggregationInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    key?: SortOrder;
    enabled?: SortOrder;
    createdAt?: SortOrder;
    _count?: FeatureFlagCountOrderByAggregateInput;
    _max?: FeatureFlagMaxOrderByAggregateInput;
    _min?: FeatureFlagMinOrderByAggregateInput;
  };

  export type FeatureFlagScalarWhereWithAggregatesInput = {
    AND?:
      | FeatureFlagScalarWhereWithAggregatesInput
      | FeatureFlagScalarWhereWithAggregatesInput[];
    OR?: FeatureFlagScalarWhereWithAggregatesInput[];
    NOT?:
      | FeatureFlagScalarWhereWithAggregatesInput
      | FeatureFlagScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"FeatureFlag"> | string;
    orgId?: StringWithAggregatesFilter<"FeatureFlag"> | string;
    key?: StringWithAggregatesFilter<"FeatureFlag"> | string;
    enabled?: BoolWithAggregatesFilter<"FeatureFlag"> | boolean;
    createdAt?: DateTimeWithAggregatesFilter<"FeatureFlag"> | Date | string;
  };

  export type VolunteerApplicationWhereInput = {
    AND?: VolunteerApplicationWhereInput | VolunteerApplicationWhereInput[];
    OR?: VolunteerApplicationWhereInput[];
    NOT?: VolunteerApplicationWhereInput | VolunteerApplicationWhereInput[];
    id?: StringFilter<"VolunteerApplication"> | string;
    orgId?: StringFilter<"VolunteerApplication"> | string;
    submittedByEmail?: StringFilter<"VolunteerApplication"> | string;
    status?:
      | EnumApplicationStatusFilter<"VolunteerApplication">
      | $Enums.ApplicationStatus;
    screeningStatus?:
      | EnumScreeningStatusFilter<"VolunteerApplication">
      | $Enums.ScreeningStatus;
    screeningReasons?: JsonFilter<"VolunteerApplication">;
    submittedAt?: DateTimeFilter<"VolunteerApplication"> | Date | string;
    organization?: XOR<
      OrganizationScalarRelationFilter,
      OrganizationWhereInput
    >;
    answers?: VolunteerAnswerListRelationFilter;
  };

  export type VolunteerApplicationOrderByWithRelationInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    submittedByEmail?: SortOrder;
    status?: SortOrder;
    screeningStatus?: SortOrder;
    screeningReasons?: SortOrder;
    submittedAt?: SortOrder;
    organization?: OrganizationOrderByWithRelationInput;
    answers?: VolunteerAnswerOrderByRelationAggregateInput;
  };

  export type VolunteerApplicationWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      AND?: VolunteerApplicationWhereInput | VolunteerApplicationWhereInput[];
      OR?: VolunteerApplicationWhereInput[];
      NOT?: VolunteerApplicationWhereInput | VolunteerApplicationWhereInput[];
      orgId?: StringFilter<"VolunteerApplication"> | string;
      submittedByEmail?: StringFilter<"VolunteerApplication"> | string;
      status?:
        | EnumApplicationStatusFilter<"VolunteerApplication">
        | $Enums.ApplicationStatus;
      screeningStatus?:
        | EnumScreeningStatusFilter<"VolunteerApplication">
        | $Enums.ScreeningStatus;
      screeningReasons?: JsonFilter<"VolunteerApplication">;
      submittedAt?: DateTimeFilter<"VolunteerApplication"> | Date | string;
      organization?: XOR<
        OrganizationScalarRelationFilter,
        OrganizationWhereInput
      >;
      answers?: VolunteerAnswerListRelationFilter;
    },
    "id"
  >;

  export type VolunteerApplicationOrderByWithAggregationInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    submittedByEmail?: SortOrder;
    status?: SortOrder;
    screeningStatus?: SortOrder;
    screeningReasons?: SortOrder;
    submittedAt?: SortOrder;
    _count?: VolunteerApplicationCountOrderByAggregateInput;
    _max?: VolunteerApplicationMaxOrderByAggregateInput;
    _min?: VolunteerApplicationMinOrderByAggregateInput;
  };

  export type VolunteerApplicationScalarWhereWithAggregatesInput = {
    AND?:
      | VolunteerApplicationScalarWhereWithAggregatesInput
      | VolunteerApplicationScalarWhereWithAggregatesInput[];
    OR?: VolunteerApplicationScalarWhereWithAggregatesInput[];
    NOT?:
      | VolunteerApplicationScalarWhereWithAggregatesInput
      | VolunteerApplicationScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"VolunteerApplication"> | string;
    orgId?: StringWithAggregatesFilter<"VolunteerApplication"> | string;
    submittedByEmail?:
      | StringWithAggregatesFilter<"VolunteerApplication">
      | string;
    status?:
      | EnumApplicationStatusWithAggregatesFilter<"VolunteerApplication">
      | $Enums.ApplicationStatus;
    screeningStatus?:
      | EnumScreeningStatusWithAggregatesFilter<"VolunteerApplication">
      | $Enums.ScreeningStatus;
    screeningReasons?: JsonWithAggregatesFilter<"VolunteerApplication">;
    submittedAt?:
      | DateTimeWithAggregatesFilter<"VolunteerApplication">
      | Date
      | string;
  };

  export type VolunteerAnswerWhereInput = {
    AND?: VolunteerAnswerWhereInput | VolunteerAnswerWhereInput[];
    OR?: VolunteerAnswerWhereInput[];
    NOT?: VolunteerAnswerWhereInput | VolunteerAnswerWhereInput[];
    id?: StringFilter<"VolunteerAnswer"> | string;
    applicationId?: StringFilter<"VolunteerAnswer"> | string;
    questionId?: StringFilter<"VolunteerAnswer"> | string;
    answerJson?: JsonFilter<"VolunteerAnswer">;
    application?: XOR<
      VolunteerApplicationScalarRelationFilter,
      VolunteerApplicationWhereInput
    >;
  };

  export type VolunteerAnswerOrderByWithRelationInput = {
    id?: SortOrder;
    applicationId?: SortOrder;
    questionId?: SortOrder;
    answerJson?: SortOrder;
    application?: VolunteerApplicationOrderByWithRelationInput;
  };

  export type VolunteerAnswerWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      AND?: VolunteerAnswerWhereInput | VolunteerAnswerWhereInput[];
      OR?: VolunteerAnswerWhereInput[];
      NOT?: VolunteerAnswerWhereInput | VolunteerAnswerWhereInput[];
      applicationId?: StringFilter<"VolunteerAnswer"> | string;
      questionId?: StringFilter<"VolunteerAnswer"> | string;
      answerJson?: JsonFilter<"VolunteerAnswer">;
      application?: XOR<
        VolunteerApplicationScalarRelationFilter,
        VolunteerApplicationWhereInput
      >;
    },
    "id"
  >;

  export type VolunteerAnswerOrderByWithAggregationInput = {
    id?: SortOrder;
    applicationId?: SortOrder;
    questionId?: SortOrder;
    answerJson?: SortOrder;
    _count?: VolunteerAnswerCountOrderByAggregateInput;
    _max?: VolunteerAnswerMaxOrderByAggregateInput;
    _min?: VolunteerAnswerMinOrderByAggregateInput;
  };

  export type VolunteerAnswerScalarWhereWithAggregatesInput = {
    AND?:
      | VolunteerAnswerScalarWhereWithAggregatesInput
      | VolunteerAnswerScalarWhereWithAggregatesInput[];
    OR?: VolunteerAnswerScalarWhereWithAggregatesInput[];
    NOT?:
      | VolunteerAnswerScalarWhereWithAggregatesInput
      | VolunteerAnswerScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"VolunteerAnswer"> | string;
    applicationId?: StringWithAggregatesFilter<"VolunteerAnswer"> | string;
    questionId?: StringWithAggregatesFilter<"VolunteerAnswer"> | string;
    answerJson?: JsonWithAggregatesFilter<"VolunteerAnswer">;
  };

  export type ScreenerQuestionWhereInput = {
    AND?: ScreenerQuestionWhereInput | ScreenerQuestionWhereInput[];
    OR?: ScreenerQuestionWhereInput[];
    NOT?: ScreenerQuestionWhereInput | ScreenerQuestionWhereInput[];
    id?: StringFilter<"ScreenerQuestion"> | string;
    orgId?: StringFilter<"ScreenerQuestion"> | string;
    key?: StringFilter<"ScreenerQuestion"> | string;
    prompt?: StringFilter<"ScreenerQuestion"> | string;
    type?:
      | EnumScreenerQuestionTypeFilter<"ScreenerQuestion">
      | $Enums.ScreenerQuestionType;
    configJson?: JsonFilter<"ScreenerQuestion">;
    isActive?: BoolFilter<"ScreenerQuestion"> | boolean;
    order?: IntFilter<"ScreenerQuestion"> | number;
    createdAt?: DateTimeFilter<"ScreenerQuestion"> | Date | string;
    organization?: XOR<
      OrganizationScalarRelationFilter,
      OrganizationWhereInput
    >;
  };

  export type ScreenerQuestionOrderByWithRelationInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    key?: SortOrder;
    prompt?: SortOrder;
    type?: SortOrder;
    configJson?: SortOrder;
    isActive?: SortOrder;
    order?: SortOrder;
    createdAt?: SortOrder;
    organization?: OrganizationOrderByWithRelationInput;
  };

  export type ScreenerQuestionWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      orgId_key?: ScreenerQuestionOrgIdKeyCompoundUniqueInput;
      AND?: ScreenerQuestionWhereInput | ScreenerQuestionWhereInput[];
      OR?: ScreenerQuestionWhereInput[];
      NOT?: ScreenerQuestionWhereInput | ScreenerQuestionWhereInput[];
      orgId?: StringFilter<"ScreenerQuestion"> | string;
      key?: StringFilter<"ScreenerQuestion"> | string;
      prompt?: StringFilter<"ScreenerQuestion"> | string;
      type?:
        | EnumScreenerQuestionTypeFilter<"ScreenerQuestion">
        | $Enums.ScreenerQuestionType;
      configJson?: JsonFilter<"ScreenerQuestion">;
      isActive?: BoolFilter<"ScreenerQuestion"> | boolean;
      order?: IntFilter<"ScreenerQuestion"> | number;
      createdAt?: DateTimeFilter<"ScreenerQuestion"> | Date | string;
      organization?: XOR<
        OrganizationScalarRelationFilter,
        OrganizationWhereInput
      >;
    },
    "id" | "orgId_key"
  >;

  export type ScreenerQuestionOrderByWithAggregationInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    key?: SortOrder;
    prompt?: SortOrder;
    type?: SortOrder;
    configJson?: SortOrder;
    isActive?: SortOrder;
    order?: SortOrder;
    createdAt?: SortOrder;
    _count?: ScreenerQuestionCountOrderByAggregateInput;
    _avg?: ScreenerQuestionAvgOrderByAggregateInput;
    _max?: ScreenerQuestionMaxOrderByAggregateInput;
    _min?: ScreenerQuestionMinOrderByAggregateInput;
    _sum?: ScreenerQuestionSumOrderByAggregateInput;
  };

  export type ScreenerQuestionScalarWhereWithAggregatesInput = {
    AND?:
      | ScreenerQuestionScalarWhereWithAggregatesInput
      | ScreenerQuestionScalarWhereWithAggregatesInput[];
    OR?: ScreenerQuestionScalarWhereWithAggregatesInput[];
    NOT?:
      | ScreenerQuestionScalarWhereWithAggregatesInput
      | ScreenerQuestionScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<"ScreenerQuestion"> | string;
    orgId?: StringWithAggregatesFilter<"ScreenerQuestion"> | string;
    key?: StringWithAggregatesFilter<"ScreenerQuestion"> | string;
    prompt?: StringWithAggregatesFilter<"ScreenerQuestion"> | string;
    type?:
      | EnumScreenerQuestionTypeWithAggregatesFilter<"ScreenerQuestion">
      | $Enums.ScreenerQuestionType;
    configJson?: JsonWithAggregatesFilter<"ScreenerQuestion">;
    isActive?: BoolWithAggregatesFilter<"ScreenerQuestion"> | boolean;
    order?: IntWithAggregatesFilter<"ScreenerQuestion"> | number;
    createdAt?:
      | DateTimeWithAggregatesFilter<"ScreenerQuestion">
      | Date
      | string;
  };

  export type UserCreateInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | string | null;
    image?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    accounts?: AccountCreateNestedManyWithoutUserInput;
    sessions?: SessionCreateNestedManyWithoutUserInput;
    memberships?: OrganizationMemberCreateNestedManyWithoutUserInput;
    auditLogs?: AuditLogCreateNestedManyWithoutActorInput;
  };

  export type UserUncheckedCreateInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | string | null;
    image?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput;
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput;
    memberships?: OrganizationMemberUncheckedCreateNestedManyWithoutUserInput;
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutActorInput;
  };

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: NullableStringFieldUpdateOperationsInput | string | null;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    emailVerified?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    image?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accounts?: AccountUpdateManyWithoutUserNestedInput;
    sessions?: SessionUpdateManyWithoutUserNestedInput;
    memberships?: OrganizationMemberUpdateManyWithoutUserNestedInput;
    auditLogs?: AuditLogUpdateManyWithoutActorNestedInput;
  };

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: NullableStringFieldUpdateOperationsInput | string | null;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    emailVerified?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    image?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput;
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput;
    memberships?: OrganizationMemberUncheckedUpdateManyWithoutUserNestedInput;
    auditLogs?: AuditLogUncheckedUpdateManyWithoutActorNestedInput;
  };

  export type UserCreateManyInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | string | null;
    image?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: NullableStringFieldUpdateOperationsInput | string | null;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    emailVerified?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    image?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: NullableStringFieldUpdateOperationsInput | string | null;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    emailVerified?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    image?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type AccountCreateInput = {
    id?: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token?: string | null;
    access_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
    session_state?: string | null;
    user: UserCreateNestedOneWithoutAccountsInput;
  };

  export type AccountUncheckedCreateInput = {
    id?: string;
    userId: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token?: string | null;
    access_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
    session_state?: string | null;
  };

  export type AccountUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    type?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    providerAccountId?: StringFieldUpdateOperationsInput | string;
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null;
    access_token?: NullableStringFieldUpdateOperationsInput | string | null;
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null;
    token_type?: NullableStringFieldUpdateOperationsInput | string | null;
    scope?: NullableStringFieldUpdateOperationsInput | string | null;
    id_token?: NullableStringFieldUpdateOperationsInput | string | null;
    session_state?: NullableStringFieldUpdateOperationsInput | string | null;
    user?: UserUpdateOneRequiredWithoutAccountsNestedInput;
  };

  export type AccountUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    type?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    providerAccountId?: StringFieldUpdateOperationsInput | string;
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null;
    access_token?: NullableStringFieldUpdateOperationsInput | string | null;
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null;
    token_type?: NullableStringFieldUpdateOperationsInput | string | null;
    scope?: NullableStringFieldUpdateOperationsInput | string | null;
    id_token?: NullableStringFieldUpdateOperationsInput | string | null;
    session_state?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type AccountCreateManyInput = {
    id?: string;
    userId: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token?: string | null;
    access_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
    session_state?: string | null;
  };

  export type AccountUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    type?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    providerAccountId?: StringFieldUpdateOperationsInput | string;
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null;
    access_token?: NullableStringFieldUpdateOperationsInput | string | null;
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null;
    token_type?: NullableStringFieldUpdateOperationsInput | string | null;
    scope?: NullableStringFieldUpdateOperationsInput | string | null;
    id_token?: NullableStringFieldUpdateOperationsInput | string | null;
    session_state?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type AccountUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    type?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    providerAccountId?: StringFieldUpdateOperationsInput | string;
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null;
    access_token?: NullableStringFieldUpdateOperationsInput | string | null;
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null;
    token_type?: NullableStringFieldUpdateOperationsInput | string | null;
    scope?: NullableStringFieldUpdateOperationsInput | string | null;
    id_token?: NullableStringFieldUpdateOperationsInput | string | null;
    session_state?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type SessionCreateInput = {
    id?: string;
    sessionToken: string;
    expires: Date | string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user: UserCreateNestedOneWithoutSessionsInput;
    currentOrg?: OrganizationCreateNestedOneWithoutSessionsInput;
  };

  export type SessionUncheckedCreateInput = {
    id?: string;
    sessionToken: string;
    userId: string;
    expires: Date | string;
    currentOrgId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type SessionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    sessionToken?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    user?: UserUpdateOneRequiredWithoutSessionsNestedInput;
    currentOrg?: OrganizationUpdateOneWithoutSessionsNestedInput;
  };

  export type SessionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    sessionToken?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
    currentOrgId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type SessionCreateManyInput = {
    id?: string;
    sessionToken: string;
    userId: string;
    expires: Date | string;
    currentOrgId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type SessionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    sessionToken?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type SessionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    sessionToken?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
    currentOrgId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type VerificationTokenCreateInput = {
    identifier: string;
    token: string;
    expires: Date | string;
  };

  export type VerificationTokenUncheckedCreateInput = {
    identifier: string;
    token: string;
    expires: Date | string;
  };

  export type VerificationTokenUpdateInput = {
    identifier?: StringFieldUpdateOperationsInput | string;
    token?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type VerificationTokenUncheckedUpdateInput = {
    identifier?: StringFieldUpdateOperationsInput | string;
    token?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type VerificationTokenCreateManyInput = {
    identifier: string;
    token: string;
    expires: Date | string;
  };

  export type VerificationTokenUpdateManyMutationInput = {
    identifier?: StringFieldUpdateOperationsInput | string;
    token?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type VerificationTokenUncheckedUpdateManyInput = {
    identifier?: StringFieldUpdateOperationsInput | string;
    token?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OrganizationCreateInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    members?: OrganizationMemberCreateNestedManyWithoutOrganizationInput;
    auditLogs?: AuditLogCreateNestedManyWithoutOrganizationInput;
    featureFlags?: FeatureFlagCreateNestedManyWithoutOrganizationInput;
    applications?: VolunteerApplicationCreateNestedManyWithoutOrganizationInput;
    screenerQuestions?: ScreenerQuestionCreateNestedManyWithoutOrganizationInput;
    sessions?: SessionCreateNestedManyWithoutCurrentOrgInput;
  };

  export type OrganizationUncheckedCreateInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    members?: OrganizationMemberUncheckedCreateNestedManyWithoutOrganizationInput;
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutOrganizationInput;
    featureFlags?: FeatureFlagUncheckedCreateNestedManyWithoutOrganizationInput;
    applications?: VolunteerApplicationUncheckedCreateNestedManyWithoutOrganizationInput;
    screenerQuestions?: ScreenerQuestionUncheckedCreateNestedManyWithoutOrganizationInput;
    sessions?: SessionUncheckedCreateNestedManyWithoutCurrentOrgInput;
  };

  export type OrganizationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    members?: OrganizationMemberUpdateManyWithoutOrganizationNestedInput;
    auditLogs?: AuditLogUpdateManyWithoutOrganizationNestedInput;
    featureFlags?: FeatureFlagUpdateManyWithoutOrganizationNestedInput;
    applications?: VolunteerApplicationUpdateManyWithoutOrganizationNestedInput;
    screenerQuestions?: ScreenerQuestionUpdateManyWithoutOrganizationNestedInput;
    sessions?: SessionUpdateManyWithoutCurrentOrgNestedInput;
  };

  export type OrganizationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    members?: OrganizationMemberUncheckedUpdateManyWithoutOrganizationNestedInput;
    auditLogs?: AuditLogUncheckedUpdateManyWithoutOrganizationNestedInput;
    featureFlags?: FeatureFlagUncheckedUpdateManyWithoutOrganizationNestedInput;
    applications?: VolunteerApplicationUncheckedUpdateManyWithoutOrganizationNestedInput;
    screenerQuestions?: ScreenerQuestionUncheckedUpdateManyWithoutOrganizationNestedInput;
    sessions?: SessionUncheckedUpdateManyWithoutCurrentOrgNestedInput;
  };

  export type OrganizationCreateManyInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type OrganizationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OrganizationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OrganizationMemberCreateInput = {
    id?: string;
    role?: $Enums.Role;
    createdAt?: Date | string;
    organization: OrganizationCreateNestedOneWithoutMembersInput;
    user: UserCreateNestedOneWithoutMembershipsInput;
  };

  export type OrganizationMemberUncheckedCreateInput = {
    id?: string;
    organizationId: string;
    userId: string;
    role?: $Enums.Role;
    createdAt?: Date | string;
  };

  export type OrganizationMemberUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    organization?: OrganizationUpdateOneRequiredWithoutMembersNestedInput;
    user?: UserUpdateOneRequiredWithoutMembershipsNestedInput;
  };

  export type OrganizationMemberUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    organizationId?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OrganizationMemberCreateManyInput = {
    id?: string;
    organizationId: string;
    userId: string;
    role?: $Enums.Role;
    createdAt?: Date | string;
  };

  export type OrganizationMemberUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OrganizationMemberUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    organizationId?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type AuditLogCreateInput = {
    id?: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: Date | string;
    organization: OrganizationCreateNestedOneWithoutAuditLogsInput;
    actor?: UserCreateNestedOneWithoutAuditLogsInput;
  };

  export type AuditLogUncheckedCreateInput = {
    id?: string;
    actorId?: string | null;
    orgId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: Date | string;
  };

  export type AuditLogUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    action?: StringFieldUpdateOperationsInput | string;
    entityType?: StringFieldUpdateOperationsInput | string;
    entityId?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    organization?: OrganizationUpdateOneRequiredWithoutAuditLogsNestedInput;
    actor?: UserUpdateOneWithoutAuditLogsNestedInput;
  };

  export type AuditLogUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    actorId?: NullableStringFieldUpdateOperationsInput | string | null;
    orgId?: StringFieldUpdateOperationsInput | string;
    action?: StringFieldUpdateOperationsInput | string;
    entityType?: StringFieldUpdateOperationsInput | string;
    entityId?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type AuditLogCreateManyInput = {
    id?: string;
    actorId?: string | null;
    orgId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: Date | string;
  };

  export type AuditLogUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    action?: StringFieldUpdateOperationsInput | string;
    entityType?: StringFieldUpdateOperationsInput | string;
    entityId?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type AuditLogUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    actorId?: NullableStringFieldUpdateOperationsInput | string | null;
    orgId?: StringFieldUpdateOperationsInput | string;
    action?: StringFieldUpdateOperationsInput | string;
    entityType?: StringFieldUpdateOperationsInput | string;
    entityId?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type FeatureFlagCreateInput = {
    id?: string;
    key: string;
    enabled?: boolean;
    createdAt?: Date | string;
    organization: OrganizationCreateNestedOneWithoutFeatureFlagsInput;
  };

  export type FeatureFlagUncheckedCreateInput = {
    id?: string;
    orgId: string;
    key: string;
    enabled?: boolean;
    createdAt?: Date | string;
  };

  export type FeatureFlagUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    enabled?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    organization?: OrganizationUpdateOneRequiredWithoutFeatureFlagsNestedInput;
  };

  export type FeatureFlagUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    orgId?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    enabled?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type FeatureFlagCreateManyInput = {
    id?: string;
    orgId: string;
    key: string;
    enabled?: boolean;
    createdAt?: Date | string;
  };

  export type FeatureFlagUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    enabled?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type FeatureFlagUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    orgId?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    enabled?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type VolunteerApplicationCreateInput = {
    id?: string;
    submittedByEmail: string;
    status?: $Enums.ApplicationStatus;
    screeningStatus: $Enums.ScreeningStatus;
    screeningReasons: JsonNullValueInput | InputJsonValue;
    submittedAt?: Date | string;
    organization: OrganizationCreateNestedOneWithoutApplicationsInput;
    answers?: VolunteerAnswerCreateNestedManyWithoutApplicationInput;
  };

  export type VolunteerApplicationUncheckedCreateInput = {
    id?: string;
    orgId: string;
    submittedByEmail: string;
    status?: $Enums.ApplicationStatus;
    screeningStatus: $Enums.ScreeningStatus;
    screeningReasons: JsonNullValueInput | InputJsonValue;
    submittedAt?: Date | string;
    answers?: VolunteerAnswerUncheckedCreateNestedManyWithoutApplicationInput;
  };

  export type VolunteerApplicationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    submittedByEmail?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumApplicationStatusFieldUpdateOperationsInput
      | $Enums.ApplicationStatus;
    screeningStatus?:
      | EnumScreeningStatusFieldUpdateOperationsInput
      | $Enums.ScreeningStatus;
    screeningReasons?: JsonNullValueInput | InputJsonValue;
    submittedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    organization?: OrganizationUpdateOneRequiredWithoutApplicationsNestedInput;
    answers?: VolunteerAnswerUpdateManyWithoutApplicationNestedInput;
  };

  export type VolunteerApplicationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    orgId?: StringFieldUpdateOperationsInput | string;
    submittedByEmail?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumApplicationStatusFieldUpdateOperationsInput
      | $Enums.ApplicationStatus;
    screeningStatus?:
      | EnumScreeningStatusFieldUpdateOperationsInput
      | $Enums.ScreeningStatus;
    screeningReasons?: JsonNullValueInput | InputJsonValue;
    submittedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    answers?: VolunteerAnswerUncheckedUpdateManyWithoutApplicationNestedInput;
  };

  export type VolunteerApplicationCreateManyInput = {
    id?: string;
    orgId: string;
    submittedByEmail: string;
    status?: $Enums.ApplicationStatus;
    screeningStatus: $Enums.ScreeningStatus;
    screeningReasons: JsonNullValueInput | InputJsonValue;
    submittedAt?: Date | string;
  };

  export type VolunteerApplicationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    submittedByEmail?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumApplicationStatusFieldUpdateOperationsInput
      | $Enums.ApplicationStatus;
    screeningStatus?:
      | EnumScreeningStatusFieldUpdateOperationsInput
      | $Enums.ScreeningStatus;
    screeningReasons?: JsonNullValueInput | InputJsonValue;
    submittedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type VolunteerApplicationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    orgId?: StringFieldUpdateOperationsInput | string;
    submittedByEmail?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumApplicationStatusFieldUpdateOperationsInput
      | $Enums.ApplicationStatus;
    screeningStatus?:
      | EnumScreeningStatusFieldUpdateOperationsInput
      | $Enums.ScreeningStatus;
    screeningReasons?: JsonNullValueInput | InputJsonValue;
    submittedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type VolunteerAnswerCreateInput = {
    id?: string;
    questionId: string;
    answerJson: JsonNullValueInput | InputJsonValue;
    application: VolunteerApplicationCreateNestedOneWithoutAnswersInput;
  };

  export type VolunteerAnswerUncheckedCreateInput = {
    id?: string;
    applicationId: string;
    questionId: string;
    answerJson: JsonNullValueInput | InputJsonValue;
  };

  export type VolunteerAnswerUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    questionId?: StringFieldUpdateOperationsInput | string;
    answerJson?: JsonNullValueInput | InputJsonValue;
    application?: VolunteerApplicationUpdateOneRequiredWithoutAnswersNestedInput;
  };

  export type VolunteerAnswerUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    applicationId?: StringFieldUpdateOperationsInput | string;
    questionId?: StringFieldUpdateOperationsInput | string;
    answerJson?: JsonNullValueInput | InputJsonValue;
  };

  export type VolunteerAnswerCreateManyInput = {
    id?: string;
    applicationId: string;
    questionId: string;
    answerJson: JsonNullValueInput | InputJsonValue;
  };

  export type VolunteerAnswerUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    questionId?: StringFieldUpdateOperationsInput | string;
    answerJson?: JsonNullValueInput | InputJsonValue;
  };

  export type VolunteerAnswerUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    applicationId?: StringFieldUpdateOperationsInput | string;
    questionId?: StringFieldUpdateOperationsInput | string;
    answerJson?: JsonNullValueInput | InputJsonValue;
  };

  export type ScreenerQuestionCreateInput = {
    id?: string;
    key: string;
    prompt: string;
    type: $Enums.ScreenerQuestionType;
    configJson: JsonNullValueInput | InputJsonValue;
    isActive?: boolean;
    order: number;
    createdAt?: Date | string;
    organization: OrganizationCreateNestedOneWithoutScreenerQuestionsInput;
  };

  export type ScreenerQuestionUncheckedCreateInput = {
    id?: string;
    orgId: string;
    key: string;
    prompt: string;
    type: $Enums.ScreenerQuestionType;
    configJson: JsonNullValueInput | InputJsonValue;
    isActive?: boolean;
    order: number;
    createdAt?: Date | string;
  };

  export type ScreenerQuestionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    prompt?: StringFieldUpdateOperationsInput | string;
    type?:
      | EnumScreenerQuestionTypeFieldUpdateOperationsInput
      | $Enums.ScreenerQuestionType;
    configJson?: JsonNullValueInput | InputJsonValue;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    order?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    organization?: OrganizationUpdateOneRequiredWithoutScreenerQuestionsNestedInput;
  };

  export type ScreenerQuestionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    orgId?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    prompt?: StringFieldUpdateOperationsInput | string;
    type?:
      | EnumScreenerQuestionTypeFieldUpdateOperationsInput
      | $Enums.ScreenerQuestionType;
    configJson?: JsonNullValueInput | InputJsonValue;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    order?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type ScreenerQuestionCreateManyInput = {
    id?: string;
    orgId: string;
    key: string;
    prompt: string;
    type: $Enums.ScreenerQuestionType;
    configJson: JsonNullValueInput | InputJsonValue;
    isActive?: boolean;
    order: number;
    createdAt?: Date | string;
  };

  export type ScreenerQuestionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    prompt?: StringFieldUpdateOperationsInput | string;
    type?:
      | EnumScreenerQuestionTypeFieldUpdateOperationsInput
      | $Enums.ScreenerQuestionType;
    configJson?: JsonNullValueInput | InputJsonValue;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    order?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type ScreenerQuestionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    orgId?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    prompt?: StringFieldUpdateOperationsInput | string;
    type?:
      | EnumScreenerQuestionTypeFieldUpdateOperationsInput
      | $Enums.ScreenerQuestionType;
    configJson?: JsonNullValueInput | InputJsonValue;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    order?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?: NestedStringFilter<$PrismaModel> | string;
  };

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?: NestedStringNullableFilter<$PrismaModel> | string | null;
  };

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null;
  };

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string;
  };

  export type AccountListRelationFilter = {
    every?: AccountWhereInput;
    some?: AccountWhereInput;
    none?: AccountWhereInput;
  };

  export type SessionListRelationFilter = {
    every?: SessionWhereInput;
    some?: SessionWhereInput;
    none?: SessionWhereInput;
  };

  export type OrganizationMemberListRelationFilter = {
    every?: OrganizationMemberWhereInput;
    some?: OrganizationMemberWhereInput;
    none?: OrganizationMemberWhereInput;
  };

  export type AuditLogListRelationFilter = {
    every?: AuditLogWhereInput;
    some?: AuditLogWhereInput;
    none?: AuditLogWhereInput;
  };

  export type SortOrderInput = {
    sort: SortOrder;
    nulls?: NullsOrder;
  };

  export type AccountOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type SessionOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type OrganizationMemberOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type AuditLogOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder;
    name?: SortOrder;
    email?: SortOrder;
    emailVerified?: SortOrder;
    image?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder;
    name?: SortOrder;
    email?: SortOrder;
    emailVerified?: SortOrder;
    image?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder;
    name?: SortOrder;
    email?: SortOrder;
    emailVerified?: SortOrder;
    image?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedStringFilter<$PrismaModel>;
    _max?: NestedStringFilter<$PrismaModel>;
  };

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?:
      | NestedStringNullableWithAggregatesFilter<$PrismaModel>
      | string
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedStringNullableFilter<$PrismaModel>;
    _max?: NestedStringNullableFilter<$PrismaModel>;
  };

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?:
      | NestedDateTimeNullableWithAggregatesFilter<$PrismaModel>
      | Date
      | string
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedDateTimeNullableFilter<$PrismaModel>;
    _max?: NestedDateTimeNullableFilter<$PrismaModel>;
  };

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedDateTimeFilter<$PrismaModel>;
    _max?: NestedDateTimeFilter<$PrismaModel>;
  };

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableFilter<$PrismaModel> | number | null;
  };

  export type UserScalarRelationFilter = {
    is?: UserWhereInput;
    isNot?: UserWhereInput;
  };

  export type AccountProviderProviderAccountIdCompoundUniqueInput = {
    provider: string;
    providerAccountId: string;
  };

  export type AccountCountOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    provider?: SortOrder;
    providerAccountId?: SortOrder;
    refresh_token?: SortOrder;
    access_token?: SortOrder;
    expires_at?: SortOrder;
    token_type?: SortOrder;
    scope?: SortOrder;
    id_token?: SortOrder;
    session_state?: SortOrder;
  };

  export type AccountAvgOrderByAggregateInput = {
    expires_at?: SortOrder;
  };

  export type AccountMaxOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    provider?: SortOrder;
    providerAccountId?: SortOrder;
    refresh_token?: SortOrder;
    access_token?: SortOrder;
    expires_at?: SortOrder;
    token_type?: SortOrder;
    scope?: SortOrder;
    id_token?: SortOrder;
    session_state?: SortOrder;
  };

  export type AccountMinOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    provider?: SortOrder;
    providerAccountId?: SortOrder;
    refresh_token?: SortOrder;
    access_token?: SortOrder;
    expires_at?: SortOrder;
    token_type?: SortOrder;
    scope?: SortOrder;
    id_token?: SortOrder;
    session_state?: SortOrder;
  };

  export type AccountSumOrderByAggregateInput = {
    expires_at?: SortOrder;
  };

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _avg?: NestedFloatNullableFilter<$PrismaModel>;
    _sum?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedIntNullableFilter<$PrismaModel>;
    _max?: NestedIntNullableFilter<$PrismaModel>;
  };

  export type OrganizationNullableScalarRelationFilter = {
    is?: OrganizationWhereInput | null;
    isNot?: OrganizationWhereInput | null;
  };

  export type SessionCountOrderByAggregateInput = {
    id?: SortOrder;
    sessionToken?: SortOrder;
    userId?: SortOrder;
    expires?: SortOrder;
    currentOrgId?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type SessionMaxOrderByAggregateInput = {
    id?: SortOrder;
    sessionToken?: SortOrder;
    userId?: SortOrder;
    expires?: SortOrder;
    currentOrgId?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type SessionMinOrderByAggregateInput = {
    id?: SortOrder;
    sessionToken?: SortOrder;
    userId?: SortOrder;
    expires?: SortOrder;
    currentOrgId?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type VerificationTokenIdentifierTokenCompoundUniqueInput = {
    identifier: string;
    token: string;
  };

  export type VerificationTokenCountOrderByAggregateInput = {
    identifier?: SortOrder;
    token?: SortOrder;
    expires?: SortOrder;
  };

  export type VerificationTokenMaxOrderByAggregateInput = {
    identifier?: SortOrder;
    token?: SortOrder;
    expires?: SortOrder;
  };

  export type VerificationTokenMinOrderByAggregateInput = {
    identifier?: SortOrder;
    token?: SortOrder;
    expires?: SortOrder;
  };

  export type FeatureFlagListRelationFilter = {
    every?: FeatureFlagWhereInput;
    some?: FeatureFlagWhereInput;
    none?: FeatureFlagWhereInput;
  };

  export type VolunteerApplicationListRelationFilter = {
    every?: VolunteerApplicationWhereInput;
    some?: VolunteerApplicationWhereInput;
    none?: VolunteerApplicationWhereInput;
  };

  export type ScreenerQuestionListRelationFilter = {
    every?: ScreenerQuestionWhereInput;
    some?: ScreenerQuestionWhereInput;
    none?: ScreenerQuestionWhereInput;
  };

  export type FeatureFlagOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type VolunteerApplicationOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type ScreenerQuestionOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type OrganizationCountOrderByAggregateInput = {
    id?: SortOrder;
    name?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type OrganizationMaxOrderByAggregateInput = {
    id?: SortOrder;
    name?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type OrganizationMinOrderByAggregateInput = {
    id?: SortOrder;
    name?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type EnumRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>;
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>;
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>;
    not?: NestedEnumRoleFilter<$PrismaModel> | $Enums.Role;
  };

  export type OrganizationScalarRelationFilter = {
    is?: OrganizationWhereInput;
    isNot?: OrganizationWhereInput;
  };

  export type OrganizationMemberOrganizationIdUserIdCompoundUniqueInput = {
    organizationId: string;
    userId: string;
  };

  export type OrganizationMemberCountOrderByAggregateInput = {
    id?: SortOrder;
    organizationId?: SortOrder;
    userId?: SortOrder;
    role?: SortOrder;
    createdAt?: SortOrder;
  };

  export type OrganizationMemberMaxOrderByAggregateInput = {
    id?: SortOrder;
    organizationId?: SortOrder;
    userId?: SortOrder;
    role?: SortOrder;
    createdAt?: SortOrder;
  };

  export type OrganizationMemberMinOrderByAggregateInput = {
    id?: SortOrder;
    organizationId?: SortOrder;
    userId?: SortOrder;
    role?: SortOrder;
    createdAt?: SortOrder;
  };

  export type EnumRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>;
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>;
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>;
    not?: NestedEnumRoleWithAggregatesFilter<$PrismaModel> | $Enums.Role;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumRoleFilter<$PrismaModel>;
    _max?: NestedEnumRoleFilter<$PrismaModel>;
  };
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<JsonNullableFilterBase<$PrismaModel>>,
          Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, "path">
        >,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<
        Omit<Required<JsonNullableFilterBase<$PrismaModel>>, "path">
      >;

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>;
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
  };

  export type UserNullableScalarRelationFilter = {
    is?: UserWhereInput | null;
    isNot?: UserWhereInput | null;
  };

  export type AuditLogCountOrderByAggregateInput = {
    id?: SortOrder;
    actorId?: SortOrder;
    orgId?: SortOrder;
    action?: SortOrder;
    entityType?: SortOrder;
    entityId?: SortOrder;
    metadata?: SortOrder;
    createdAt?: SortOrder;
  };

  export type AuditLogMaxOrderByAggregateInput = {
    id?: SortOrder;
    actorId?: SortOrder;
    orgId?: SortOrder;
    action?: SortOrder;
    entityType?: SortOrder;
    entityId?: SortOrder;
    createdAt?: SortOrder;
  };

  export type AuditLogMinOrderByAggregateInput = {
    id?: SortOrder;
    actorId?: SortOrder;
    orgId?: SortOrder;
    action?: SortOrder;
    entityType?: SortOrder;
    entityId?: SortOrder;
    createdAt?: SortOrder;
  };
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>,
          Exclude<
            keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>,
            "path"
          >
        >,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<
        Omit<
          Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>,
          "path"
        >
      >;

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>;
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedJsonNullableFilter<$PrismaModel>;
    _max?: NestedJsonNullableFilter<$PrismaModel>;
  };

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolFilter<$PrismaModel> | boolean;
  };

  export type FeatureFlagOrgIdKeyCompoundUniqueInput = {
    orgId: string;
    key: string;
  };

  export type FeatureFlagCountOrderByAggregateInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    key?: SortOrder;
    enabled?: SortOrder;
    createdAt?: SortOrder;
  };

  export type FeatureFlagMaxOrderByAggregateInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    key?: SortOrder;
    enabled?: SortOrder;
    createdAt?: SortOrder;
  };

  export type FeatureFlagMinOrderByAggregateInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    key?: SortOrder;
    enabled?: SortOrder;
    createdAt?: SortOrder;
  };

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedBoolFilter<$PrismaModel>;
    _max?: NestedBoolFilter<$PrismaModel>;
  };

  export type EnumApplicationStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.ApplicationStatus
      | EnumApplicationStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.ApplicationStatus[]
      | ListEnumApplicationStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.ApplicationStatus[]
      | ListEnumApplicationStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumApplicationStatusFilter<$PrismaModel>
      | $Enums.ApplicationStatus;
  };

  export type EnumScreeningStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.ScreeningStatus
      | EnumScreeningStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.ScreeningStatus[]
      | ListEnumScreeningStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.ScreeningStatus[]
      | ListEnumScreeningStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumScreeningStatusFilter<$PrismaModel>
      | $Enums.ScreeningStatus;
  };
  export type JsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<JsonFilterBase<$PrismaModel>>,
          Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, "path">
        >,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, "path">>;

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>;
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
  };

  export type VolunteerAnswerListRelationFilter = {
    every?: VolunteerAnswerWhereInput;
    some?: VolunteerAnswerWhereInput;
    none?: VolunteerAnswerWhereInput;
  };

  export type VolunteerAnswerOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type VolunteerApplicationCountOrderByAggregateInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    submittedByEmail?: SortOrder;
    status?: SortOrder;
    screeningStatus?: SortOrder;
    screeningReasons?: SortOrder;
    submittedAt?: SortOrder;
  };

  export type VolunteerApplicationMaxOrderByAggregateInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    submittedByEmail?: SortOrder;
    status?: SortOrder;
    screeningStatus?: SortOrder;
    submittedAt?: SortOrder;
  };

  export type VolunteerApplicationMinOrderByAggregateInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    submittedByEmail?: SortOrder;
    status?: SortOrder;
    screeningStatus?: SortOrder;
    submittedAt?: SortOrder;
  };

  export type EnumApplicationStatusWithAggregatesFilter<$PrismaModel = never> =
    {
      equals?:
        | $Enums.ApplicationStatus
        | EnumApplicationStatusFieldRefInput<$PrismaModel>;
      in?:
        | $Enums.ApplicationStatus[]
        | ListEnumApplicationStatusFieldRefInput<$PrismaModel>;
      notIn?:
        | $Enums.ApplicationStatus[]
        | ListEnumApplicationStatusFieldRefInput<$PrismaModel>;
      not?:
        | NestedEnumApplicationStatusWithAggregatesFilter<$PrismaModel>
        | $Enums.ApplicationStatus;
      _count?: NestedIntFilter<$PrismaModel>;
      _min?: NestedEnumApplicationStatusFilter<$PrismaModel>;
      _max?: NestedEnumApplicationStatusFilter<$PrismaModel>;
    };

  export type EnumScreeningStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.ScreeningStatus
      | EnumScreeningStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.ScreeningStatus[]
      | ListEnumScreeningStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.ScreeningStatus[]
      | ListEnumScreeningStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumScreeningStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.ScreeningStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumScreeningStatusFilter<$PrismaModel>;
    _max?: NestedEnumScreeningStatusFilter<$PrismaModel>;
  };
  export type JsonWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<JsonWithAggregatesFilterBase<$PrismaModel>>,
          Exclude<
            keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>,
            "path"
          >
        >,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<
        Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, "path">
      >;

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>;
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedJsonFilter<$PrismaModel>;
    _max?: NestedJsonFilter<$PrismaModel>;
  };

  export type VolunteerApplicationScalarRelationFilter = {
    is?: VolunteerApplicationWhereInput;
    isNot?: VolunteerApplicationWhereInput;
  };

  export type VolunteerAnswerCountOrderByAggregateInput = {
    id?: SortOrder;
    applicationId?: SortOrder;
    questionId?: SortOrder;
    answerJson?: SortOrder;
  };

  export type VolunteerAnswerMaxOrderByAggregateInput = {
    id?: SortOrder;
    applicationId?: SortOrder;
    questionId?: SortOrder;
  };

  export type VolunteerAnswerMinOrderByAggregateInput = {
    id?: SortOrder;
    applicationId?: SortOrder;
    questionId?: SortOrder;
  };

  export type EnumScreenerQuestionTypeFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.ScreenerQuestionType
      | EnumScreenerQuestionTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.ScreenerQuestionType[]
      | ListEnumScreenerQuestionTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.ScreenerQuestionType[]
      | ListEnumScreenerQuestionTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumScreenerQuestionTypeFilter<$PrismaModel>
      | $Enums.ScreenerQuestionType;
  };

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntFilter<$PrismaModel> | number;
  };

  export type ScreenerQuestionOrgIdKeyCompoundUniqueInput = {
    orgId: string;
    key: string;
  };

  export type ScreenerQuestionCountOrderByAggregateInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    key?: SortOrder;
    prompt?: SortOrder;
    type?: SortOrder;
    configJson?: SortOrder;
    isActive?: SortOrder;
    order?: SortOrder;
    createdAt?: SortOrder;
  };

  export type ScreenerQuestionAvgOrderByAggregateInput = {
    order?: SortOrder;
  };

  export type ScreenerQuestionMaxOrderByAggregateInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    key?: SortOrder;
    prompt?: SortOrder;
    type?: SortOrder;
    isActive?: SortOrder;
    order?: SortOrder;
    createdAt?: SortOrder;
  };

  export type ScreenerQuestionMinOrderByAggregateInput = {
    id?: SortOrder;
    orgId?: SortOrder;
    key?: SortOrder;
    prompt?: SortOrder;
    type?: SortOrder;
    isActive?: SortOrder;
    order?: SortOrder;
    createdAt?: SortOrder;
  };

  export type ScreenerQuestionSumOrderByAggregateInput = {
    order?: SortOrder;
  };

  export type EnumScreenerQuestionTypeWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.ScreenerQuestionType
      | EnumScreenerQuestionTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.ScreenerQuestionType[]
      | ListEnumScreenerQuestionTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.ScreenerQuestionType[]
      | ListEnumScreenerQuestionTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumScreenerQuestionTypeWithAggregatesFilter<$PrismaModel>
      | $Enums.ScreenerQuestionType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumScreenerQuestionTypeFilter<$PrismaModel>;
    _max?: NestedEnumScreenerQuestionTypeFilter<$PrismaModel>;
  };

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedFloatFilter<$PrismaModel>;
    _sum?: NestedIntFilter<$PrismaModel>;
    _min?: NestedIntFilter<$PrismaModel>;
    _max?: NestedIntFilter<$PrismaModel>;
  };

  export type AccountCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          AccountCreateWithoutUserInput,
          AccountUncheckedCreateWithoutUserInput
        >
      | AccountCreateWithoutUserInput[]
      | AccountUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | AccountCreateOrConnectWithoutUserInput
      | AccountCreateOrConnectWithoutUserInput[];
    createMany?: AccountCreateManyUserInputEnvelope;
    connect?: AccountWhereUniqueInput | AccountWhereUniqueInput[];
  };

  export type SessionCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          SessionCreateWithoutUserInput,
          SessionUncheckedCreateWithoutUserInput
        >
      | SessionCreateWithoutUserInput[]
      | SessionUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | SessionCreateOrConnectWithoutUserInput
      | SessionCreateOrConnectWithoutUserInput[];
    createMany?: SessionCreateManyUserInputEnvelope;
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
  };

  export type OrganizationMemberCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          OrganizationMemberCreateWithoutUserInput,
          OrganizationMemberUncheckedCreateWithoutUserInput
        >
      | OrganizationMemberCreateWithoutUserInput[]
      | OrganizationMemberUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | OrganizationMemberCreateOrConnectWithoutUserInput
      | OrganizationMemberCreateOrConnectWithoutUserInput[];
    createMany?: OrganizationMemberCreateManyUserInputEnvelope;
    connect?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
  };

  export type AuditLogCreateNestedManyWithoutActorInput = {
    create?:
      | XOR<
          AuditLogCreateWithoutActorInput,
          AuditLogUncheckedCreateWithoutActorInput
        >
      | AuditLogCreateWithoutActorInput[]
      | AuditLogUncheckedCreateWithoutActorInput[];
    connectOrCreate?:
      | AuditLogCreateOrConnectWithoutActorInput
      | AuditLogCreateOrConnectWithoutActorInput[];
    createMany?: AuditLogCreateManyActorInputEnvelope;
    connect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
  };

  export type AccountUncheckedCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          AccountCreateWithoutUserInput,
          AccountUncheckedCreateWithoutUserInput
        >
      | AccountCreateWithoutUserInput[]
      | AccountUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | AccountCreateOrConnectWithoutUserInput
      | AccountCreateOrConnectWithoutUserInput[];
    createMany?: AccountCreateManyUserInputEnvelope;
    connect?: AccountWhereUniqueInput | AccountWhereUniqueInput[];
  };

  export type SessionUncheckedCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          SessionCreateWithoutUserInput,
          SessionUncheckedCreateWithoutUserInput
        >
      | SessionCreateWithoutUserInput[]
      | SessionUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | SessionCreateOrConnectWithoutUserInput
      | SessionCreateOrConnectWithoutUserInput[];
    createMany?: SessionCreateManyUserInputEnvelope;
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
  };

  export type OrganizationMemberUncheckedCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          OrganizationMemberCreateWithoutUserInput,
          OrganizationMemberUncheckedCreateWithoutUserInput
        >
      | OrganizationMemberCreateWithoutUserInput[]
      | OrganizationMemberUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | OrganizationMemberCreateOrConnectWithoutUserInput
      | OrganizationMemberCreateOrConnectWithoutUserInput[];
    createMany?: OrganizationMemberCreateManyUserInputEnvelope;
    connect?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
  };

  export type AuditLogUncheckedCreateNestedManyWithoutActorInput = {
    create?:
      | XOR<
          AuditLogCreateWithoutActorInput,
          AuditLogUncheckedCreateWithoutActorInput
        >
      | AuditLogCreateWithoutActorInput[]
      | AuditLogUncheckedCreateWithoutActorInput[];
    connectOrCreate?:
      | AuditLogCreateOrConnectWithoutActorInput
      | AuditLogCreateOrConnectWithoutActorInput[];
    createMany?: AuditLogCreateManyActorInputEnvelope;
    connect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
  };

  export type StringFieldUpdateOperationsInput = {
    set?: string;
  };

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null;
  };

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null;
  };

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string;
  };

  export type AccountUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          AccountCreateWithoutUserInput,
          AccountUncheckedCreateWithoutUserInput
        >
      | AccountCreateWithoutUserInput[]
      | AccountUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | AccountCreateOrConnectWithoutUserInput
      | AccountCreateOrConnectWithoutUserInput[];
    upsert?:
      | AccountUpsertWithWhereUniqueWithoutUserInput
      | AccountUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: AccountCreateManyUserInputEnvelope;
    set?: AccountWhereUniqueInput | AccountWhereUniqueInput[];
    disconnect?: AccountWhereUniqueInput | AccountWhereUniqueInput[];
    delete?: AccountWhereUniqueInput | AccountWhereUniqueInput[];
    connect?: AccountWhereUniqueInput | AccountWhereUniqueInput[];
    update?:
      | AccountUpdateWithWhereUniqueWithoutUserInput
      | AccountUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | AccountUpdateManyWithWhereWithoutUserInput
      | AccountUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: AccountScalarWhereInput | AccountScalarWhereInput[];
  };

  export type SessionUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          SessionCreateWithoutUserInput,
          SessionUncheckedCreateWithoutUserInput
        >
      | SessionCreateWithoutUserInput[]
      | SessionUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | SessionCreateOrConnectWithoutUserInput
      | SessionCreateOrConnectWithoutUserInput[];
    upsert?:
      | SessionUpsertWithWhereUniqueWithoutUserInput
      | SessionUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: SessionCreateManyUserInputEnvelope;
    set?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    disconnect?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    delete?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    update?:
      | SessionUpdateWithWhereUniqueWithoutUserInput
      | SessionUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | SessionUpdateManyWithWhereWithoutUserInput
      | SessionUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: SessionScalarWhereInput | SessionScalarWhereInput[];
  };

  export type OrganizationMemberUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          OrganizationMemberCreateWithoutUserInput,
          OrganizationMemberUncheckedCreateWithoutUserInput
        >
      | OrganizationMemberCreateWithoutUserInput[]
      | OrganizationMemberUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | OrganizationMemberCreateOrConnectWithoutUserInput
      | OrganizationMemberCreateOrConnectWithoutUserInput[];
    upsert?:
      | OrganizationMemberUpsertWithWhereUniqueWithoutUserInput
      | OrganizationMemberUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: OrganizationMemberCreateManyUserInputEnvelope;
    set?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
    disconnect?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
    delete?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
    connect?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
    update?:
      | OrganizationMemberUpdateWithWhereUniqueWithoutUserInput
      | OrganizationMemberUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | OrganizationMemberUpdateManyWithWhereWithoutUserInput
      | OrganizationMemberUpdateManyWithWhereWithoutUserInput[];
    deleteMany?:
      | OrganizationMemberScalarWhereInput
      | OrganizationMemberScalarWhereInput[];
  };

  export type AuditLogUpdateManyWithoutActorNestedInput = {
    create?:
      | XOR<
          AuditLogCreateWithoutActorInput,
          AuditLogUncheckedCreateWithoutActorInput
        >
      | AuditLogCreateWithoutActorInput[]
      | AuditLogUncheckedCreateWithoutActorInput[];
    connectOrCreate?:
      | AuditLogCreateOrConnectWithoutActorInput
      | AuditLogCreateOrConnectWithoutActorInput[];
    upsert?:
      | AuditLogUpsertWithWhereUniqueWithoutActorInput
      | AuditLogUpsertWithWhereUniqueWithoutActorInput[];
    createMany?: AuditLogCreateManyActorInputEnvelope;
    set?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    disconnect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    delete?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    connect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    update?:
      | AuditLogUpdateWithWhereUniqueWithoutActorInput
      | AuditLogUpdateWithWhereUniqueWithoutActorInput[];
    updateMany?:
      | AuditLogUpdateManyWithWhereWithoutActorInput
      | AuditLogUpdateManyWithWhereWithoutActorInput[];
    deleteMany?: AuditLogScalarWhereInput | AuditLogScalarWhereInput[];
  };

  export type AccountUncheckedUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          AccountCreateWithoutUserInput,
          AccountUncheckedCreateWithoutUserInput
        >
      | AccountCreateWithoutUserInput[]
      | AccountUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | AccountCreateOrConnectWithoutUserInput
      | AccountCreateOrConnectWithoutUserInput[];
    upsert?:
      | AccountUpsertWithWhereUniqueWithoutUserInput
      | AccountUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: AccountCreateManyUserInputEnvelope;
    set?: AccountWhereUniqueInput | AccountWhereUniqueInput[];
    disconnect?: AccountWhereUniqueInput | AccountWhereUniqueInput[];
    delete?: AccountWhereUniqueInput | AccountWhereUniqueInput[];
    connect?: AccountWhereUniqueInput | AccountWhereUniqueInput[];
    update?:
      | AccountUpdateWithWhereUniqueWithoutUserInput
      | AccountUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | AccountUpdateManyWithWhereWithoutUserInput
      | AccountUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: AccountScalarWhereInput | AccountScalarWhereInput[];
  };

  export type SessionUncheckedUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          SessionCreateWithoutUserInput,
          SessionUncheckedCreateWithoutUserInput
        >
      | SessionCreateWithoutUserInput[]
      | SessionUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | SessionCreateOrConnectWithoutUserInput
      | SessionCreateOrConnectWithoutUserInput[];
    upsert?:
      | SessionUpsertWithWhereUniqueWithoutUserInput
      | SessionUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: SessionCreateManyUserInputEnvelope;
    set?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    disconnect?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    delete?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    update?:
      | SessionUpdateWithWhereUniqueWithoutUserInput
      | SessionUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | SessionUpdateManyWithWhereWithoutUserInput
      | SessionUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: SessionScalarWhereInput | SessionScalarWhereInput[];
  };

  export type OrganizationMemberUncheckedUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          OrganizationMemberCreateWithoutUserInput,
          OrganizationMemberUncheckedCreateWithoutUserInput
        >
      | OrganizationMemberCreateWithoutUserInput[]
      | OrganizationMemberUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | OrganizationMemberCreateOrConnectWithoutUserInput
      | OrganizationMemberCreateOrConnectWithoutUserInput[];
    upsert?:
      | OrganizationMemberUpsertWithWhereUniqueWithoutUserInput
      | OrganizationMemberUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: OrganizationMemberCreateManyUserInputEnvelope;
    set?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
    disconnect?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
    delete?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
    connect?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
    update?:
      | OrganizationMemberUpdateWithWhereUniqueWithoutUserInput
      | OrganizationMemberUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | OrganizationMemberUpdateManyWithWhereWithoutUserInput
      | OrganizationMemberUpdateManyWithWhereWithoutUserInput[];
    deleteMany?:
      | OrganizationMemberScalarWhereInput
      | OrganizationMemberScalarWhereInput[];
  };

  export type AuditLogUncheckedUpdateManyWithoutActorNestedInput = {
    create?:
      | XOR<
          AuditLogCreateWithoutActorInput,
          AuditLogUncheckedCreateWithoutActorInput
        >
      | AuditLogCreateWithoutActorInput[]
      | AuditLogUncheckedCreateWithoutActorInput[];
    connectOrCreate?:
      | AuditLogCreateOrConnectWithoutActorInput
      | AuditLogCreateOrConnectWithoutActorInput[];
    upsert?:
      | AuditLogUpsertWithWhereUniqueWithoutActorInput
      | AuditLogUpsertWithWhereUniqueWithoutActorInput[];
    createMany?: AuditLogCreateManyActorInputEnvelope;
    set?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    disconnect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    delete?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    connect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    update?:
      | AuditLogUpdateWithWhereUniqueWithoutActorInput
      | AuditLogUpdateWithWhereUniqueWithoutActorInput[];
    updateMany?:
      | AuditLogUpdateManyWithWhereWithoutActorInput
      | AuditLogUpdateManyWithWhereWithoutActorInput[];
    deleteMany?: AuditLogScalarWhereInput | AuditLogScalarWhereInput[];
  };

  export type UserCreateNestedOneWithoutAccountsInput = {
    create?: XOR<
      UserCreateWithoutAccountsInput,
      UserUncheckedCreateWithoutAccountsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutAccountsInput;
    connect?: UserWhereUniqueInput;
  };

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
  };

  export type UserUpdateOneRequiredWithoutAccountsNestedInput = {
    create?: XOR<
      UserCreateWithoutAccountsInput,
      UserUncheckedCreateWithoutAccountsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutAccountsInput;
    upsert?: UserUpsertWithoutAccountsInput;
    connect?: UserWhereUniqueInput;
    update?: XOR<
      XOR<
        UserUpdateToOneWithWhereWithoutAccountsInput,
        UserUpdateWithoutAccountsInput
      >,
      UserUncheckedUpdateWithoutAccountsInput
    >;
  };

  export type UserCreateNestedOneWithoutSessionsInput = {
    create?: XOR<
      UserCreateWithoutSessionsInput,
      UserUncheckedCreateWithoutSessionsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutSessionsInput;
    connect?: UserWhereUniqueInput;
  };

  export type OrganizationCreateNestedOneWithoutSessionsInput = {
    create?: XOR<
      OrganizationCreateWithoutSessionsInput,
      OrganizationUncheckedCreateWithoutSessionsInput
    >;
    connectOrCreate?: OrganizationCreateOrConnectWithoutSessionsInput;
    connect?: OrganizationWhereUniqueInput;
  };

  export type UserUpdateOneRequiredWithoutSessionsNestedInput = {
    create?: XOR<
      UserCreateWithoutSessionsInput,
      UserUncheckedCreateWithoutSessionsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutSessionsInput;
    upsert?: UserUpsertWithoutSessionsInput;
    connect?: UserWhereUniqueInput;
    update?: XOR<
      XOR<
        UserUpdateToOneWithWhereWithoutSessionsInput,
        UserUpdateWithoutSessionsInput
      >,
      UserUncheckedUpdateWithoutSessionsInput
    >;
  };

  export type OrganizationUpdateOneWithoutSessionsNestedInput = {
    create?: XOR<
      OrganizationCreateWithoutSessionsInput,
      OrganizationUncheckedCreateWithoutSessionsInput
    >;
    connectOrCreate?: OrganizationCreateOrConnectWithoutSessionsInput;
    upsert?: OrganizationUpsertWithoutSessionsInput;
    disconnect?: OrganizationWhereInput | boolean;
    delete?: OrganizationWhereInput | boolean;
    connect?: OrganizationWhereUniqueInput;
    update?: XOR<
      XOR<
        OrganizationUpdateToOneWithWhereWithoutSessionsInput,
        OrganizationUpdateWithoutSessionsInput
      >,
      OrganizationUncheckedUpdateWithoutSessionsInput
    >;
  };

  export type OrganizationMemberCreateNestedManyWithoutOrganizationInput = {
    create?:
      | XOR<
          OrganizationMemberCreateWithoutOrganizationInput,
          OrganizationMemberUncheckedCreateWithoutOrganizationInput
        >
      | OrganizationMemberCreateWithoutOrganizationInput[]
      | OrganizationMemberUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | OrganizationMemberCreateOrConnectWithoutOrganizationInput
      | OrganizationMemberCreateOrConnectWithoutOrganizationInput[];
    createMany?: OrganizationMemberCreateManyOrganizationInputEnvelope;
    connect?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
  };

  export type AuditLogCreateNestedManyWithoutOrganizationInput = {
    create?:
      | XOR<
          AuditLogCreateWithoutOrganizationInput,
          AuditLogUncheckedCreateWithoutOrganizationInput
        >
      | AuditLogCreateWithoutOrganizationInput[]
      | AuditLogUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | AuditLogCreateOrConnectWithoutOrganizationInput
      | AuditLogCreateOrConnectWithoutOrganizationInput[];
    createMany?: AuditLogCreateManyOrganizationInputEnvelope;
    connect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
  };

  export type FeatureFlagCreateNestedManyWithoutOrganizationInput = {
    create?:
      | XOR<
          FeatureFlagCreateWithoutOrganizationInput,
          FeatureFlagUncheckedCreateWithoutOrganizationInput
        >
      | FeatureFlagCreateWithoutOrganizationInput[]
      | FeatureFlagUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | FeatureFlagCreateOrConnectWithoutOrganizationInput
      | FeatureFlagCreateOrConnectWithoutOrganizationInput[];
    createMany?: FeatureFlagCreateManyOrganizationInputEnvelope;
    connect?: FeatureFlagWhereUniqueInput | FeatureFlagWhereUniqueInput[];
  };

  export type VolunteerApplicationCreateNestedManyWithoutOrganizationInput = {
    create?:
      | XOR<
          VolunteerApplicationCreateWithoutOrganizationInput,
          VolunteerApplicationUncheckedCreateWithoutOrganizationInput
        >
      | VolunteerApplicationCreateWithoutOrganizationInput[]
      | VolunteerApplicationUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | VolunteerApplicationCreateOrConnectWithoutOrganizationInput
      | VolunteerApplicationCreateOrConnectWithoutOrganizationInput[];
    createMany?: VolunteerApplicationCreateManyOrganizationInputEnvelope;
    connect?:
      | VolunteerApplicationWhereUniqueInput
      | VolunteerApplicationWhereUniqueInput[];
  };

  export type ScreenerQuestionCreateNestedManyWithoutOrganizationInput = {
    create?:
      | XOR<
          ScreenerQuestionCreateWithoutOrganizationInput,
          ScreenerQuestionUncheckedCreateWithoutOrganizationInput
        >
      | ScreenerQuestionCreateWithoutOrganizationInput[]
      | ScreenerQuestionUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | ScreenerQuestionCreateOrConnectWithoutOrganizationInput
      | ScreenerQuestionCreateOrConnectWithoutOrganizationInput[];
    createMany?: ScreenerQuestionCreateManyOrganizationInputEnvelope;
    connect?:
      | ScreenerQuestionWhereUniqueInput
      | ScreenerQuestionWhereUniqueInput[];
  };

  export type SessionCreateNestedManyWithoutCurrentOrgInput = {
    create?:
      | XOR<
          SessionCreateWithoutCurrentOrgInput,
          SessionUncheckedCreateWithoutCurrentOrgInput
        >
      | SessionCreateWithoutCurrentOrgInput[]
      | SessionUncheckedCreateWithoutCurrentOrgInput[];
    connectOrCreate?:
      | SessionCreateOrConnectWithoutCurrentOrgInput
      | SessionCreateOrConnectWithoutCurrentOrgInput[];
    createMany?: SessionCreateManyCurrentOrgInputEnvelope;
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
  };

  export type OrganizationMemberUncheckedCreateNestedManyWithoutOrganizationInput =
    {
      create?:
        | XOR<
            OrganizationMemberCreateWithoutOrganizationInput,
            OrganizationMemberUncheckedCreateWithoutOrganizationInput
          >
        | OrganizationMemberCreateWithoutOrganizationInput[]
        | OrganizationMemberUncheckedCreateWithoutOrganizationInput[];
      connectOrCreate?:
        | OrganizationMemberCreateOrConnectWithoutOrganizationInput
        | OrganizationMemberCreateOrConnectWithoutOrganizationInput[];
      createMany?: OrganizationMemberCreateManyOrganizationInputEnvelope;
      connect?:
        | OrganizationMemberWhereUniqueInput
        | OrganizationMemberWhereUniqueInput[];
    };

  export type AuditLogUncheckedCreateNestedManyWithoutOrganizationInput = {
    create?:
      | XOR<
          AuditLogCreateWithoutOrganizationInput,
          AuditLogUncheckedCreateWithoutOrganizationInput
        >
      | AuditLogCreateWithoutOrganizationInput[]
      | AuditLogUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | AuditLogCreateOrConnectWithoutOrganizationInput
      | AuditLogCreateOrConnectWithoutOrganizationInput[];
    createMany?: AuditLogCreateManyOrganizationInputEnvelope;
    connect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
  };

  export type FeatureFlagUncheckedCreateNestedManyWithoutOrganizationInput = {
    create?:
      | XOR<
          FeatureFlagCreateWithoutOrganizationInput,
          FeatureFlagUncheckedCreateWithoutOrganizationInput
        >
      | FeatureFlagCreateWithoutOrganizationInput[]
      | FeatureFlagUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | FeatureFlagCreateOrConnectWithoutOrganizationInput
      | FeatureFlagCreateOrConnectWithoutOrganizationInput[];
    createMany?: FeatureFlagCreateManyOrganizationInputEnvelope;
    connect?: FeatureFlagWhereUniqueInput | FeatureFlagWhereUniqueInput[];
  };

  export type VolunteerApplicationUncheckedCreateNestedManyWithoutOrganizationInput =
    {
      create?:
        | XOR<
            VolunteerApplicationCreateWithoutOrganizationInput,
            VolunteerApplicationUncheckedCreateWithoutOrganizationInput
          >
        | VolunteerApplicationCreateWithoutOrganizationInput[]
        | VolunteerApplicationUncheckedCreateWithoutOrganizationInput[];
      connectOrCreate?:
        | VolunteerApplicationCreateOrConnectWithoutOrganizationInput
        | VolunteerApplicationCreateOrConnectWithoutOrganizationInput[];
      createMany?: VolunteerApplicationCreateManyOrganizationInputEnvelope;
      connect?:
        | VolunteerApplicationWhereUniqueInput
        | VolunteerApplicationWhereUniqueInput[];
    };

  export type ScreenerQuestionUncheckedCreateNestedManyWithoutOrganizationInput =
    {
      create?:
        | XOR<
            ScreenerQuestionCreateWithoutOrganizationInput,
            ScreenerQuestionUncheckedCreateWithoutOrganizationInput
          >
        | ScreenerQuestionCreateWithoutOrganizationInput[]
        | ScreenerQuestionUncheckedCreateWithoutOrganizationInput[];
      connectOrCreate?:
        | ScreenerQuestionCreateOrConnectWithoutOrganizationInput
        | ScreenerQuestionCreateOrConnectWithoutOrganizationInput[];
      createMany?: ScreenerQuestionCreateManyOrganizationInputEnvelope;
      connect?:
        | ScreenerQuestionWhereUniqueInput
        | ScreenerQuestionWhereUniqueInput[];
    };

  export type SessionUncheckedCreateNestedManyWithoutCurrentOrgInput = {
    create?:
      | XOR<
          SessionCreateWithoutCurrentOrgInput,
          SessionUncheckedCreateWithoutCurrentOrgInput
        >
      | SessionCreateWithoutCurrentOrgInput[]
      | SessionUncheckedCreateWithoutCurrentOrgInput[];
    connectOrCreate?:
      | SessionCreateOrConnectWithoutCurrentOrgInput
      | SessionCreateOrConnectWithoutCurrentOrgInput[];
    createMany?: SessionCreateManyCurrentOrgInputEnvelope;
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
  };

  export type OrganizationMemberUpdateManyWithoutOrganizationNestedInput = {
    create?:
      | XOR<
          OrganizationMemberCreateWithoutOrganizationInput,
          OrganizationMemberUncheckedCreateWithoutOrganizationInput
        >
      | OrganizationMemberCreateWithoutOrganizationInput[]
      | OrganizationMemberUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | OrganizationMemberCreateOrConnectWithoutOrganizationInput
      | OrganizationMemberCreateOrConnectWithoutOrganizationInput[];
    upsert?:
      | OrganizationMemberUpsertWithWhereUniqueWithoutOrganizationInput
      | OrganizationMemberUpsertWithWhereUniqueWithoutOrganizationInput[];
    createMany?: OrganizationMemberCreateManyOrganizationInputEnvelope;
    set?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
    disconnect?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
    delete?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
    connect?:
      | OrganizationMemberWhereUniqueInput
      | OrganizationMemberWhereUniqueInput[];
    update?:
      | OrganizationMemberUpdateWithWhereUniqueWithoutOrganizationInput
      | OrganizationMemberUpdateWithWhereUniqueWithoutOrganizationInput[];
    updateMany?:
      | OrganizationMemberUpdateManyWithWhereWithoutOrganizationInput
      | OrganizationMemberUpdateManyWithWhereWithoutOrganizationInput[];
    deleteMany?:
      | OrganizationMemberScalarWhereInput
      | OrganizationMemberScalarWhereInput[];
  };

  export type AuditLogUpdateManyWithoutOrganizationNestedInput = {
    create?:
      | XOR<
          AuditLogCreateWithoutOrganizationInput,
          AuditLogUncheckedCreateWithoutOrganizationInput
        >
      | AuditLogCreateWithoutOrganizationInput[]
      | AuditLogUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | AuditLogCreateOrConnectWithoutOrganizationInput
      | AuditLogCreateOrConnectWithoutOrganizationInput[];
    upsert?:
      | AuditLogUpsertWithWhereUniqueWithoutOrganizationInput
      | AuditLogUpsertWithWhereUniqueWithoutOrganizationInput[];
    createMany?: AuditLogCreateManyOrganizationInputEnvelope;
    set?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    disconnect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    delete?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    connect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    update?:
      | AuditLogUpdateWithWhereUniqueWithoutOrganizationInput
      | AuditLogUpdateWithWhereUniqueWithoutOrganizationInput[];
    updateMany?:
      | AuditLogUpdateManyWithWhereWithoutOrganizationInput
      | AuditLogUpdateManyWithWhereWithoutOrganizationInput[];
    deleteMany?: AuditLogScalarWhereInput | AuditLogScalarWhereInput[];
  };

  export type FeatureFlagUpdateManyWithoutOrganizationNestedInput = {
    create?:
      | XOR<
          FeatureFlagCreateWithoutOrganizationInput,
          FeatureFlagUncheckedCreateWithoutOrganizationInput
        >
      | FeatureFlagCreateWithoutOrganizationInput[]
      | FeatureFlagUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | FeatureFlagCreateOrConnectWithoutOrganizationInput
      | FeatureFlagCreateOrConnectWithoutOrganizationInput[];
    upsert?:
      | FeatureFlagUpsertWithWhereUniqueWithoutOrganizationInput
      | FeatureFlagUpsertWithWhereUniqueWithoutOrganizationInput[];
    createMany?: FeatureFlagCreateManyOrganizationInputEnvelope;
    set?: FeatureFlagWhereUniqueInput | FeatureFlagWhereUniqueInput[];
    disconnect?: FeatureFlagWhereUniqueInput | FeatureFlagWhereUniqueInput[];
    delete?: FeatureFlagWhereUniqueInput | FeatureFlagWhereUniqueInput[];
    connect?: FeatureFlagWhereUniqueInput | FeatureFlagWhereUniqueInput[];
    update?:
      | FeatureFlagUpdateWithWhereUniqueWithoutOrganizationInput
      | FeatureFlagUpdateWithWhereUniqueWithoutOrganizationInput[];
    updateMany?:
      | FeatureFlagUpdateManyWithWhereWithoutOrganizationInput
      | FeatureFlagUpdateManyWithWhereWithoutOrganizationInput[];
    deleteMany?: FeatureFlagScalarWhereInput | FeatureFlagScalarWhereInput[];
  };

  export type VolunteerApplicationUpdateManyWithoutOrganizationNestedInput = {
    create?:
      | XOR<
          VolunteerApplicationCreateWithoutOrganizationInput,
          VolunteerApplicationUncheckedCreateWithoutOrganizationInput
        >
      | VolunteerApplicationCreateWithoutOrganizationInput[]
      | VolunteerApplicationUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | VolunteerApplicationCreateOrConnectWithoutOrganizationInput
      | VolunteerApplicationCreateOrConnectWithoutOrganizationInput[];
    upsert?:
      | VolunteerApplicationUpsertWithWhereUniqueWithoutOrganizationInput
      | VolunteerApplicationUpsertWithWhereUniqueWithoutOrganizationInput[];
    createMany?: VolunteerApplicationCreateManyOrganizationInputEnvelope;
    set?:
      | VolunteerApplicationWhereUniqueInput
      | VolunteerApplicationWhereUniqueInput[];
    disconnect?:
      | VolunteerApplicationWhereUniqueInput
      | VolunteerApplicationWhereUniqueInput[];
    delete?:
      | VolunteerApplicationWhereUniqueInput
      | VolunteerApplicationWhereUniqueInput[];
    connect?:
      | VolunteerApplicationWhereUniqueInput
      | VolunteerApplicationWhereUniqueInput[];
    update?:
      | VolunteerApplicationUpdateWithWhereUniqueWithoutOrganizationInput
      | VolunteerApplicationUpdateWithWhereUniqueWithoutOrganizationInput[];
    updateMany?:
      | VolunteerApplicationUpdateManyWithWhereWithoutOrganizationInput
      | VolunteerApplicationUpdateManyWithWhereWithoutOrganizationInput[];
    deleteMany?:
      | VolunteerApplicationScalarWhereInput
      | VolunteerApplicationScalarWhereInput[];
  };

  export type ScreenerQuestionUpdateManyWithoutOrganizationNestedInput = {
    create?:
      | XOR<
          ScreenerQuestionCreateWithoutOrganizationInput,
          ScreenerQuestionUncheckedCreateWithoutOrganizationInput
        >
      | ScreenerQuestionCreateWithoutOrganizationInput[]
      | ScreenerQuestionUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | ScreenerQuestionCreateOrConnectWithoutOrganizationInput
      | ScreenerQuestionCreateOrConnectWithoutOrganizationInput[];
    upsert?:
      | ScreenerQuestionUpsertWithWhereUniqueWithoutOrganizationInput
      | ScreenerQuestionUpsertWithWhereUniqueWithoutOrganizationInput[];
    createMany?: ScreenerQuestionCreateManyOrganizationInputEnvelope;
    set?: ScreenerQuestionWhereUniqueInput | ScreenerQuestionWhereUniqueInput[];
    disconnect?:
      | ScreenerQuestionWhereUniqueInput
      | ScreenerQuestionWhereUniqueInput[];
    delete?:
      | ScreenerQuestionWhereUniqueInput
      | ScreenerQuestionWhereUniqueInput[];
    connect?:
      | ScreenerQuestionWhereUniqueInput
      | ScreenerQuestionWhereUniqueInput[];
    update?:
      | ScreenerQuestionUpdateWithWhereUniqueWithoutOrganizationInput
      | ScreenerQuestionUpdateWithWhereUniqueWithoutOrganizationInput[];
    updateMany?:
      | ScreenerQuestionUpdateManyWithWhereWithoutOrganizationInput
      | ScreenerQuestionUpdateManyWithWhereWithoutOrganizationInput[];
    deleteMany?:
      | ScreenerQuestionScalarWhereInput
      | ScreenerQuestionScalarWhereInput[];
  };

  export type SessionUpdateManyWithoutCurrentOrgNestedInput = {
    create?:
      | XOR<
          SessionCreateWithoutCurrentOrgInput,
          SessionUncheckedCreateWithoutCurrentOrgInput
        >
      | SessionCreateWithoutCurrentOrgInput[]
      | SessionUncheckedCreateWithoutCurrentOrgInput[];
    connectOrCreate?:
      | SessionCreateOrConnectWithoutCurrentOrgInput
      | SessionCreateOrConnectWithoutCurrentOrgInput[];
    upsert?:
      | SessionUpsertWithWhereUniqueWithoutCurrentOrgInput
      | SessionUpsertWithWhereUniqueWithoutCurrentOrgInput[];
    createMany?: SessionCreateManyCurrentOrgInputEnvelope;
    set?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    disconnect?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    delete?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    update?:
      | SessionUpdateWithWhereUniqueWithoutCurrentOrgInput
      | SessionUpdateWithWhereUniqueWithoutCurrentOrgInput[];
    updateMany?:
      | SessionUpdateManyWithWhereWithoutCurrentOrgInput
      | SessionUpdateManyWithWhereWithoutCurrentOrgInput[];
    deleteMany?: SessionScalarWhereInput | SessionScalarWhereInput[];
  };

  export type OrganizationMemberUncheckedUpdateManyWithoutOrganizationNestedInput =
    {
      create?:
        | XOR<
            OrganizationMemberCreateWithoutOrganizationInput,
            OrganizationMemberUncheckedCreateWithoutOrganizationInput
          >
        | OrganizationMemberCreateWithoutOrganizationInput[]
        | OrganizationMemberUncheckedCreateWithoutOrganizationInput[];
      connectOrCreate?:
        | OrganizationMemberCreateOrConnectWithoutOrganizationInput
        | OrganizationMemberCreateOrConnectWithoutOrganizationInput[];
      upsert?:
        | OrganizationMemberUpsertWithWhereUniqueWithoutOrganizationInput
        | OrganizationMemberUpsertWithWhereUniqueWithoutOrganizationInput[];
      createMany?: OrganizationMemberCreateManyOrganizationInputEnvelope;
      set?:
        | OrganizationMemberWhereUniqueInput
        | OrganizationMemberWhereUniqueInput[];
      disconnect?:
        | OrganizationMemberWhereUniqueInput
        | OrganizationMemberWhereUniqueInput[];
      delete?:
        | OrganizationMemberWhereUniqueInput
        | OrganizationMemberWhereUniqueInput[];
      connect?:
        | OrganizationMemberWhereUniqueInput
        | OrganizationMemberWhereUniqueInput[];
      update?:
        | OrganizationMemberUpdateWithWhereUniqueWithoutOrganizationInput
        | OrganizationMemberUpdateWithWhereUniqueWithoutOrganizationInput[];
      updateMany?:
        | OrganizationMemberUpdateManyWithWhereWithoutOrganizationInput
        | OrganizationMemberUpdateManyWithWhereWithoutOrganizationInput[];
      deleteMany?:
        | OrganizationMemberScalarWhereInput
        | OrganizationMemberScalarWhereInput[];
    };

  export type AuditLogUncheckedUpdateManyWithoutOrganizationNestedInput = {
    create?:
      | XOR<
          AuditLogCreateWithoutOrganizationInput,
          AuditLogUncheckedCreateWithoutOrganizationInput
        >
      | AuditLogCreateWithoutOrganizationInput[]
      | AuditLogUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | AuditLogCreateOrConnectWithoutOrganizationInput
      | AuditLogCreateOrConnectWithoutOrganizationInput[];
    upsert?:
      | AuditLogUpsertWithWhereUniqueWithoutOrganizationInput
      | AuditLogUpsertWithWhereUniqueWithoutOrganizationInput[];
    createMany?: AuditLogCreateManyOrganizationInputEnvelope;
    set?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    disconnect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    delete?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    connect?: AuditLogWhereUniqueInput | AuditLogWhereUniqueInput[];
    update?:
      | AuditLogUpdateWithWhereUniqueWithoutOrganizationInput
      | AuditLogUpdateWithWhereUniqueWithoutOrganizationInput[];
    updateMany?:
      | AuditLogUpdateManyWithWhereWithoutOrganizationInput
      | AuditLogUpdateManyWithWhereWithoutOrganizationInput[];
    deleteMany?: AuditLogScalarWhereInput | AuditLogScalarWhereInput[];
  };

  export type FeatureFlagUncheckedUpdateManyWithoutOrganizationNestedInput = {
    create?:
      | XOR<
          FeatureFlagCreateWithoutOrganizationInput,
          FeatureFlagUncheckedCreateWithoutOrganizationInput
        >
      | FeatureFlagCreateWithoutOrganizationInput[]
      | FeatureFlagUncheckedCreateWithoutOrganizationInput[];
    connectOrCreate?:
      | FeatureFlagCreateOrConnectWithoutOrganizationInput
      | FeatureFlagCreateOrConnectWithoutOrganizationInput[];
    upsert?:
      | FeatureFlagUpsertWithWhereUniqueWithoutOrganizationInput
      | FeatureFlagUpsertWithWhereUniqueWithoutOrganizationInput[];
    createMany?: FeatureFlagCreateManyOrganizationInputEnvelope;
    set?: FeatureFlagWhereUniqueInput | FeatureFlagWhereUniqueInput[];
    disconnect?: FeatureFlagWhereUniqueInput | FeatureFlagWhereUniqueInput[];
    delete?: FeatureFlagWhereUniqueInput | FeatureFlagWhereUniqueInput[];
    connect?: FeatureFlagWhereUniqueInput | FeatureFlagWhereUniqueInput[];
    update?:
      | FeatureFlagUpdateWithWhereUniqueWithoutOrganizationInput
      | FeatureFlagUpdateWithWhereUniqueWithoutOrganizationInput[];
    updateMany?:
      | FeatureFlagUpdateManyWithWhereWithoutOrganizationInput
      | FeatureFlagUpdateManyWithWhereWithoutOrganizationInput[];
    deleteMany?: FeatureFlagScalarWhereInput | FeatureFlagScalarWhereInput[];
  };

  export type VolunteerApplicationUncheckedUpdateManyWithoutOrganizationNestedInput =
    {
      create?:
        | XOR<
            VolunteerApplicationCreateWithoutOrganizationInput,
            VolunteerApplicationUncheckedCreateWithoutOrganizationInput
          >
        | VolunteerApplicationCreateWithoutOrganizationInput[]
        | VolunteerApplicationUncheckedCreateWithoutOrganizationInput[];
      connectOrCreate?:
        | VolunteerApplicationCreateOrConnectWithoutOrganizationInput
        | VolunteerApplicationCreateOrConnectWithoutOrganizationInput[];
      upsert?:
        | VolunteerApplicationUpsertWithWhereUniqueWithoutOrganizationInput
        | VolunteerApplicationUpsertWithWhereUniqueWithoutOrganizationInput[];
      createMany?: VolunteerApplicationCreateManyOrganizationInputEnvelope;
      set?:
        | VolunteerApplicationWhereUniqueInput
        | VolunteerApplicationWhereUniqueInput[];
      disconnect?:
        | VolunteerApplicationWhereUniqueInput
        | VolunteerApplicationWhereUniqueInput[];
      delete?:
        | VolunteerApplicationWhereUniqueInput
        | VolunteerApplicationWhereUniqueInput[];
      connect?:
        | VolunteerApplicationWhereUniqueInput
        | VolunteerApplicationWhereUniqueInput[];
      update?:
        | VolunteerApplicationUpdateWithWhereUniqueWithoutOrganizationInput
        | VolunteerApplicationUpdateWithWhereUniqueWithoutOrganizationInput[];
      updateMany?:
        | VolunteerApplicationUpdateManyWithWhereWithoutOrganizationInput
        | VolunteerApplicationUpdateManyWithWhereWithoutOrganizationInput[];
      deleteMany?:
        | VolunteerApplicationScalarWhereInput
        | VolunteerApplicationScalarWhereInput[];
    };

  export type ScreenerQuestionUncheckedUpdateManyWithoutOrganizationNestedInput =
    {
      create?:
        | XOR<
            ScreenerQuestionCreateWithoutOrganizationInput,
            ScreenerQuestionUncheckedCreateWithoutOrganizationInput
          >
        | ScreenerQuestionCreateWithoutOrganizationInput[]
        | ScreenerQuestionUncheckedCreateWithoutOrganizationInput[];
      connectOrCreate?:
        | ScreenerQuestionCreateOrConnectWithoutOrganizationInput
        | ScreenerQuestionCreateOrConnectWithoutOrganizationInput[];
      upsert?:
        | ScreenerQuestionUpsertWithWhereUniqueWithoutOrganizationInput
        | ScreenerQuestionUpsertWithWhereUniqueWithoutOrganizationInput[];
      createMany?: ScreenerQuestionCreateManyOrganizationInputEnvelope;
      set?:
        | ScreenerQuestionWhereUniqueInput
        | ScreenerQuestionWhereUniqueInput[];
      disconnect?:
        | ScreenerQuestionWhereUniqueInput
        | ScreenerQuestionWhereUniqueInput[];
      delete?:
        | ScreenerQuestionWhereUniqueInput
        | ScreenerQuestionWhereUniqueInput[];
      connect?:
        | ScreenerQuestionWhereUniqueInput
        | ScreenerQuestionWhereUniqueInput[];
      update?:
        | ScreenerQuestionUpdateWithWhereUniqueWithoutOrganizationInput
        | ScreenerQuestionUpdateWithWhereUniqueWithoutOrganizationInput[];
      updateMany?:
        | ScreenerQuestionUpdateManyWithWhereWithoutOrganizationInput
        | ScreenerQuestionUpdateManyWithWhereWithoutOrganizationInput[];
      deleteMany?:
        | ScreenerQuestionScalarWhereInput
        | ScreenerQuestionScalarWhereInput[];
    };

  export type SessionUncheckedUpdateManyWithoutCurrentOrgNestedInput = {
    create?:
      | XOR<
          SessionCreateWithoutCurrentOrgInput,
          SessionUncheckedCreateWithoutCurrentOrgInput
        >
      | SessionCreateWithoutCurrentOrgInput[]
      | SessionUncheckedCreateWithoutCurrentOrgInput[];
    connectOrCreate?:
      | SessionCreateOrConnectWithoutCurrentOrgInput
      | SessionCreateOrConnectWithoutCurrentOrgInput[];
    upsert?:
      | SessionUpsertWithWhereUniqueWithoutCurrentOrgInput
      | SessionUpsertWithWhereUniqueWithoutCurrentOrgInput[];
    createMany?: SessionCreateManyCurrentOrgInputEnvelope;
    set?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    disconnect?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    delete?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[];
    update?:
      | SessionUpdateWithWhereUniqueWithoutCurrentOrgInput
      | SessionUpdateWithWhereUniqueWithoutCurrentOrgInput[];
    updateMany?:
      | SessionUpdateManyWithWhereWithoutCurrentOrgInput
      | SessionUpdateManyWithWhereWithoutCurrentOrgInput[];
    deleteMany?: SessionScalarWhereInput | SessionScalarWhereInput[];
  };

  export type OrganizationCreateNestedOneWithoutMembersInput = {
    create?: XOR<
      OrganizationCreateWithoutMembersInput,
      OrganizationUncheckedCreateWithoutMembersInput
    >;
    connectOrCreate?: OrganizationCreateOrConnectWithoutMembersInput;
    connect?: OrganizationWhereUniqueInput;
  };

  export type UserCreateNestedOneWithoutMembershipsInput = {
    create?: XOR<
      UserCreateWithoutMembershipsInput,
      UserUncheckedCreateWithoutMembershipsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutMembershipsInput;
    connect?: UserWhereUniqueInput;
  };

  export type EnumRoleFieldUpdateOperationsInput = {
    set?: $Enums.Role;
  };

  export type OrganizationUpdateOneRequiredWithoutMembersNestedInput = {
    create?: XOR<
      OrganizationCreateWithoutMembersInput,
      OrganizationUncheckedCreateWithoutMembersInput
    >;
    connectOrCreate?: OrganizationCreateOrConnectWithoutMembersInput;
    upsert?: OrganizationUpsertWithoutMembersInput;
    connect?: OrganizationWhereUniqueInput;
    update?: XOR<
      XOR<
        OrganizationUpdateToOneWithWhereWithoutMembersInput,
        OrganizationUpdateWithoutMembersInput
      >,
      OrganizationUncheckedUpdateWithoutMembersInput
    >;
  };

  export type UserUpdateOneRequiredWithoutMembershipsNestedInput = {
    create?: XOR<
      UserCreateWithoutMembershipsInput,
      UserUncheckedCreateWithoutMembershipsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutMembershipsInput;
    upsert?: UserUpsertWithoutMembershipsInput;
    connect?: UserWhereUniqueInput;
    update?: XOR<
      XOR<
        UserUpdateToOneWithWhereWithoutMembershipsInput,
        UserUpdateWithoutMembershipsInput
      >,
      UserUncheckedUpdateWithoutMembershipsInput
    >;
  };

  export type OrganizationCreateNestedOneWithoutAuditLogsInput = {
    create?: XOR<
      OrganizationCreateWithoutAuditLogsInput,
      OrganizationUncheckedCreateWithoutAuditLogsInput
    >;
    connectOrCreate?: OrganizationCreateOrConnectWithoutAuditLogsInput;
    connect?: OrganizationWhereUniqueInput;
  };

  export type UserCreateNestedOneWithoutAuditLogsInput = {
    create?: XOR<
      UserCreateWithoutAuditLogsInput,
      UserUncheckedCreateWithoutAuditLogsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutAuditLogsInput;
    connect?: UserWhereUniqueInput;
  };

  export type OrganizationUpdateOneRequiredWithoutAuditLogsNestedInput = {
    create?: XOR<
      OrganizationCreateWithoutAuditLogsInput,
      OrganizationUncheckedCreateWithoutAuditLogsInput
    >;
    connectOrCreate?: OrganizationCreateOrConnectWithoutAuditLogsInput;
    upsert?: OrganizationUpsertWithoutAuditLogsInput;
    connect?: OrganizationWhereUniqueInput;
    update?: XOR<
      XOR<
        OrganizationUpdateToOneWithWhereWithoutAuditLogsInput,
        OrganizationUpdateWithoutAuditLogsInput
      >,
      OrganizationUncheckedUpdateWithoutAuditLogsInput
    >;
  };

  export type UserUpdateOneWithoutAuditLogsNestedInput = {
    create?: XOR<
      UserCreateWithoutAuditLogsInput,
      UserUncheckedCreateWithoutAuditLogsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutAuditLogsInput;
    upsert?: UserUpsertWithoutAuditLogsInput;
    disconnect?: UserWhereInput | boolean;
    delete?: UserWhereInput | boolean;
    connect?: UserWhereUniqueInput;
    update?: XOR<
      XOR<
        UserUpdateToOneWithWhereWithoutAuditLogsInput,
        UserUpdateWithoutAuditLogsInput
      >,
      UserUncheckedUpdateWithoutAuditLogsInput
    >;
  };

  export type OrganizationCreateNestedOneWithoutFeatureFlagsInput = {
    create?: XOR<
      OrganizationCreateWithoutFeatureFlagsInput,
      OrganizationUncheckedCreateWithoutFeatureFlagsInput
    >;
    connectOrCreate?: OrganizationCreateOrConnectWithoutFeatureFlagsInput;
    connect?: OrganizationWhereUniqueInput;
  };

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean;
  };

  export type OrganizationUpdateOneRequiredWithoutFeatureFlagsNestedInput = {
    create?: XOR<
      OrganizationCreateWithoutFeatureFlagsInput,
      OrganizationUncheckedCreateWithoutFeatureFlagsInput
    >;
    connectOrCreate?: OrganizationCreateOrConnectWithoutFeatureFlagsInput;
    upsert?: OrganizationUpsertWithoutFeatureFlagsInput;
    connect?: OrganizationWhereUniqueInput;
    update?: XOR<
      XOR<
        OrganizationUpdateToOneWithWhereWithoutFeatureFlagsInput,
        OrganizationUpdateWithoutFeatureFlagsInput
      >,
      OrganizationUncheckedUpdateWithoutFeatureFlagsInput
    >;
  };

  export type OrganizationCreateNestedOneWithoutApplicationsInput = {
    create?: XOR<
      OrganizationCreateWithoutApplicationsInput,
      OrganizationUncheckedCreateWithoutApplicationsInput
    >;
    connectOrCreate?: OrganizationCreateOrConnectWithoutApplicationsInput;
    connect?: OrganizationWhereUniqueInput;
  };

  export type VolunteerAnswerCreateNestedManyWithoutApplicationInput = {
    create?:
      | XOR<
          VolunteerAnswerCreateWithoutApplicationInput,
          VolunteerAnswerUncheckedCreateWithoutApplicationInput
        >
      | VolunteerAnswerCreateWithoutApplicationInput[]
      | VolunteerAnswerUncheckedCreateWithoutApplicationInput[];
    connectOrCreate?:
      | VolunteerAnswerCreateOrConnectWithoutApplicationInput
      | VolunteerAnswerCreateOrConnectWithoutApplicationInput[];
    createMany?: VolunteerAnswerCreateManyApplicationInputEnvelope;
    connect?:
      | VolunteerAnswerWhereUniqueInput
      | VolunteerAnswerWhereUniqueInput[];
  };

  export type VolunteerAnswerUncheckedCreateNestedManyWithoutApplicationInput =
    {
      create?:
        | XOR<
            VolunteerAnswerCreateWithoutApplicationInput,
            VolunteerAnswerUncheckedCreateWithoutApplicationInput
          >
        | VolunteerAnswerCreateWithoutApplicationInput[]
        | VolunteerAnswerUncheckedCreateWithoutApplicationInput[];
      connectOrCreate?:
        | VolunteerAnswerCreateOrConnectWithoutApplicationInput
        | VolunteerAnswerCreateOrConnectWithoutApplicationInput[];
      createMany?: VolunteerAnswerCreateManyApplicationInputEnvelope;
      connect?:
        | VolunteerAnswerWhereUniqueInput
        | VolunteerAnswerWhereUniqueInput[];
    };

  export type EnumApplicationStatusFieldUpdateOperationsInput = {
    set?: $Enums.ApplicationStatus;
  };

  export type EnumScreeningStatusFieldUpdateOperationsInput = {
    set?: $Enums.ScreeningStatus;
  };

  export type OrganizationUpdateOneRequiredWithoutApplicationsNestedInput = {
    create?: XOR<
      OrganizationCreateWithoutApplicationsInput,
      OrganizationUncheckedCreateWithoutApplicationsInput
    >;
    connectOrCreate?: OrganizationCreateOrConnectWithoutApplicationsInput;
    upsert?: OrganizationUpsertWithoutApplicationsInput;
    connect?: OrganizationWhereUniqueInput;
    update?: XOR<
      XOR<
        OrganizationUpdateToOneWithWhereWithoutApplicationsInput,
        OrganizationUpdateWithoutApplicationsInput
      >,
      OrganizationUncheckedUpdateWithoutApplicationsInput
    >;
  };

  export type VolunteerAnswerUpdateManyWithoutApplicationNestedInput = {
    create?:
      | XOR<
          VolunteerAnswerCreateWithoutApplicationInput,
          VolunteerAnswerUncheckedCreateWithoutApplicationInput
        >
      | VolunteerAnswerCreateWithoutApplicationInput[]
      | VolunteerAnswerUncheckedCreateWithoutApplicationInput[];
    connectOrCreate?:
      | VolunteerAnswerCreateOrConnectWithoutApplicationInput
      | VolunteerAnswerCreateOrConnectWithoutApplicationInput[];
    upsert?:
      | VolunteerAnswerUpsertWithWhereUniqueWithoutApplicationInput
      | VolunteerAnswerUpsertWithWhereUniqueWithoutApplicationInput[];
    createMany?: VolunteerAnswerCreateManyApplicationInputEnvelope;
    set?: VolunteerAnswerWhereUniqueInput | VolunteerAnswerWhereUniqueInput[];
    disconnect?:
      | VolunteerAnswerWhereUniqueInput
      | VolunteerAnswerWhereUniqueInput[];
    delete?:
      | VolunteerAnswerWhereUniqueInput
      | VolunteerAnswerWhereUniqueInput[];
    connect?:
      | VolunteerAnswerWhereUniqueInput
      | VolunteerAnswerWhereUniqueInput[];
    update?:
      | VolunteerAnswerUpdateWithWhereUniqueWithoutApplicationInput
      | VolunteerAnswerUpdateWithWhereUniqueWithoutApplicationInput[];
    updateMany?:
      | VolunteerAnswerUpdateManyWithWhereWithoutApplicationInput
      | VolunteerAnswerUpdateManyWithWhereWithoutApplicationInput[];
    deleteMany?:
      | VolunteerAnswerScalarWhereInput
      | VolunteerAnswerScalarWhereInput[];
  };

  export type VolunteerAnswerUncheckedUpdateManyWithoutApplicationNestedInput =
    {
      create?:
        | XOR<
            VolunteerAnswerCreateWithoutApplicationInput,
            VolunteerAnswerUncheckedCreateWithoutApplicationInput
          >
        | VolunteerAnswerCreateWithoutApplicationInput[]
        | VolunteerAnswerUncheckedCreateWithoutApplicationInput[];
      connectOrCreate?:
        | VolunteerAnswerCreateOrConnectWithoutApplicationInput
        | VolunteerAnswerCreateOrConnectWithoutApplicationInput[];
      upsert?:
        | VolunteerAnswerUpsertWithWhereUniqueWithoutApplicationInput
        | VolunteerAnswerUpsertWithWhereUniqueWithoutApplicationInput[];
      createMany?: VolunteerAnswerCreateManyApplicationInputEnvelope;
      set?: VolunteerAnswerWhereUniqueInput | VolunteerAnswerWhereUniqueInput[];
      disconnect?:
        | VolunteerAnswerWhereUniqueInput
        | VolunteerAnswerWhereUniqueInput[];
      delete?:
        | VolunteerAnswerWhereUniqueInput
        | VolunteerAnswerWhereUniqueInput[];
      connect?:
        | VolunteerAnswerWhereUniqueInput
        | VolunteerAnswerWhereUniqueInput[];
      update?:
        | VolunteerAnswerUpdateWithWhereUniqueWithoutApplicationInput
        | VolunteerAnswerUpdateWithWhereUniqueWithoutApplicationInput[];
      updateMany?:
        | VolunteerAnswerUpdateManyWithWhereWithoutApplicationInput
        | VolunteerAnswerUpdateManyWithWhereWithoutApplicationInput[];
      deleteMany?:
        | VolunteerAnswerScalarWhereInput
        | VolunteerAnswerScalarWhereInput[];
    };

  export type VolunteerApplicationCreateNestedOneWithoutAnswersInput = {
    create?: XOR<
      VolunteerApplicationCreateWithoutAnswersInput,
      VolunteerApplicationUncheckedCreateWithoutAnswersInput
    >;
    connectOrCreate?: VolunteerApplicationCreateOrConnectWithoutAnswersInput;
    connect?: VolunteerApplicationWhereUniqueInput;
  };

  export type VolunteerApplicationUpdateOneRequiredWithoutAnswersNestedInput = {
    create?: XOR<
      VolunteerApplicationCreateWithoutAnswersInput,
      VolunteerApplicationUncheckedCreateWithoutAnswersInput
    >;
    connectOrCreate?: VolunteerApplicationCreateOrConnectWithoutAnswersInput;
    upsert?: VolunteerApplicationUpsertWithoutAnswersInput;
    connect?: VolunteerApplicationWhereUniqueInput;
    update?: XOR<
      XOR<
        VolunteerApplicationUpdateToOneWithWhereWithoutAnswersInput,
        VolunteerApplicationUpdateWithoutAnswersInput
      >,
      VolunteerApplicationUncheckedUpdateWithoutAnswersInput
    >;
  };

  export type OrganizationCreateNestedOneWithoutScreenerQuestionsInput = {
    create?: XOR<
      OrganizationCreateWithoutScreenerQuestionsInput,
      OrganizationUncheckedCreateWithoutScreenerQuestionsInput
    >;
    connectOrCreate?: OrganizationCreateOrConnectWithoutScreenerQuestionsInput;
    connect?: OrganizationWhereUniqueInput;
  };

  export type EnumScreenerQuestionTypeFieldUpdateOperationsInput = {
    set?: $Enums.ScreenerQuestionType;
  };

  export type IntFieldUpdateOperationsInput = {
    set?: number;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
  };

  export type OrganizationUpdateOneRequiredWithoutScreenerQuestionsNestedInput =
    {
      create?: XOR<
        OrganizationCreateWithoutScreenerQuestionsInput,
        OrganizationUncheckedCreateWithoutScreenerQuestionsInput
      >;
      connectOrCreate?: OrganizationCreateOrConnectWithoutScreenerQuestionsInput;
      upsert?: OrganizationUpsertWithoutScreenerQuestionsInput;
      connect?: OrganizationWhereUniqueInput;
      update?: XOR<
        XOR<
          OrganizationUpdateToOneWithWhereWithoutScreenerQuestionsInput,
          OrganizationUpdateWithoutScreenerQuestionsInput
        >,
        OrganizationUncheckedUpdateWithoutScreenerQuestionsInput
      >;
    };

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringFilter<$PrismaModel> | string;
  };

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringNullableFilter<$PrismaModel> | string | null;
  };

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null;
  };

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string;
  };

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedStringFilter<$PrismaModel>;
    _max?: NestedStringFilter<$PrismaModel>;
  };

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntFilter<$PrismaModel> | number;
  };

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?:
      | NestedStringNullableWithAggregatesFilter<$PrismaModel>
      | string
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedStringNullableFilter<$PrismaModel>;
    _max?: NestedStringNullableFilter<$PrismaModel>;
  };

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableFilter<$PrismaModel> | number | null;
  };

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> =
    {
      equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
      in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
      notIn?:
        | Date[]
        | string[]
        | ListDateTimeFieldRefInput<$PrismaModel>
        | null;
      lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
      lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
      gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
      gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
      not?:
        | NestedDateTimeNullableWithAggregatesFilter<$PrismaModel>
        | Date
        | string
        | null;
      _count?: NestedIntNullableFilter<$PrismaModel>;
      _min?: NestedDateTimeNullableFilter<$PrismaModel>;
      _max?: NestedDateTimeNullableFilter<$PrismaModel>;
    };

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedDateTimeFilter<$PrismaModel>;
    _max?: NestedDateTimeFilter<$PrismaModel>;
  };

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _avg?: NestedFloatNullableFilter<$PrismaModel>;
    _sum?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedIntNullableFilter<$PrismaModel>;
    _max?: NestedIntNullableFilter<$PrismaModel>;
  };

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null;
  };

  export type NestedEnumRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>;
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>;
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>;
    not?: NestedEnumRoleFilter<$PrismaModel> | $Enums.Role;
  };

  export type NestedEnumRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>;
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>;
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>;
    not?: NestedEnumRoleWithAggregatesFilter<$PrismaModel> | $Enums.Role;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumRoleFilter<$PrismaModel>;
    _max?: NestedEnumRoleFilter<$PrismaModel>;
  };
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<NestedJsonNullableFilterBase<$PrismaModel>>,
          Exclude<
            keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>,
            "path"
          >
        >,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<
        Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, "path">
      >;

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>;
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
  };

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolFilter<$PrismaModel> | boolean;
  };

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedBoolFilter<$PrismaModel>;
    _max?: NestedBoolFilter<$PrismaModel>;
  };

  export type NestedEnumApplicationStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.ApplicationStatus
      | EnumApplicationStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.ApplicationStatus[]
      | ListEnumApplicationStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.ApplicationStatus[]
      | ListEnumApplicationStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumApplicationStatusFilter<$PrismaModel>
      | $Enums.ApplicationStatus;
  };

  export type NestedEnumScreeningStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.ScreeningStatus
      | EnumScreeningStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.ScreeningStatus[]
      | ListEnumScreeningStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.ScreeningStatus[]
      | ListEnumScreeningStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumScreeningStatusFilter<$PrismaModel>
      | $Enums.ScreeningStatus;
  };

  export type NestedEnumApplicationStatusWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.ApplicationStatus
      | EnumApplicationStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.ApplicationStatus[]
      | ListEnumApplicationStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.ApplicationStatus[]
      | ListEnumApplicationStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumApplicationStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.ApplicationStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumApplicationStatusFilter<$PrismaModel>;
    _max?: NestedEnumApplicationStatusFilter<$PrismaModel>;
  };

  export type NestedEnumScreeningStatusWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.ScreeningStatus
      | EnumScreeningStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.ScreeningStatus[]
      | ListEnumScreeningStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.ScreeningStatus[]
      | ListEnumScreeningStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumScreeningStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.ScreeningStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumScreeningStatusFilter<$PrismaModel>;
    _max?: NestedEnumScreeningStatusFilter<$PrismaModel>;
  };
  export type NestedJsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<NestedJsonFilterBase<$PrismaModel>>,
          Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, "path">
        >,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, "path">>;

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>;
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
  };

  export type NestedEnumScreenerQuestionTypeFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.ScreenerQuestionType
      | EnumScreenerQuestionTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.ScreenerQuestionType[]
      | ListEnumScreenerQuestionTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.ScreenerQuestionType[]
      | ListEnumScreenerQuestionTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumScreenerQuestionTypeFilter<$PrismaModel>
      | $Enums.ScreenerQuestionType;
  };

  export type NestedEnumScreenerQuestionTypeWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.ScreenerQuestionType
      | EnumScreenerQuestionTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.ScreenerQuestionType[]
      | ListEnumScreenerQuestionTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.ScreenerQuestionType[]
      | ListEnumScreenerQuestionTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumScreenerQuestionTypeWithAggregatesFilter<$PrismaModel>
      | $Enums.ScreenerQuestionType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumScreenerQuestionTypeFilter<$PrismaModel>;
    _max?: NestedEnumScreenerQuestionTypeFilter<$PrismaModel>;
  };

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedFloatFilter<$PrismaModel>;
    _sum?: NestedIntFilter<$PrismaModel>;
    _min?: NestedIntFilter<$PrismaModel>;
    _max?: NestedIntFilter<$PrismaModel>;
  };

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>;
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatFilter<$PrismaModel> | number;
  };

  export type AccountCreateWithoutUserInput = {
    id?: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token?: string | null;
    access_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
    session_state?: string | null;
  };

  export type AccountUncheckedCreateWithoutUserInput = {
    id?: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token?: string | null;
    access_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
    session_state?: string | null;
  };

  export type AccountCreateOrConnectWithoutUserInput = {
    where: AccountWhereUniqueInput;
    create: XOR<
      AccountCreateWithoutUserInput,
      AccountUncheckedCreateWithoutUserInput
    >;
  };

  export type AccountCreateManyUserInputEnvelope = {
    data: AccountCreateManyUserInput | AccountCreateManyUserInput[];
    skipDuplicates?: boolean;
  };

  export type SessionCreateWithoutUserInput = {
    id?: string;
    sessionToken: string;
    expires: Date | string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    currentOrg?: OrganizationCreateNestedOneWithoutSessionsInput;
  };

  export type SessionUncheckedCreateWithoutUserInput = {
    id?: string;
    sessionToken: string;
    expires: Date | string;
    currentOrgId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type SessionCreateOrConnectWithoutUserInput = {
    where: SessionWhereUniqueInput;
    create: XOR<
      SessionCreateWithoutUserInput,
      SessionUncheckedCreateWithoutUserInput
    >;
  };

  export type SessionCreateManyUserInputEnvelope = {
    data: SessionCreateManyUserInput | SessionCreateManyUserInput[];
    skipDuplicates?: boolean;
  };

  export type OrganizationMemberCreateWithoutUserInput = {
    id?: string;
    role?: $Enums.Role;
    createdAt?: Date | string;
    organization: OrganizationCreateNestedOneWithoutMembersInput;
  };

  export type OrganizationMemberUncheckedCreateWithoutUserInput = {
    id?: string;
    organizationId: string;
    role?: $Enums.Role;
    createdAt?: Date | string;
  };

  export type OrganizationMemberCreateOrConnectWithoutUserInput = {
    where: OrganizationMemberWhereUniqueInput;
    create: XOR<
      OrganizationMemberCreateWithoutUserInput,
      OrganizationMemberUncheckedCreateWithoutUserInput
    >;
  };

  export type OrganizationMemberCreateManyUserInputEnvelope = {
    data:
      | OrganizationMemberCreateManyUserInput
      | OrganizationMemberCreateManyUserInput[];
    skipDuplicates?: boolean;
  };

  export type AuditLogCreateWithoutActorInput = {
    id?: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: Date | string;
    organization: OrganizationCreateNestedOneWithoutAuditLogsInput;
  };

  export type AuditLogUncheckedCreateWithoutActorInput = {
    id?: string;
    orgId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: Date | string;
  };

  export type AuditLogCreateOrConnectWithoutActorInput = {
    where: AuditLogWhereUniqueInput;
    create: XOR<
      AuditLogCreateWithoutActorInput,
      AuditLogUncheckedCreateWithoutActorInput
    >;
  };

  export type AuditLogCreateManyActorInputEnvelope = {
    data: AuditLogCreateManyActorInput | AuditLogCreateManyActorInput[];
    skipDuplicates?: boolean;
  };

  export type AccountUpsertWithWhereUniqueWithoutUserInput = {
    where: AccountWhereUniqueInput;
    update: XOR<
      AccountUpdateWithoutUserInput,
      AccountUncheckedUpdateWithoutUserInput
    >;
    create: XOR<
      AccountCreateWithoutUserInput,
      AccountUncheckedCreateWithoutUserInput
    >;
  };

  export type AccountUpdateWithWhereUniqueWithoutUserInput = {
    where: AccountWhereUniqueInput;
    data: XOR<
      AccountUpdateWithoutUserInput,
      AccountUncheckedUpdateWithoutUserInput
    >;
  };

  export type AccountUpdateManyWithWhereWithoutUserInput = {
    where: AccountScalarWhereInput;
    data: XOR<
      AccountUpdateManyMutationInput,
      AccountUncheckedUpdateManyWithoutUserInput
    >;
  };

  export type AccountScalarWhereInput = {
    AND?: AccountScalarWhereInput | AccountScalarWhereInput[];
    OR?: AccountScalarWhereInput[];
    NOT?: AccountScalarWhereInput | AccountScalarWhereInput[];
    id?: StringFilter<"Account"> | string;
    userId?: StringFilter<"Account"> | string;
    type?: StringFilter<"Account"> | string;
    provider?: StringFilter<"Account"> | string;
    providerAccountId?: StringFilter<"Account"> | string;
    refresh_token?: StringNullableFilter<"Account"> | string | null;
    access_token?: StringNullableFilter<"Account"> | string | null;
    expires_at?: IntNullableFilter<"Account"> | number | null;
    token_type?: StringNullableFilter<"Account"> | string | null;
    scope?: StringNullableFilter<"Account"> | string | null;
    id_token?: StringNullableFilter<"Account"> | string | null;
    session_state?: StringNullableFilter<"Account"> | string | null;
  };

  export type SessionUpsertWithWhereUniqueWithoutUserInput = {
    where: SessionWhereUniqueInput;
    update: XOR<
      SessionUpdateWithoutUserInput,
      SessionUncheckedUpdateWithoutUserInput
    >;
    create: XOR<
      SessionCreateWithoutUserInput,
      SessionUncheckedCreateWithoutUserInput
    >;
  };

  export type SessionUpdateWithWhereUniqueWithoutUserInput = {
    where: SessionWhereUniqueInput;
    data: XOR<
      SessionUpdateWithoutUserInput,
      SessionUncheckedUpdateWithoutUserInput
    >;
  };

  export type SessionUpdateManyWithWhereWithoutUserInput = {
    where: SessionScalarWhereInput;
    data: XOR<
      SessionUpdateManyMutationInput,
      SessionUncheckedUpdateManyWithoutUserInput
    >;
  };

  export type SessionScalarWhereInput = {
    AND?: SessionScalarWhereInput | SessionScalarWhereInput[];
    OR?: SessionScalarWhereInput[];
    NOT?: SessionScalarWhereInput | SessionScalarWhereInput[];
    id?: StringFilter<"Session"> | string;
    sessionToken?: StringFilter<"Session"> | string;
    userId?: StringFilter<"Session"> | string;
    expires?: DateTimeFilter<"Session"> | Date | string;
    currentOrgId?: StringNullableFilter<"Session"> | string | null;
    createdAt?: DateTimeFilter<"Session"> | Date | string;
    updatedAt?: DateTimeFilter<"Session"> | Date | string;
  };

  export type OrganizationMemberUpsertWithWhereUniqueWithoutUserInput = {
    where: OrganizationMemberWhereUniqueInput;
    update: XOR<
      OrganizationMemberUpdateWithoutUserInput,
      OrganizationMemberUncheckedUpdateWithoutUserInput
    >;
    create: XOR<
      OrganizationMemberCreateWithoutUserInput,
      OrganizationMemberUncheckedCreateWithoutUserInput
    >;
  };

  export type OrganizationMemberUpdateWithWhereUniqueWithoutUserInput = {
    where: OrganizationMemberWhereUniqueInput;
    data: XOR<
      OrganizationMemberUpdateWithoutUserInput,
      OrganizationMemberUncheckedUpdateWithoutUserInput
    >;
  };

  export type OrganizationMemberUpdateManyWithWhereWithoutUserInput = {
    where: OrganizationMemberScalarWhereInput;
    data: XOR<
      OrganizationMemberUpdateManyMutationInput,
      OrganizationMemberUncheckedUpdateManyWithoutUserInput
    >;
  };

  export type OrganizationMemberScalarWhereInput = {
    AND?:
      | OrganizationMemberScalarWhereInput
      | OrganizationMemberScalarWhereInput[];
    OR?: OrganizationMemberScalarWhereInput[];
    NOT?:
      | OrganizationMemberScalarWhereInput
      | OrganizationMemberScalarWhereInput[];
    id?: StringFilter<"OrganizationMember"> | string;
    organizationId?: StringFilter<"OrganizationMember"> | string;
    userId?: StringFilter<"OrganizationMember"> | string;
    role?: EnumRoleFilter<"OrganizationMember"> | $Enums.Role;
    createdAt?: DateTimeFilter<"OrganizationMember"> | Date | string;
  };

  export type AuditLogUpsertWithWhereUniqueWithoutActorInput = {
    where: AuditLogWhereUniqueInput;
    update: XOR<
      AuditLogUpdateWithoutActorInput,
      AuditLogUncheckedUpdateWithoutActorInput
    >;
    create: XOR<
      AuditLogCreateWithoutActorInput,
      AuditLogUncheckedCreateWithoutActorInput
    >;
  };

  export type AuditLogUpdateWithWhereUniqueWithoutActorInput = {
    where: AuditLogWhereUniqueInput;
    data: XOR<
      AuditLogUpdateWithoutActorInput,
      AuditLogUncheckedUpdateWithoutActorInput
    >;
  };

  export type AuditLogUpdateManyWithWhereWithoutActorInput = {
    where: AuditLogScalarWhereInput;
    data: XOR<
      AuditLogUpdateManyMutationInput,
      AuditLogUncheckedUpdateManyWithoutActorInput
    >;
  };

  export type AuditLogScalarWhereInput = {
    AND?: AuditLogScalarWhereInput | AuditLogScalarWhereInput[];
    OR?: AuditLogScalarWhereInput[];
    NOT?: AuditLogScalarWhereInput | AuditLogScalarWhereInput[];
    id?: StringFilter<"AuditLog"> | string;
    actorId?: StringNullableFilter<"AuditLog"> | string | null;
    orgId?: StringFilter<"AuditLog"> | string;
    action?: StringFilter<"AuditLog"> | string;
    entityType?: StringFilter<"AuditLog"> | string;
    entityId?: StringNullableFilter<"AuditLog"> | string | null;
    metadata?: JsonNullableFilter<"AuditLog">;
    createdAt?: DateTimeFilter<"AuditLog"> | Date | string;
  };

  export type UserCreateWithoutAccountsInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | string | null;
    image?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    sessions?: SessionCreateNestedManyWithoutUserInput;
    memberships?: OrganizationMemberCreateNestedManyWithoutUserInput;
    auditLogs?: AuditLogCreateNestedManyWithoutActorInput;
  };

  export type UserUncheckedCreateWithoutAccountsInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | string | null;
    image?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput;
    memberships?: OrganizationMemberUncheckedCreateNestedManyWithoutUserInput;
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutActorInput;
  };

  export type UserCreateOrConnectWithoutAccountsInput = {
    where: UserWhereUniqueInput;
    create: XOR<
      UserCreateWithoutAccountsInput,
      UserUncheckedCreateWithoutAccountsInput
    >;
  };

  export type UserUpsertWithoutAccountsInput = {
    update: XOR<
      UserUpdateWithoutAccountsInput,
      UserUncheckedUpdateWithoutAccountsInput
    >;
    create: XOR<
      UserCreateWithoutAccountsInput,
      UserUncheckedCreateWithoutAccountsInput
    >;
    where?: UserWhereInput;
  };

  export type UserUpdateToOneWithWhereWithoutAccountsInput = {
    where?: UserWhereInput;
    data: XOR<
      UserUpdateWithoutAccountsInput,
      UserUncheckedUpdateWithoutAccountsInput
    >;
  };

  export type UserUpdateWithoutAccountsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: NullableStringFieldUpdateOperationsInput | string | null;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    emailVerified?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    image?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    sessions?: SessionUpdateManyWithoutUserNestedInput;
    memberships?: OrganizationMemberUpdateManyWithoutUserNestedInput;
    auditLogs?: AuditLogUpdateManyWithoutActorNestedInput;
  };

  export type UserUncheckedUpdateWithoutAccountsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: NullableStringFieldUpdateOperationsInput | string | null;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    emailVerified?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    image?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput;
    memberships?: OrganizationMemberUncheckedUpdateManyWithoutUserNestedInput;
    auditLogs?: AuditLogUncheckedUpdateManyWithoutActorNestedInput;
  };

  export type UserCreateWithoutSessionsInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | string | null;
    image?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    accounts?: AccountCreateNestedManyWithoutUserInput;
    memberships?: OrganizationMemberCreateNestedManyWithoutUserInput;
    auditLogs?: AuditLogCreateNestedManyWithoutActorInput;
  };

  export type UserUncheckedCreateWithoutSessionsInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | string | null;
    image?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput;
    memberships?: OrganizationMemberUncheckedCreateNestedManyWithoutUserInput;
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutActorInput;
  };

  export type UserCreateOrConnectWithoutSessionsInput = {
    where: UserWhereUniqueInput;
    create: XOR<
      UserCreateWithoutSessionsInput,
      UserUncheckedCreateWithoutSessionsInput
    >;
  };

  export type OrganizationCreateWithoutSessionsInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    members?: OrganizationMemberCreateNestedManyWithoutOrganizationInput;
    auditLogs?: AuditLogCreateNestedManyWithoutOrganizationInput;
    featureFlags?: FeatureFlagCreateNestedManyWithoutOrganizationInput;
    applications?: VolunteerApplicationCreateNestedManyWithoutOrganizationInput;
    screenerQuestions?: ScreenerQuestionCreateNestedManyWithoutOrganizationInput;
  };

  export type OrganizationUncheckedCreateWithoutSessionsInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    members?: OrganizationMemberUncheckedCreateNestedManyWithoutOrganizationInput;
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutOrganizationInput;
    featureFlags?: FeatureFlagUncheckedCreateNestedManyWithoutOrganizationInput;
    applications?: VolunteerApplicationUncheckedCreateNestedManyWithoutOrganizationInput;
    screenerQuestions?: ScreenerQuestionUncheckedCreateNestedManyWithoutOrganizationInput;
  };

  export type OrganizationCreateOrConnectWithoutSessionsInput = {
    where: OrganizationWhereUniqueInput;
    create: XOR<
      OrganizationCreateWithoutSessionsInput,
      OrganizationUncheckedCreateWithoutSessionsInput
    >;
  };

  export type UserUpsertWithoutSessionsInput = {
    update: XOR<
      UserUpdateWithoutSessionsInput,
      UserUncheckedUpdateWithoutSessionsInput
    >;
    create: XOR<
      UserCreateWithoutSessionsInput,
      UserUncheckedCreateWithoutSessionsInput
    >;
    where?: UserWhereInput;
  };

  export type UserUpdateToOneWithWhereWithoutSessionsInput = {
    where?: UserWhereInput;
    data: XOR<
      UserUpdateWithoutSessionsInput,
      UserUncheckedUpdateWithoutSessionsInput
    >;
  };

  export type UserUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: NullableStringFieldUpdateOperationsInput | string | null;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    emailVerified?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    image?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accounts?: AccountUpdateManyWithoutUserNestedInput;
    memberships?: OrganizationMemberUpdateManyWithoutUserNestedInput;
    auditLogs?: AuditLogUpdateManyWithoutActorNestedInput;
  };

  export type UserUncheckedUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: NullableStringFieldUpdateOperationsInput | string | null;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    emailVerified?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    image?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput;
    memberships?: OrganizationMemberUncheckedUpdateManyWithoutUserNestedInput;
    auditLogs?: AuditLogUncheckedUpdateManyWithoutActorNestedInput;
  };

  export type OrganizationUpsertWithoutSessionsInput = {
    update: XOR<
      OrganizationUpdateWithoutSessionsInput,
      OrganizationUncheckedUpdateWithoutSessionsInput
    >;
    create: XOR<
      OrganizationCreateWithoutSessionsInput,
      OrganizationUncheckedCreateWithoutSessionsInput
    >;
    where?: OrganizationWhereInput;
  };

  export type OrganizationUpdateToOneWithWhereWithoutSessionsInput = {
    where?: OrganizationWhereInput;
    data: XOR<
      OrganizationUpdateWithoutSessionsInput,
      OrganizationUncheckedUpdateWithoutSessionsInput
    >;
  };

  export type OrganizationUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    members?: OrganizationMemberUpdateManyWithoutOrganizationNestedInput;
    auditLogs?: AuditLogUpdateManyWithoutOrganizationNestedInput;
    featureFlags?: FeatureFlagUpdateManyWithoutOrganizationNestedInput;
    applications?: VolunteerApplicationUpdateManyWithoutOrganizationNestedInput;
    screenerQuestions?: ScreenerQuestionUpdateManyWithoutOrganizationNestedInput;
  };

  export type OrganizationUncheckedUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    members?: OrganizationMemberUncheckedUpdateManyWithoutOrganizationNestedInput;
    auditLogs?: AuditLogUncheckedUpdateManyWithoutOrganizationNestedInput;
    featureFlags?: FeatureFlagUncheckedUpdateManyWithoutOrganizationNestedInput;
    applications?: VolunteerApplicationUncheckedUpdateManyWithoutOrganizationNestedInput;
    screenerQuestions?: ScreenerQuestionUncheckedUpdateManyWithoutOrganizationNestedInput;
  };

  export type OrganizationMemberCreateWithoutOrganizationInput = {
    id?: string;
    role?: $Enums.Role;
    createdAt?: Date | string;
    user: UserCreateNestedOneWithoutMembershipsInput;
  };

  export type OrganizationMemberUncheckedCreateWithoutOrganizationInput = {
    id?: string;
    userId: string;
    role?: $Enums.Role;
    createdAt?: Date | string;
  };

  export type OrganizationMemberCreateOrConnectWithoutOrganizationInput = {
    where: OrganizationMemberWhereUniqueInput;
    create: XOR<
      OrganizationMemberCreateWithoutOrganizationInput,
      OrganizationMemberUncheckedCreateWithoutOrganizationInput
    >;
  };

  export type OrganizationMemberCreateManyOrganizationInputEnvelope = {
    data:
      | OrganizationMemberCreateManyOrganizationInput
      | OrganizationMemberCreateManyOrganizationInput[];
    skipDuplicates?: boolean;
  };

  export type AuditLogCreateWithoutOrganizationInput = {
    id?: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: Date | string;
    actor?: UserCreateNestedOneWithoutAuditLogsInput;
  };

  export type AuditLogUncheckedCreateWithoutOrganizationInput = {
    id?: string;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: Date | string;
  };

  export type AuditLogCreateOrConnectWithoutOrganizationInput = {
    where: AuditLogWhereUniqueInput;
    create: XOR<
      AuditLogCreateWithoutOrganizationInput,
      AuditLogUncheckedCreateWithoutOrganizationInput
    >;
  };

  export type AuditLogCreateManyOrganizationInputEnvelope = {
    data:
      | AuditLogCreateManyOrganizationInput
      | AuditLogCreateManyOrganizationInput[];
    skipDuplicates?: boolean;
  };

  export type FeatureFlagCreateWithoutOrganizationInput = {
    id?: string;
    key: string;
    enabled?: boolean;
    createdAt?: Date | string;
  };

  export type FeatureFlagUncheckedCreateWithoutOrganizationInput = {
    id?: string;
    key: string;
    enabled?: boolean;
    createdAt?: Date | string;
  };

  export type FeatureFlagCreateOrConnectWithoutOrganizationInput = {
    where: FeatureFlagWhereUniqueInput;
    create: XOR<
      FeatureFlagCreateWithoutOrganizationInput,
      FeatureFlagUncheckedCreateWithoutOrganizationInput
    >;
  };

  export type FeatureFlagCreateManyOrganizationInputEnvelope = {
    data:
      | FeatureFlagCreateManyOrganizationInput
      | FeatureFlagCreateManyOrganizationInput[];
    skipDuplicates?: boolean;
  };

  export type VolunteerApplicationCreateWithoutOrganizationInput = {
    id?: string;
    submittedByEmail: string;
    status?: $Enums.ApplicationStatus;
    screeningStatus: $Enums.ScreeningStatus;
    screeningReasons: JsonNullValueInput | InputJsonValue;
    submittedAt?: Date | string;
    answers?: VolunteerAnswerCreateNestedManyWithoutApplicationInput;
  };

  export type VolunteerApplicationUncheckedCreateWithoutOrganizationInput = {
    id?: string;
    submittedByEmail: string;
    status?: $Enums.ApplicationStatus;
    screeningStatus: $Enums.ScreeningStatus;
    screeningReasons: JsonNullValueInput | InputJsonValue;
    submittedAt?: Date | string;
    answers?: VolunteerAnswerUncheckedCreateNestedManyWithoutApplicationInput;
  };

  export type VolunteerApplicationCreateOrConnectWithoutOrganizationInput = {
    where: VolunteerApplicationWhereUniqueInput;
    create: XOR<
      VolunteerApplicationCreateWithoutOrganizationInput,
      VolunteerApplicationUncheckedCreateWithoutOrganizationInput
    >;
  };

  export type VolunteerApplicationCreateManyOrganizationInputEnvelope = {
    data:
      | VolunteerApplicationCreateManyOrganizationInput
      | VolunteerApplicationCreateManyOrganizationInput[];
    skipDuplicates?: boolean;
  };

  export type ScreenerQuestionCreateWithoutOrganizationInput = {
    id?: string;
    key: string;
    prompt: string;
    type: $Enums.ScreenerQuestionType;
    configJson: JsonNullValueInput | InputJsonValue;
    isActive?: boolean;
    order: number;
    createdAt?: Date | string;
  };

  export type ScreenerQuestionUncheckedCreateWithoutOrganizationInput = {
    id?: string;
    key: string;
    prompt: string;
    type: $Enums.ScreenerQuestionType;
    configJson: JsonNullValueInput | InputJsonValue;
    isActive?: boolean;
    order: number;
    createdAt?: Date | string;
  };

  export type ScreenerQuestionCreateOrConnectWithoutOrganizationInput = {
    where: ScreenerQuestionWhereUniqueInput;
    create: XOR<
      ScreenerQuestionCreateWithoutOrganizationInput,
      ScreenerQuestionUncheckedCreateWithoutOrganizationInput
    >;
  };

  export type ScreenerQuestionCreateManyOrganizationInputEnvelope = {
    data:
      | ScreenerQuestionCreateManyOrganizationInput
      | ScreenerQuestionCreateManyOrganizationInput[];
    skipDuplicates?: boolean;
  };

  export type SessionCreateWithoutCurrentOrgInput = {
    id?: string;
    sessionToken: string;
    expires: Date | string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user: UserCreateNestedOneWithoutSessionsInput;
  };

  export type SessionUncheckedCreateWithoutCurrentOrgInput = {
    id?: string;
    sessionToken: string;
    userId: string;
    expires: Date | string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type SessionCreateOrConnectWithoutCurrentOrgInput = {
    where: SessionWhereUniqueInput;
    create: XOR<
      SessionCreateWithoutCurrentOrgInput,
      SessionUncheckedCreateWithoutCurrentOrgInput
    >;
  };

  export type SessionCreateManyCurrentOrgInputEnvelope = {
    data: SessionCreateManyCurrentOrgInput | SessionCreateManyCurrentOrgInput[];
    skipDuplicates?: boolean;
  };

  export type OrganizationMemberUpsertWithWhereUniqueWithoutOrganizationInput =
    {
      where: OrganizationMemberWhereUniqueInput;
      update: XOR<
        OrganizationMemberUpdateWithoutOrganizationInput,
        OrganizationMemberUncheckedUpdateWithoutOrganizationInput
      >;
      create: XOR<
        OrganizationMemberCreateWithoutOrganizationInput,
        OrganizationMemberUncheckedCreateWithoutOrganizationInput
      >;
    };

  export type OrganizationMemberUpdateWithWhereUniqueWithoutOrganizationInput =
    {
      where: OrganizationMemberWhereUniqueInput;
      data: XOR<
        OrganizationMemberUpdateWithoutOrganizationInput,
        OrganizationMemberUncheckedUpdateWithoutOrganizationInput
      >;
    };

  export type OrganizationMemberUpdateManyWithWhereWithoutOrganizationInput = {
    where: OrganizationMemberScalarWhereInput;
    data: XOR<
      OrganizationMemberUpdateManyMutationInput,
      OrganizationMemberUncheckedUpdateManyWithoutOrganizationInput
    >;
  };

  export type AuditLogUpsertWithWhereUniqueWithoutOrganizationInput = {
    where: AuditLogWhereUniqueInput;
    update: XOR<
      AuditLogUpdateWithoutOrganizationInput,
      AuditLogUncheckedUpdateWithoutOrganizationInput
    >;
    create: XOR<
      AuditLogCreateWithoutOrganizationInput,
      AuditLogUncheckedCreateWithoutOrganizationInput
    >;
  };

  export type AuditLogUpdateWithWhereUniqueWithoutOrganizationInput = {
    where: AuditLogWhereUniqueInput;
    data: XOR<
      AuditLogUpdateWithoutOrganizationInput,
      AuditLogUncheckedUpdateWithoutOrganizationInput
    >;
  };

  export type AuditLogUpdateManyWithWhereWithoutOrganizationInput = {
    where: AuditLogScalarWhereInput;
    data: XOR<
      AuditLogUpdateManyMutationInput,
      AuditLogUncheckedUpdateManyWithoutOrganizationInput
    >;
  };

  export type FeatureFlagUpsertWithWhereUniqueWithoutOrganizationInput = {
    where: FeatureFlagWhereUniqueInput;
    update: XOR<
      FeatureFlagUpdateWithoutOrganizationInput,
      FeatureFlagUncheckedUpdateWithoutOrganizationInput
    >;
    create: XOR<
      FeatureFlagCreateWithoutOrganizationInput,
      FeatureFlagUncheckedCreateWithoutOrganizationInput
    >;
  };

  export type FeatureFlagUpdateWithWhereUniqueWithoutOrganizationInput = {
    where: FeatureFlagWhereUniqueInput;
    data: XOR<
      FeatureFlagUpdateWithoutOrganizationInput,
      FeatureFlagUncheckedUpdateWithoutOrganizationInput
    >;
  };

  export type FeatureFlagUpdateManyWithWhereWithoutOrganizationInput = {
    where: FeatureFlagScalarWhereInput;
    data: XOR<
      FeatureFlagUpdateManyMutationInput,
      FeatureFlagUncheckedUpdateManyWithoutOrganizationInput
    >;
  };

  export type FeatureFlagScalarWhereInput = {
    AND?: FeatureFlagScalarWhereInput | FeatureFlagScalarWhereInput[];
    OR?: FeatureFlagScalarWhereInput[];
    NOT?: FeatureFlagScalarWhereInput | FeatureFlagScalarWhereInput[];
    id?: StringFilter<"FeatureFlag"> | string;
    orgId?: StringFilter<"FeatureFlag"> | string;
    key?: StringFilter<"FeatureFlag"> | string;
    enabled?: BoolFilter<"FeatureFlag"> | boolean;
    createdAt?: DateTimeFilter<"FeatureFlag"> | Date | string;
  };

  export type VolunteerApplicationUpsertWithWhereUniqueWithoutOrganizationInput =
    {
      where: VolunteerApplicationWhereUniqueInput;
      update: XOR<
        VolunteerApplicationUpdateWithoutOrganizationInput,
        VolunteerApplicationUncheckedUpdateWithoutOrganizationInput
      >;
      create: XOR<
        VolunteerApplicationCreateWithoutOrganizationInput,
        VolunteerApplicationUncheckedCreateWithoutOrganizationInput
      >;
    };

  export type VolunteerApplicationUpdateWithWhereUniqueWithoutOrganizationInput =
    {
      where: VolunteerApplicationWhereUniqueInput;
      data: XOR<
        VolunteerApplicationUpdateWithoutOrganizationInput,
        VolunteerApplicationUncheckedUpdateWithoutOrganizationInput
      >;
    };

  export type VolunteerApplicationUpdateManyWithWhereWithoutOrganizationInput =
    {
      where: VolunteerApplicationScalarWhereInput;
      data: XOR<
        VolunteerApplicationUpdateManyMutationInput,
        VolunteerApplicationUncheckedUpdateManyWithoutOrganizationInput
      >;
    };

  export type VolunteerApplicationScalarWhereInput = {
    AND?:
      | VolunteerApplicationScalarWhereInput
      | VolunteerApplicationScalarWhereInput[];
    OR?: VolunteerApplicationScalarWhereInput[];
    NOT?:
      | VolunteerApplicationScalarWhereInput
      | VolunteerApplicationScalarWhereInput[];
    id?: StringFilter<"VolunteerApplication"> | string;
    orgId?: StringFilter<"VolunteerApplication"> | string;
    submittedByEmail?: StringFilter<"VolunteerApplication"> | string;
    status?:
      | EnumApplicationStatusFilter<"VolunteerApplication">
      | $Enums.ApplicationStatus;
    screeningStatus?:
      | EnumScreeningStatusFilter<"VolunteerApplication">
      | $Enums.ScreeningStatus;
    screeningReasons?: JsonFilter<"VolunteerApplication">;
    submittedAt?: DateTimeFilter<"VolunteerApplication"> | Date | string;
  };

  export type ScreenerQuestionUpsertWithWhereUniqueWithoutOrganizationInput = {
    where: ScreenerQuestionWhereUniqueInput;
    update: XOR<
      ScreenerQuestionUpdateWithoutOrganizationInput,
      ScreenerQuestionUncheckedUpdateWithoutOrganizationInput
    >;
    create: XOR<
      ScreenerQuestionCreateWithoutOrganizationInput,
      ScreenerQuestionUncheckedCreateWithoutOrganizationInput
    >;
  };

  export type ScreenerQuestionUpdateWithWhereUniqueWithoutOrganizationInput = {
    where: ScreenerQuestionWhereUniqueInput;
    data: XOR<
      ScreenerQuestionUpdateWithoutOrganizationInput,
      ScreenerQuestionUncheckedUpdateWithoutOrganizationInput
    >;
  };

  export type ScreenerQuestionUpdateManyWithWhereWithoutOrganizationInput = {
    where: ScreenerQuestionScalarWhereInput;
    data: XOR<
      ScreenerQuestionUpdateManyMutationInput,
      ScreenerQuestionUncheckedUpdateManyWithoutOrganizationInput
    >;
  };

  export type ScreenerQuestionScalarWhereInput = {
    AND?: ScreenerQuestionScalarWhereInput | ScreenerQuestionScalarWhereInput[];
    OR?: ScreenerQuestionScalarWhereInput[];
    NOT?: ScreenerQuestionScalarWhereInput | ScreenerQuestionScalarWhereInput[];
    id?: StringFilter<"ScreenerQuestion"> | string;
    orgId?: StringFilter<"ScreenerQuestion"> | string;
    key?: StringFilter<"ScreenerQuestion"> | string;
    prompt?: StringFilter<"ScreenerQuestion"> | string;
    type?:
      | EnumScreenerQuestionTypeFilter<"ScreenerQuestion">
      | $Enums.ScreenerQuestionType;
    configJson?: JsonFilter<"ScreenerQuestion">;
    isActive?: BoolFilter<"ScreenerQuestion"> | boolean;
    order?: IntFilter<"ScreenerQuestion"> | number;
    createdAt?: DateTimeFilter<"ScreenerQuestion"> | Date | string;
  };

  export type SessionUpsertWithWhereUniqueWithoutCurrentOrgInput = {
    where: SessionWhereUniqueInput;
    update: XOR<
      SessionUpdateWithoutCurrentOrgInput,
      SessionUncheckedUpdateWithoutCurrentOrgInput
    >;
    create: XOR<
      SessionCreateWithoutCurrentOrgInput,
      SessionUncheckedCreateWithoutCurrentOrgInput
    >;
  };

  export type SessionUpdateWithWhereUniqueWithoutCurrentOrgInput = {
    where: SessionWhereUniqueInput;
    data: XOR<
      SessionUpdateWithoutCurrentOrgInput,
      SessionUncheckedUpdateWithoutCurrentOrgInput
    >;
  };

  export type SessionUpdateManyWithWhereWithoutCurrentOrgInput = {
    where: SessionScalarWhereInput;
    data: XOR<
      SessionUpdateManyMutationInput,
      SessionUncheckedUpdateManyWithoutCurrentOrgInput
    >;
  };

  export type OrganizationCreateWithoutMembersInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    auditLogs?: AuditLogCreateNestedManyWithoutOrganizationInput;
    featureFlags?: FeatureFlagCreateNestedManyWithoutOrganizationInput;
    applications?: VolunteerApplicationCreateNestedManyWithoutOrganizationInput;
    screenerQuestions?: ScreenerQuestionCreateNestedManyWithoutOrganizationInput;
    sessions?: SessionCreateNestedManyWithoutCurrentOrgInput;
  };

  export type OrganizationUncheckedCreateWithoutMembersInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutOrganizationInput;
    featureFlags?: FeatureFlagUncheckedCreateNestedManyWithoutOrganizationInput;
    applications?: VolunteerApplicationUncheckedCreateNestedManyWithoutOrganizationInput;
    screenerQuestions?: ScreenerQuestionUncheckedCreateNestedManyWithoutOrganizationInput;
    sessions?: SessionUncheckedCreateNestedManyWithoutCurrentOrgInput;
  };

  export type OrganizationCreateOrConnectWithoutMembersInput = {
    where: OrganizationWhereUniqueInput;
    create: XOR<
      OrganizationCreateWithoutMembersInput,
      OrganizationUncheckedCreateWithoutMembersInput
    >;
  };

  export type UserCreateWithoutMembershipsInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | string | null;
    image?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    accounts?: AccountCreateNestedManyWithoutUserInput;
    sessions?: SessionCreateNestedManyWithoutUserInput;
    auditLogs?: AuditLogCreateNestedManyWithoutActorInput;
  };

  export type UserUncheckedCreateWithoutMembershipsInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | string | null;
    image?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput;
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput;
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutActorInput;
  };

  export type UserCreateOrConnectWithoutMembershipsInput = {
    where: UserWhereUniqueInput;
    create: XOR<
      UserCreateWithoutMembershipsInput,
      UserUncheckedCreateWithoutMembershipsInput
    >;
  };

  export type OrganizationUpsertWithoutMembersInput = {
    update: XOR<
      OrganizationUpdateWithoutMembersInput,
      OrganizationUncheckedUpdateWithoutMembersInput
    >;
    create: XOR<
      OrganizationCreateWithoutMembersInput,
      OrganizationUncheckedCreateWithoutMembersInput
    >;
    where?: OrganizationWhereInput;
  };

  export type OrganizationUpdateToOneWithWhereWithoutMembersInput = {
    where?: OrganizationWhereInput;
    data: XOR<
      OrganizationUpdateWithoutMembersInput,
      OrganizationUncheckedUpdateWithoutMembersInput
    >;
  };

  export type OrganizationUpdateWithoutMembersInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    auditLogs?: AuditLogUpdateManyWithoutOrganizationNestedInput;
    featureFlags?: FeatureFlagUpdateManyWithoutOrganizationNestedInput;
    applications?: VolunteerApplicationUpdateManyWithoutOrganizationNestedInput;
    screenerQuestions?: ScreenerQuestionUpdateManyWithoutOrganizationNestedInput;
    sessions?: SessionUpdateManyWithoutCurrentOrgNestedInput;
  };

  export type OrganizationUncheckedUpdateWithoutMembersInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    auditLogs?: AuditLogUncheckedUpdateManyWithoutOrganizationNestedInput;
    featureFlags?: FeatureFlagUncheckedUpdateManyWithoutOrganizationNestedInput;
    applications?: VolunteerApplicationUncheckedUpdateManyWithoutOrganizationNestedInput;
    screenerQuestions?: ScreenerQuestionUncheckedUpdateManyWithoutOrganizationNestedInput;
    sessions?: SessionUncheckedUpdateManyWithoutCurrentOrgNestedInput;
  };

  export type UserUpsertWithoutMembershipsInput = {
    update: XOR<
      UserUpdateWithoutMembershipsInput,
      UserUncheckedUpdateWithoutMembershipsInput
    >;
    create: XOR<
      UserCreateWithoutMembershipsInput,
      UserUncheckedCreateWithoutMembershipsInput
    >;
    where?: UserWhereInput;
  };

  export type UserUpdateToOneWithWhereWithoutMembershipsInput = {
    where?: UserWhereInput;
    data: XOR<
      UserUpdateWithoutMembershipsInput,
      UserUncheckedUpdateWithoutMembershipsInput
    >;
  };

  export type UserUpdateWithoutMembershipsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: NullableStringFieldUpdateOperationsInput | string | null;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    emailVerified?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    image?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accounts?: AccountUpdateManyWithoutUserNestedInput;
    sessions?: SessionUpdateManyWithoutUserNestedInput;
    auditLogs?: AuditLogUpdateManyWithoutActorNestedInput;
  };

  export type UserUncheckedUpdateWithoutMembershipsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: NullableStringFieldUpdateOperationsInput | string | null;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    emailVerified?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    image?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput;
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput;
    auditLogs?: AuditLogUncheckedUpdateManyWithoutActorNestedInput;
  };

  export type OrganizationCreateWithoutAuditLogsInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    members?: OrganizationMemberCreateNestedManyWithoutOrganizationInput;
    featureFlags?: FeatureFlagCreateNestedManyWithoutOrganizationInput;
    applications?: VolunteerApplicationCreateNestedManyWithoutOrganizationInput;
    screenerQuestions?: ScreenerQuestionCreateNestedManyWithoutOrganizationInput;
    sessions?: SessionCreateNestedManyWithoutCurrentOrgInput;
  };

  export type OrganizationUncheckedCreateWithoutAuditLogsInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    members?: OrganizationMemberUncheckedCreateNestedManyWithoutOrganizationInput;
    featureFlags?: FeatureFlagUncheckedCreateNestedManyWithoutOrganizationInput;
    applications?: VolunteerApplicationUncheckedCreateNestedManyWithoutOrganizationInput;
    screenerQuestions?: ScreenerQuestionUncheckedCreateNestedManyWithoutOrganizationInput;
    sessions?: SessionUncheckedCreateNestedManyWithoutCurrentOrgInput;
  };

  export type OrganizationCreateOrConnectWithoutAuditLogsInput = {
    where: OrganizationWhereUniqueInput;
    create: XOR<
      OrganizationCreateWithoutAuditLogsInput,
      OrganizationUncheckedCreateWithoutAuditLogsInput
    >;
  };

  export type UserCreateWithoutAuditLogsInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | string | null;
    image?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    accounts?: AccountCreateNestedManyWithoutUserInput;
    sessions?: SessionCreateNestedManyWithoutUserInput;
    memberships?: OrganizationMemberCreateNestedManyWithoutUserInput;
  };

  export type UserUncheckedCreateWithoutAuditLogsInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | string | null;
    image?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput;
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput;
    memberships?: OrganizationMemberUncheckedCreateNestedManyWithoutUserInput;
  };

  export type UserCreateOrConnectWithoutAuditLogsInput = {
    where: UserWhereUniqueInput;
    create: XOR<
      UserCreateWithoutAuditLogsInput,
      UserUncheckedCreateWithoutAuditLogsInput
    >;
  };

  export type OrganizationUpsertWithoutAuditLogsInput = {
    update: XOR<
      OrganizationUpdateWithoutAuditLogsInput,
      OrganizationUncheckedUpdateWithoutAuditLogsInput
    >;
    create: XOR<
      OrganizationCreateWithoutAuditLogsInput,
      OrganizationUncheckedCreateWithoutAuditLogsInput
    >;
    where?: OrganizationWhereInput;
  };

  export type OrganizationUpdateToOneWithWhereWithoutAuditLogsInput = {
    where?: OrganizationWhereInput;
    data: XOR<
      OrganizationUpdateWithoutAuditLogsInput,
      OrganizationUncheckedUpdateWithoutAuditLogsInput
    >;
  };

  export type OrganizationUpdateWithoutAuditLogsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    members?: OrganizationMemberUpdateManyWithoutOrganizationNestedInput;
    featureFlags?: FeatureFlagUpdateManyWithoutOrganizationNestedInput;
    applications?: VolunteerApplicationUpdateManyWithoutOrganizationNestedInput;
    screenerQuestions?: ScreenerQuestionUpdateManyWithoutOrganizationNestedInput;
    sessions?: SessionUpdateManyWithoutCurrentOrgNestedInput;
  };

  export type OrganizationUncheckedUpdateWithoutAuditLogsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    members?: OrganizationMemberUncheckedUpdateManyWithoutOrganizationNestedInput;
    featureFlags?: FeatureFlagUncheckedUpdateManyWithoutOrganizationNestedInput;
    applications?: VolunteerApplicationUncheckedUpdateManyWithoutOrganizationNestedInput;
    screenerQuestions?: ScreenerQuestionUncheckedUpdateManyWithoutOrganizationNestedInput;
    sessions?: SessionUncheckedUpdateManyWithoutCurrentOrgNestedInput;
  };

  export type UserUpsertWithoutAuditLogsInput = {
    update: XOR<
      UserUpdateWithoutAuditLogsInput,
      UserUncheckedUpdateWithoutAuditLogsInput
    >;
    create: XOR<
      UserCreateWithoutAuditLogsInput,
      UserUncheckedCreateWithoutAuditLogsInput
    >;
    where?: UserWhereInput;
  };

  export type UserUpdateToOneWithWhereWithoutAuditLogsInput = {
    where?: UserWhereInput;
    data: XOR<
      UserUpdateWithoutAuditLogsInput,
      UserUncheckedUpdateWithoutAuditLogsInput
    >;
  };

  export type UserUpdateWithoutAuditLogsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: NullableStringFieldUpdateOperationsInput | string | null;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    emailVerified?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    image?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accounts?: AccountUpdateManyWithoutUserNestedInput;
    sessions?: SessionUpdateManyWithoutUserNestedInput;
    memberships?: OrganizationMemberUpdateManyWithoutUserNestedInput;
  };

  export type UserUncheckedUpdateWithoutAuditLogsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: NullableStringFieldUpdateOperationsInput | string | null;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    emailVerified?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    image?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput;
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput;
    memberships?: OrganizationMemberUncheckedUpdateManyWithoutUserNestedInput;
  };

  export type OrganizationCreateWithoutFeatureFlagsInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    members?: OrganizationMemberCreateNestedManyWithoutOrganizationInput;
    auditLogs?: AuditLogCreateNestedManyWithoutOrganizationInput;
    applications?: VolunteerApplicationCreateNestedManyWithoutOrganizationInput;
    screenerQuestions?: ScreenerQuestionCreateNestedManyWithoutOrganizationInput;
    sessions?: SessionCreateNestedManyWithoutCurrentOrgInput;
  };

  export type OrganizationUncheckedCreateWithoutFeatureFlagsInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    members?: OrganizationMemberUncheckedCreateNestedManyWithoutOrganizationInput;
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutOrganizationInput;
    applications?: VolunteerApplicationUncheckedCreateNestedManyWithoutOrganizationInput;
    screenerQuestions?: ScreenerQuestionUncheckedCreateNestedManyWithoutOrganizationInput;
    sessions?: SessionUncheckedCreateNestedManyWithoutCurrentOrgInput;
  };

  export type OrganizationCreateOrConnectWithoutFeatureFlagsInput = {
    where: OrganizationWhereUniqueInput;
    create: XOR<
      OrganizationCreateWithoutFeatureFlagsInput,
      OrganizationUncheckedCreateWithoutFeatureFlagsInput
    >;
  };

  export type OrganizationUpsertWithoutFeatureFlagsInput = {
    update: XOR<
      OrganizationUpdateWithoutFeatureFlagsInput,
      OrganizationUncheckedUpdateWithoutFeatureFlagsInput
    >;
    create: XOR<
      OrganizationCreateWithoutFeatureFlagsInput,
      OrganizationUncheckedCreateWithoutFeatureFlagsInput
    >;
    where?: OrganizationWhereInput;
  };

  export type OrganizationUpdateToOneWithWhereWithoutFeatureFlagsInput = {
    where?: OrganizationWhereInput;
    data: XOR<
      OrganizationUpdateWithoutFeatureFlagsInput,
      OrganizationUncheckedUpdateWithoutFeatureFlagsInput
    >;
  };

  export type OrganizationUpdateWithoutFeatureFlagsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    members?: OrganizationMemberUpdateManyWithoutOrganizationNestedInput;
    auditLogs?: AuditLogUpdateManyWithoutOrganizationNestedInput;
    applications?: VolunteerApplicationUpdateManyWithoutOrganizationNestedInput;
    screenerQuestions?: ScreenerQuestionUpdateManyWithoutOrganizationNestedInput;
    sessions?: SessionUpdateManyWithoutCurrentOrgNestedInput;
  };

  export type OrganizationUncheckedUpdateWithoutFeatureFlagsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    members?: OrganizationMemberUncheckedUpdateManyWithoutOrganizationNestedInput;
    auditLogs?: AuditLogUncheckedUpdateManyWithoutOrganizationNestedInput;
    applications?: VolunteerApplicationUncheckedUpdateManyWithoutOrganizationNestedInput;
    screenerQuestions?: ScreenerQuestionUncheckedUpdateManyWithoutOrganizationNestedInput;
    sessions?: SessionUncheckedUpdateManyWithoutCurrentOrgNestedInput;
  };

  export type OrganizationCreateWithoutApplicationsInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    members?: OrganizationMemberCreateNestedManyWithoutOrganizationInput;
    auditLogs?: AuditLogCreateNestedManyWithoutOrganizationInput;
    featureFlags?: FeatureFlagCreateNestedManyWithoutOrganizationInput;
    screenerQuestions?: ScreenerQuestionCreateNestedManyWithoutOrganizationInput;
    sessions?: SessionCreateNestedManyWithoutCurrentOrgInput;
  };

  export type OrganizationUncheckedCreateWithoutApplicationsInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    members?: OrganizationMemberUncheckedCreateNestedManyWithoutOrganizationInput;
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutOrganizationInput;
    featureFlags?: FeatureFlagUncheckedCreateNestedManyWithoutOrganizationInput;
    screenerQuestions?: ScreenerQuestionUncheckedCreateNestedManyWithoutOrganizationInput;
    sessions?: SessionUncheckedCreateNestedManyWithoutCurrentOrgInput;
  };

  export type OrganizationCreateOrConnectWithoutApplicationsInput = {
    where: OrganizationWhereUniqueInput;
    create: XOR<
      OrganizationCreateWithoutApplicationsInput,
      OrganizationUncheckedCreateWithoutApplicationsInput
    >;
  };

  export type VolunteerAnswerCreateWithoutApplicationInput = {
    id?: string;
    questionId: string;
    answerJson: JsonNullValueInput | InputJsonValue;
  };

  export type VolunteerAnswerUncheckedCreateWithoutApplicationInput = {
    id?: string;
    questionId: string;
    answerJson: JsonNullValueInput | InputJsonValue;
  };

  export type VolunteerAnswerCreateOrConnectWithoutApplicationInput = {
    where: VolunteerAnswerWhereUniqueInput;
    create: XOR<
      VolunteerAnswerCreateWithoutApplicationInput,
      VolunteerAnswerUncheckedCreateWithoutApplicationInput
    >;
  };

  export type VolunteerAnswerCreateManyApplicationInputEnvelope = {
    data:
      | VolunteerAnswerCreateManyApplicationInput
      | VolunteerAnswerCreateManyApplicationInput[];
    skipDuplicates?: boolean;
  };

  export type OrganizationUpsertWithoutApplicationsInput = {
    update: XOR<
      OrganizationUpdateWithoutApplicationsInput,
      OrganizationUncheckedUpdateWithoutApplicationsInput
    >;
    create: XOR<
      OrganizationCreateWithoutApplicationsInput,
      OrganizationUncheckedCreateWithoutApplicationsInput
    >;
    where?: OrganizationWhereInput;
  };

  export type OrganizationUpdateToOneWithWhereWithoutApplicationsInput = {
    where?: OrganizationWhereInput;
    data: XOR<
      OrganizationUpdateWithoutApplicationsInput,
      OrganizationUncheckedUpdateWithoutApplicationsInput
    >;
  };

  export type OrganizationUpdateWithoutApplicationsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    members?: OrganizationMemberUpdateManyWithoutOrganizationNestedInput;
    auditLogs?: AuditLogUpdateManyWithoutOrganizationNestedInput;
    featureFlags?: FeatureFlagUpdateManyWithoutOrganizationNestedInput;
    screenerQuestions?: ScreenerQuestionUpdateManyWithoutOrganizationNestedInput;
    sessions?: SessionUpdateManyWithoutCurrentOrgNestedInput;
  };

  export type OrganizationUncheckedUpdateWithoutApplicationsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    members?: OrganizationMemberUncheckedUpdateManyWithoutOrganizationNestedInput;
    auditLogs?: AuditLogUncheckedUpdateManyWithoutOrganizationNestedInput;
    featureFlags?: FeatureFlagUncheckedUpdateManyWithoutOrganizationNestedInput;
    screenerQuestions?: ScreenerQuestionUncheckedUpdateManyWithoutOrganizationNestedInput;
    sessions?: SessionUncheckedUpdateManyWithoutCurrentOrgNestedInput;
  };

  export type VolunteerAnswerUpsertWithWhereUniqueWithoutApplicationInput = {
    where: VolunteerAnswerWhereUniqueInput;
    update: XOR<
      VolunteerAnswerUpdateWithoutApplicationInput,
      VolunteerAnswerUncheckedUpdateWithoutApplicationInput
    >;
    create: XOR<
      VolunteerAnswerCreateWithoutApplicationInput,
      VolunteerAnswerUncheckedCreateWithoutApplicationInput
    >;
  };

  export type VolunteerAnswerUpdateWithWhereUniqueWithoutApplicationInput = {
    where: VolunteerAnswerWhereUniqueInput;
    data: XOR<
      VolunteerAnswerUpdateWithoutApplicationInput,
      VolunteerAnswerUncheckedUpdateWithoutApplicationInput
    >;
  };

  export type VolunteerAnswerUpdateManyWithWhereWithoutApplicationInput = {
    where: VolunteerAnswerScalarWhereInput;
    data: XOR<
      VolunteerAnswerUpdateManyMutationInput,
      VolunteerAnswerUncheckedUpdateManyWithoutApplicationInput
    >;
  };

  export type VolunteerAnswerScalarWhereInput = {
    AND?: VolunteerAnswerScalarWhereInput | VolunteerAnswerScalarWhereInput[];
    OR?: VolunteerAnswerScalarWhereInput[];
    NOT?: VolunteerAnswerScalarWhereInput | VolunteerAnswerScalarWhereInput[];
    id?: StringFilter<"VolunteerAnswer"> | string;
    applicationId?: StringFilter<"VolunteerAnswer"> | string;
    questionId?: StringFilter<"VolunteerAnswer"> | string;
    answerJson?: JsonFilter<"VolunteerAnswer">;
  };

  export type VolunteerApplicationCreateWithoutAnswersInput = {
    id?: string;
    submittedByEmail: string;
    status?: $Enums.ApplicationStatus;
    screeningStatus: $Enums.ScreeningStatus;
    screeningReasons: JsonNullValueInput | InputJsonValue;
    submittedAt?: Date | string;
    organization: OrganizationCreateNestedOneWithoutApplicationsInput;
  };

  export type VolunteerApplicationUncheckedCreateWithoutAnswersInput = {
    id?: string;
    orgId: string;
    submittedByEmail: string;
    status?: $Enums.ApplicationStatus;
    screeningStatus: $Enums.ScreeningStatus;
    screeningReasons: JsonNullValueInput | InputJsonValue;
    submittedAt?: Date | string;
  };

  export type VolunteerApplicationCreateOrConnectWithoutAnswersInput = {
    where: VolunteerApplicationWhereUniqueInput;
    create: XOR<
      VolunteerApplicationCreateWithoutAnswersInput,
      VolunteerApplicationUncheckedCreateWithoutAnswersInput
    >;
  };

  export type VolunteerApplicationUpsertWithoutAnswersInput = {
    update: XOR<
      VolunteerApplicationUpdateWithoutAnswersInput,
      VolunteerApplicationUncheckedUpdateWithoutAnswersInput
    >;
    create: XOR<
      VolunteerApplicationCreateWithoutAnswersInput,
      VolunteerApplicationUncheckedCreateWithoutAnswersInput
    >;
    where?: VolunteerApplicationWhereInput;
  };

  export type VolunteerApplicationUpdateToOneWithWhereWithoutAnswersInput = {
    where?: VolunteerApplicationWhereInput;
    data: XOR<
      VolunteerApplicationUpdateWithoutAnswersInput,
      VolunteerApplicationUncheckedUpdateWithoutAnswersInput
    >;
  };

  export type VolunteerApplicationUpdateWithoutAnswersInput = {
    id?: StringFieldUpdateOperationsInput | string;
    submittedByEmail?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumApplicationStatusFieldUpdateOperationsInput
      | $Enums.ApplicationStatus;
    screeningStatus?:
      | EnumScreeningStatusFieldUpdateOperationsInput
      | $Enums.ScreeningStatus;
    screeningReasons?: JsonNullValueInput | InputJsonValue;
    submittedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    organization?: OrganizationUpdateOneRequiredWithoutApplicationsNestedInput;
  };

  export type VolunteerApplicationUncheckedUpdateWithoutAnswersInput = {
    id?: StringFieldUpdateOperationsInput | string;
    orgId?: StringFieldUpdateOperationsInput | string;
    submittedByEmail?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumApplicationStatusFieldUpdateOperationsInput
      | $Enums.ApplicationStatus;
    screeningStatus?:
      | EnumScreeningStatusFieldUpdateOperationsInput
      | $Enums.ScreeningStatus;
    screeningReasons?: JsonNullValueInput | InputJsonValue;
    submittedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OrganizationCreateWithoutScreenerQuestionsInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    members?: OrganizationMemberCreateNestedManyWithoutOrganizationInput;
    auditLogs?: AuditLogCreateNestedManyWithoutOrganizationInput;
    featureFlags?: FeatureFlagCreateNestedManyWithoutOrganizationInput;
    applications?: VolunteerApplicationCreateNestedManyWithoutOrganizationInput;
    sessions?: SessionCreateNestedManyWithoutCurrentOrgInput;
  };

  export type OrganizationUncheckedCreateWithoutScreenerQuestionsInput = {
    id?: string;
    name: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    members?: OrganizationMemberUncheckedCreateNestedManyWithoutOrganizationInput;
    auditLogs?: AuditLogUncheckedCreateNestedManyWithoutOrganizationInput;
    featureFlags?: FeatureFlagUncheckedCreateNestedManyWithoutOrganizationInput;
    applications?: VolunteerApplicationUncheckedCreateNestedManyWithoutOrganizationInput;
    sessions?: SessionUncheckedCreateNestedManyWithoutCurrentOrgInput;
  };

  export type OrganizationCreateOrConnectWithoutScreenerQuestionsInput = {
    where: OrganizationWhereUniqueInput;
    create: XOR<
      OrganizationCreateWithoutScreenerQuestionsInput,
      OrganizationUncheckedCreateWithoutScreenerQuestionsInput
    >;
  };

  export type OrganizationUpsertWithoutScreenerQuestionsInput = {
    update: XOR<
      OrganizationUpdateWithoutScreenerQuestionsInput,
      OrganizationUncheckedUpdateWithoutScreenerQuestionsInput
    >;
    create: XOR<
      OrganizationCreateWithoutScreenerQuestionsInput,
      OrganizationUncheckedCreateWithoutScreenerQuestionsInput
    >;
    where?: OrganizationWhereInput;
  };

  export type OrganizationUpdateToOneWithWhereWithoutScreenerQuestionsInput = {
    where?: OrganizationWhereInput;
    data: XOR<
      OrganizationUpdateWithoutScreenerQuestionsInput,
      OrganizationUncheckedUpdateWithoutScreenerQuestionsInput
    >;
  };

  export type OrganizationUpdateWithoutScreenerQuestionsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    members?: OrganizationMemberUpdateManyWithoutOrganizationNestedInput;
    auditLogs?: AuditLogUpdateManyWithoutOrganizationNestedInput;
    featureFlags?: FeatureFlagUpdateManyWithoutOrganizationNestedInput;
    applications?: VolunteerApplicationUpdateManyWithoutOrganizationNestedInput;
    sessions?: SessionUpdateManyWithoutCurrentOrgNestedInput;
  };

  export type OrganizationUncheckedUpdateWithoutScreenerQuestionsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    members?: OrganizationMemberUncheckedUpdateManyWithoutOrganizationNestedInput;
    auditLogs?: AuditLogUncheckedUpdateManyWithoutOrganizationNestedInput;
    featureFlags?: FeatureFlagUncheckedUpdateManyWithoutOrganizationNestedInput;
    applications?: VolunteerApplicationUncheckedUpdateManyWithoutOrganizationNestedInput;
    sessions?: SessionUncheckedUpdateManyWithoutCurrentOrgNestedInput;
  };

  export type AccountCreateManyUserInput = {
    id?: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token?: string | null;
    access_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
    session_state?: string | null;
  };

  export type SessionCreateManyUserInput = {
    id?: string;
    sessionToken: string;
    expires: Date | string;
    currentOrgId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type OrganizationMemberCreateManyUserInput = {
    id?: string;
    organizationId: string;
    role?: $Enums.Role;
    createdAt?: Date | string;
  };

  export type AuditLogCreateManyActorInput = {
    id?: string;
    orgId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: Date | string;
  };

  export type AccountUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    type?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    providerAccountId?: StringFieldUpdateOperationsInput | string;
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null;
    access_token?: NullableStringFieldUpdateOperationsInput | string | null;
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null;
    token_type?: NullableStringFieldUpdateOperationsInput | string | null;
    scope?: NullableStringFieldUpdateOperationsInput | string | null;
    id_token?: NullableStringFieldUpdateOperationsInput | string | null;
    session_state?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type AccountUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    type?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    providerAccountId?: StringFieldUpdateOperationsInput | string;
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null;
    access_token?: NullableStringFieldUpdateOperationsInput | string | null;
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null;
    token_type?: NullableStringFieldUpdateOperationsInput | string | null;
    scope?: NullableStringFieldUpdateOperationsInput | string | null;
    id_token?: NullableStringFieldUpdateOperationsInput | string | null;
    session_state?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type AccountUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    type?: StringFieldUpdateOperationsInput | string;
    provider?: StringFieldUpdateOperationsInput | string;
    providerAccountId?: StringFieldUpdateOperationsInput | string;
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null;
    access_token?: NullableStringFieldUpdateOperationsInput | string | null;
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null;
    token_type?: NullableStringFieldUpdateOperationsInput | string | null;
    scope?: NullableStringFieldUpdateOperationsInput | string | null;
    id_token?: NullableStringFieldUpdateOperationsInput | string | null;
    session_state?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type SessionUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    sessionToken?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    currentOrg?: OrganizationUpdateOneWithoutSessionsNestedInput;
  };

  export type SessionUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    sessionToken?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
    currentOrgId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type SessionUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    sessionToken?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
    currentOrgId?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OrganizationMemberUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    organization?: OrganizationUpdateOneRequiredWithoutMembersNestedInput;
  };

  export type OrganizationMemberUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    organizationId?: StringFieldUpdateOperationsInput | string;
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OrganizationMemberUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    organizationId?: StringFieldUpdateOperationsInput | string;
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type AuditLogUpdateWithoutActorInput = {
    id?: StringFieldUpdateOperationsInput | string;
    action?: StringFieldUpdateOperationsInput | string;
    entityType?: StringFieldUpdateOperationsInput | string;
    entityId?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    organization?: OrganizationUpdateOneRequiredWithoutAuditLogsNestedInput;
  };

  export type AuditLogUncheckedUpdateWithoutActorInput = {
    id?: StringFieldUpdateOperationsInput | string;
    orgId?: StringFieldUpdateOperationsInput | string;
    action?: StringFieldUpdateOperationsInput | string;
    entityType?: StringFieldUpdateOperationsInput | string;
    entityId?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type AuditLogUncheckedUpdateManyWithoutActorInput = {
    id?: StringFieldUpdateOperationsInput | string;
    orgId?: StringFieldUpdateOperationsInput | string;
    action?: StringFieldUpdateOperationsInput | string;
    entityType?: StringFieldUpdateOperationsInput | string;
    entityId?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OrganizationMemberCreateManyOrganizationInput = {
    id?: string;
    userId: string;
    role?: $Enums.Role;
    createdAt?: Date | string;
  };

  export type AuditLogCreateManyOrganizationInput = {
    id?: string;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: Date | string;
  };

  export type FeatureFlagCreateManyOrganizationInput = {
    id?: string;
    key: string;
    enabled?: boolean;
    createdAt?: Date | string;
  };

  export type VolunteerApplicationCreateManyOrganizationInput = {
    id?: string;
    submittedByEmail: string;
    status?: $Enums.ApplicationStatus;
    screeningStatus: $Enums.ScreeningStatus;
    screeningReasons: JsonNullValueInput | InputJsonValue;
    submittedAt?: Date | string;
  };

  export type ScreenerQuestionCreateManyOrganizationInput = {
    id?: string;
    key: string;
    prompt: string;
    type: $Enums.ScreenerQuestionType;
    configJson: JsonNullValueInput | InputJsonValue;
    isActive?: boolean;
    order: number;
    createdAt?: Date | string;
  };

  export type SessionCreateManyCurrentOrgInput = {
    id?: string;
    sessionToken: string;
    userId: string;
    expires: Date | string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type OrganizationMemberUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    user?: UserUpdateOneRequiredWithoutMembershipsNestedInput;
  };

  export type OrganizationMemberUncheckedUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OrganizationMemberUncheckedUpdateManyWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type AuditLogUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    action?: StringFieldUpdateOperationsInput | string;
    entityType?: StringFieldUpdateOperationsInput | string;
    entityId?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    actor?: UserUpdateOneWithoutAuditLogsNestedInput;
  };

  export type AuditLogUncheckedUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    actorId?: NullableStringFieldUpdateOperationsInput | string | null;
    action?: StringFieldUpdateOperationsInput | string;
    entityType?: StringFieldUpdateOperationsInput | string;
    entityId?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type AuditLogUncheckedUpdateManyWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    actorId?: NullableStringFieldUpdateOperationsInput | string | null;
    action?: StringFieldUpdateOperationsInput | string;
    entityType?: StringFieldUpdateOperationsInput | string;
    entityId?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type FeatureFlagUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    enabled?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type FeatureFlagUncheckedUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    enabled?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type FeatureFlagUncheckedUpdateManyWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    enabled?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type VolunteerApplicationUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    submittedByEmail?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumApplicationStatusFieldUpdateOperationsInput
      | $Enums.ApplicationStatus;
    screeningStatus?:
      | EnumScreeningStatusFieldUpdateOperationsInput
      | $Enums.ScreeningStatus;
    screeningReasons?: JsonNullValueInput | InputJsonValue;
    submittedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    answers?: VolunteerAnswerUpdateManyWithoutApplicationNestedInput;
  };

  export type VolunteerApplicationUncheckedUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    submittedByEmail?: StringFieldUpdateOperationsInput | string;
    status?:
      | EnumApplicationStatusFieldUpdateOperationsInput
      | $Enums.ApplicationStatus;
    screeningStatus?:
      | EnumScreeningStatusFieldUpdateOperationsInput
      | $Enums.ScreeningStatus;
    screeningReasons?: JsonNullValueInput | InputJsonValue;
    submittedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    answers?: VolunteerAnswerUncheckedUpdateManyWithoutApplicationNestedInput;
  };

  export type VolunteerApplicationUncheckedUpdateManyWithoutOrganizationInput =
    {
      id?: StringFieldUpdateOperationsInput | string;
      submittedByEmail?: StringFieldUpdateOperationsInput | string;
      status?:
        | EnumApplicationStatusFieldUpdateOperationsInput
        | $Enums.ApplicationStatus;
      screeningStatus?:
        | EnumScreeningStatusFieldUpdateOperationsInput
        | $Enums.ScreeningStatus;
      screeningReasons?: JsonNullValueInput | InputJsonValue;
      submittedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    };

  export type ScreenerQuestionUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    prompt?: StringFieldUpdateOperationsInput | string;
    type?:
      | EnumScreenerQuestionTypeFieldUpdateOperationsInput
      | $Enums.ScreenerQuestionType;
    configJson?: JsonNullValueInput | InputJsonValue;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    order?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type ScreenerQuestionUncheckedUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    prompt?: StringFieldUpdateOperationsInput | string;
    type?:
      | EnumScreenerQuestionTypeFieldUpdateOperationsInput
      | $Enums.ScreenerQuestionType;
    configJson?: JsonNullValueInput | InputJsonValue;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    order?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type ScreenerQuestionUncheckedUpdateManyWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    key?: StringFieldUpdateOperationsInput | string;
    prompt?: StringFieldUpdateOperationsInput | string;
    type?:
      | EnumScreenerQuestionTypeFieldUpdateOperationsInput
      | $Enums.ScreenerQuestionType;
    configJson?: JsonNullValueInput | InputJsonValue;
    isActive?: BoolFieldUpdateOperationsInput | boolean;
    order?: IntFieldUpdateOperationsInput | number;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type SessionUpdateWithoutCurrentOrgInput = {
    id?: StringFieldUpdateOperationsInput | string;
    sessionToken?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    user?: UserUpdateOneRequiredWithoutSessionsNestedInput;
  };

  export type SessionUncheckedUpdateWithoutCurrentOrgInput = {
    id?: StringFieldUpdateOperationsInput | string;
    sessionToken?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type SessionUncheckedUpdateManyWithoutCurrentOrgInput = {
    id?: StringFieldUpdateOperationsInput | string;
    sessionToken?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    expires?: DateTimeFieldUpdateOperationsInput | Date | string;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type VolunteerAnswerCreateManyApplicationInput = {
    id?: string;
    questionId: string;
    answerJson: JsonNullValueInput | InputJsonValue;
  };

  export type VolunteerAnswerUpdateWithoutApplicationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    questionId?: StringFieldUpdateOperationsInput | string;
    answerJson?: JsonNullValueInput | InputJsonValue;
  };

  export type VolunteerAnswerUncheckedUpdateWithoutApplicationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    questionId?: StringFieldUpdateOperationsInput | string;
    answerJson?: JsonNullValueInput | InputJsonValue;
  };

  export type VolunteerAnswerUncheckedUpdateManyWithoutApplicationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    questionId?: StringFieldUpdateOperationsInput | string;
    answerJson?: JsonNullValueInput | InputJsonValue;
  };

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number;
  };

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF;
}
