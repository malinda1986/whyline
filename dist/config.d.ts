export declare const DATA_DIR: string;
export declare const DB_PATH: string;
export declare const CONFIG_PATH: string;
export type AppConfig = {
    version: number;
    storage: {
        dbPath: string;
    };
};
export declare function resolveConfig(): AppConfig;
export declare function isInitialized(): boolean;
