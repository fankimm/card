export interface Data {
  confirmType: string;
  cardNumber: string;
  user: string;
  date: string;
  time: string;
  fee: string;
  place: string;
}

let cachedData: Data[] | undefined = undefined;

export const setCachedData = (data: Data[] | undefined) => {
  cachedData = data;
};

export const getCachedData = () => {
  return cachedData;
};
