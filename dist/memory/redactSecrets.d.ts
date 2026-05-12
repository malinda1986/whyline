type SecretPattern = {
    name: string;
    pattern: RegExp;
};
export declare const SECRET_PATTERNS: SecretPattern[];
export declare function redactSecrets(input: string): string;
export {};
