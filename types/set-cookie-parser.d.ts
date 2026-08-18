declare module 'set-cookie-parser' {
  export interface Cookie {
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

  // map 옵션에 따라 반환 모양이 달라서 오버로드로 나눠 둔다.
  // 하나의 유니온으로 두면 호출부에서 매번 캐스팅해야 한다.
  export function parse(
    input: string[] | string,
    options?: { map?: false }
  ): Cookie[];
  export function parse(
    input: string[] | string,
    options: { map: true }
  ): Record<string, Cookie>;
}
