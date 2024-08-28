import { useRouter } from 'next/router';
import { useState } from 'react';

const Login = () => {
  const router = useRouter();
  const [name, setName] = useState('');
  return (
    <div className="flex flex-col justify-center p-5 gap-4 items-center">
      <input
        className="opposite"
        type="text"
        placeholder="이름"
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <div
        className="button opposite"
        onClick={() => {
          window.localStorage.setItem('loginInfo', name);
          router.push('/');
          console.log(name);
        }}
      >
        로그인
      </div>
    </div>
  );
};

export default Login;
