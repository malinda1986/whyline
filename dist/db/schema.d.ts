export type Migration = {
    version: number;
    sql: string;
};
export declare const MIGRATIONS: Migration[];
