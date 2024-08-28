import dayjs from 'dayjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const Detail = () => {
  const [data, setData] = useState<any[] | undefined>(undefined);
  const router = useRouter();
  useEffect(() => {
    fetch(`/api/usages-list?name=${window.localStorage.getItem('loginInfo')}`)
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        setData(data);
      });
  }, []);
  return (
    <div>
      <div className="sticky top-0 p-4 flex justify-between items-center backdrop-blur-lg">
        <div>
          <div className="text-2xl font-extrabold ">{`${dayjs().format(
            'M'
          )}월 이용내역 상세`}</div>
          <div className="subText">
            {window.localStorage.getItem('loginInfo')}
          </div>
        </div>
        <div
          className="opposite button text-lg"
          onClick={() => router.push('/')}
        >
          홈으로
        </div>
      </div>
      <div className="flex justify-center">
        <div className="w-full max-w-5xl p-2">
          {data?.map((item) => {
            return (
              <div className="flex justify-between p-2" key={item.id}>
                <div className="flex">
                  <div>•</div>
                  <div>
                    <div className="text-lg">{item.place}</div>
                    <div className="flex gap-2 subText items-center">
                      <div>{dayjs(item.date).format('YY.M.DD')}</div>
                      <div>
                        {dayjs(
                          item.date + item.time,
                          'YYYY-MM-DDHH:mm:ss'
                        ).format('HH:mm')}
                      </div>
                      <div
                        className={`rounded-lg ${
                          item.confirmType === '승인' ? 'opposite' : 'redBox'
                        } text-xs px-1`}
                      >
                        {item.confirmType}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div>{`${item.fee.toLocaleString('ko-kr')}원`}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export default Detail;
