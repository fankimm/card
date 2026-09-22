import { describe, expect, it } from 'vitest';
import { csv파싱, csv행만들기, 탭CSV주소 } from '../sheet-csv';

const 헤더 = 'id,createdAt,confirmType,cardNumber,user,date,time,fee,place';
const 필수열 = ['id', 'cardNumber', 'user', 'date', 'time', 'fee'];

describe('csv파싱', () => {
  it('따옴표 안의 쉼표·줄바꿈·따옴표를 한 칸으로 읽는다', () => {
    expect(csv파싱('a,"b,c","d\ne","f ""g"""\r\n1,2,3,4')).toEqual([
      ['a', 'b,c', 'd\ne', 'f "g"'],
      ['1', '2', '3', '4'],
    ]);
  });

  it('마지막 줄에 줄바꿈이 없어도 읽는다 (구글 export 가 이렇게 준다)', () => {
    expect(csv파싱('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('끝의 빈 칸을 버리지 않는다', () => {
    expect(csv파싱('a,b,\n')).toEqual([['a', 'b', '']]);
  });
});

describe('csv행만들기', () => {
  it('시트가 실제로 주는 모양을 Apps Script 와 같은 객체로 바꾼다', () => {
    const text = `${헤더}\n938,2026-09-21 11:36:42,승인,9427,김*환,2026-09-21,11:36:00,12000,전통백암순대국`;
    expect(csv행만들기(text, 필수열)).toEqual([
      {
        id: '938',
        createdAt: '2026-09-21 11:36:42',
        confirmType: '승인',
        cardNumber: '9427',
        user: '김*환',
        date: '2026-09-21',
        time: '11:36:00',
        fee: '12000',
        place: '전통백암순대국',
      },
    ]);
  });

  it('id 가 빈 줄은 건너뛴다', () => {
    const text = `${헤더}\n,,,,,,,,\n1,,승인,1234,김,2026-09-21,12:00:00,1000,"가,게"`;
    const rows = csv행만들기(text, 필수열);
    expect(rows).toHaveLength(1);
    expect(rows[0].place).toBe('가,게');
  });

  it('시트 공유가 꺼져 로그인 페이지 HTML이 오면 0건으로 읽지 않고 던진다', () => {
    expect(() =>
      csv행만들기('<!DOCTYPE html><html><head>', 필수열)
    ).toThrow('CSV에 열이 없습니다');
  });

  it('빈 응답도 던진다', () => {
    expect(() => csv행만들기('', 필수열)).toThrow();
  });
});

describe('탭CSV주소', () => {
  const base = 'https://docs.google.com/spreadsheets/d/ID/export?format=csv&gid=0';
  it('gid 만 갈아 끼운다', () => {
    expect(탭CSV주소(base, 1126526954)).toBe(
      'https://docs.google.com/spreadsheets/d/ID/export?format=csv&gid=1126526954'
    );
  });
  it('gid 가 없으면 붙인다', () => {
    expect(탭CSV주소('https://x/export?format=csv', 7)).toBe('https://x/export?format=csv&gid=7');
    expect(탭CSV주소('https://x/export', 7)).toBe('https://x/export?gid=7');
  });
});
