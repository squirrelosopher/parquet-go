const NON_IDENTIFIER_CHARS = /[^a-z0-9]+/g;
const SURROUNDING_UNDERSCORES = /^_+|_+$/g;
const VALID_IDENTIFIER_START = /^[a-z_]/;
const IDENTIFIER_PREFIX = 't_';

export function aliasFor(fileName: string): string {
    const identifier = fileName
        .toLowerCase()
        .replace(NON_IDENTIFIER_CHARS, '_')
        .replace(SURROUNDING_UNDERSCORES, '');

    return VALID_IDENTIFIER_START.test(identifier) ? identifier : `${IDENTIFIER_PREFIX}${identifier}`;
}
