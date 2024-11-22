export interface Data {
  confirmType: string;
  cardNumber: string;
  user: string;
  date: string;
  time: string;
  fee: string;
  place: string;
}

interface DataDTO {
  time?: string;
  data: Data[] | undefined;
}

let cachedData: DataDTO | undefined = undefined;

export const setCachedData = (data: Data[] | undefined, time: string) => {
  cachedData = {
    data,
    time,
  };
};

export const getCachedData = () => {
  return cachedData;
};
