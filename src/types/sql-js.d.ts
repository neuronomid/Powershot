declare module "sql.js" {
  export type Database = {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
    export(): Uint8Array;
    close(): void;
  };

  export type SqlJsStatic = {
    Database: new (data?: Uint8Array) => Database;
  };

  export default function initSqlJs(config?: unknown): Promise<SqlJsStatic>;
}
