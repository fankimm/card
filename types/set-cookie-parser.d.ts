declare module 'set-cookie-parser' {
  interface Cookie {
    name: string;
    value: string;
    path?: string;
    domain?: string;
    expires?: Date;
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  }

  function parse(
    input: string[] | string,
    options?: { map?: boolean }
  ): Cookie[] | Record<string, Cookie>;

  export = {
    parse,
  };
}
