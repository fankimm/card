// 화면이 다루는 이용내역 모양. 서버(get-total-fee)가 내려주는 것과 맞춘다.

// 통계 "전체" 랭킹용. 서버가 이름·카드번호를 떼고 내려준다.
export interface IPublicUsage {
  confirmType: string;
  date: string;
  time: string;
  fee: string;
  place: string;
}

// 내 내역. 이름·카드번호·id 가 붙는다.
export interface IOriginData extends IPublicUsage {
  id: string;
  createdAt: string;
  cardNumber: string;
  user: string;
}
