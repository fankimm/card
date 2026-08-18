// 급여명세서 복호화 API.
//
// 예전엔 Access-Control-Allow-Origin 이 '*' 라 아무 사이트에서나 부를 수 있었다.
// 이제 PAY_ALLOWED_ORIGINS(콤마 구분)에 적은 곳만 허용하고, 비어 있으면
// CORS 헤더를 아예 안 붙여 같은 출처에서만 쓰게 한다.
export default async function handler(req, res) {
  const 허용목록 = (process.env.PAY_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin;
  if (origin && 허용목록.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  try {
    const { htmlContent, password } = req.body;

    // 입력 검증
    if (!htmlContent || !password) {
      return res.status(400).json({
        success: false,
        error: '필수 입력값이 누락되었습니다. (htmlContent, password)',
      });
    }

    // 비밀번호 형식 검증 (6자리 숫자)
    if (!/^\d{6}$/.test(password)) {
      return res.status(400).json({
        success: false,
        error: '비밀번호는 6자리 숫자여야 합니다.',
      });
    }

    // 예전엔 여기서 Math.abs(password << password) === 1610612736 으로 걸렀다.
    // 6자리 100만 개 중 31,250개(정확히 1/32)가 통과하는 검사라 아무것도 막지
    // 못했고, 복호화 알고리즘이 바로 아래에 그대로 있어 지킬 것도 없었다.
    // 대신 복호화 결과가 실제로 명세서인지를 보고 판단한다(아래).

    // _viewData 값 추출
    const viewDataMatch = htmlContent.match(
      /name=['"]_viewData['"]\s+value=['"]([^'"]+)['"]/
    );
    if (!viewDataMatch) {
      return res.status(400).json({
        success: false,
        error:
          '암호화된 데이터를 찾을 수 없습니다. 올바른 급여명세서 파일인지 확인해주세요.',
      });
    }

    const encryptedData = viewDataMatch[1];

    // URL 디코딩 및 복호화
    const decodedData = decodeURIComponent(encryptedData);
    const bin = decodedData.split(',');

    let decryptedHTML = '';
    for (let i = 0; i < bin.length; i++) {
      const encryptedChar = Number(bin[i]);
      const keyChar = password.charCodeAt(i % password.length);
      const decryptedChar = encryptedChar + keyChar;
      decryptedHTML += String.fromCharCode(decryptedChar);
    }

    // 비밀번호가 틀리면 글자 시프트 결과가 그냥 깨진 문자열이 된다.
    // 명세서라면 반드시 있는 표식으로 성공 여부를 판단한다.
    if (!/급여\s*명세서|<em>회사명<\/em>/.test(decryptedHTML)) {
      return res.status(401).json({
        success: false,
        error: '비밀번호가 일치하지 않습니다.',
      });
    }

    // HTML 파싱
    const payslipData = parsePayslipHTML(decryptedHTML);

    // 보기 좋게 포맷팅된 텍스트 생성
    // (예전엔 여기서 beautified 를 통째로 console.log 했다. 이름·사원코드·실지급액이
    //  Vercel 로그에 그대로 남는다. 응답으로만 돌려준다.)
    const beautified = formatBeautifiedText(payslipData);
    // 성공 응답
    return res.status(200).json({
      success: true,
      data: payslipData,
      beautified: beautified,
    });
  } catch (error) {
    console.error('Decryption error:', error);
    return res.status(500).json({
      success: false,
      error: '복호화 처리 중 오류가 발생했습니다.',
      details: error.message,
    });
  }
}

// HTML 파싱 함수
function parsePayslipHTML(html) {
  const result = {
    title: '',
    basicInfo: {
      companyName: '',
      payDate: '',
      employeeCode: '',
      employeeName: '',
      department: '',
      birthDate: '',
    },
    payments: {},
    deductions: {},
    summary: {
      totalPayment: '',
      totalDeduction: '',
      netPayment: '',
    },
  };

  try {
    // 제목 추출
    const titleMatch = html.match(/<b>(\d+년\s*\d+월\s*급여\s*명세서)<\/b>/);
    if (titleMatch) result.title = titleMatch[1];

    // 회사명 추출
    const companyMatch = html.match(/<em>회사명<\/em>\s*([^<]+)/);
    if (companyMatch) result.basicInfo.companyName = companyMatch[1].trim();

    // 지급일 추출
    const payDateMatch = html.match(/<em>지급일<\/em>\s*([^<]+)/);
    if (payDateMatch) result.basicInfo.payDate = payDateMatch[1].trim();

    // 사원 정보 추출
    const employeeCodeMatch = html.match(
      /<span>사원코드<\/span><\/th><td>(\d+)/
    );
    if (employeeCodeMatch) result.basicInfo.employeeCode = employeeCodeMatch[1];

    const employeeNameMatch = html.match(
      /<span>사원명<\/span><\/th><td>([^<]+)/
    );
    if (employeeNameMatch) result.basicInfo.employeeName = employeeNameMatch[1];

    const departmentMatch = html.match(/<span>부서<\/span><\/th><td>([^<]+)/);
    if (departmentMatch) result.basicInfo.department = departmentMatch[1];

    const birthDateMatch = html.match(
      /<span>생년월일<\/span><\/th><td>([^<]+)/
    );
    if (birthDateMatch) result.basicInfo.birthDate = birthDateMatch[1];

    // 지급내역 추출
    const paymentSection = html.match(
      /지급내역[\s\S]*?<\/tr>\s*<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/
    );

    if (paymentSection) {
      const paymentItems = {
        기본급: paymentSection[1].trim(),
        식대: paymentSection[2].trim(),
        육아수당: paymentSection[3].trim(),
        연장수당: paymentSection[4].trim(),
        휴일수당: paymentSection[5].trim(),
        '기타(급여 소급분)': paymentSection[6].trim(),
      };

      // 빈 값이 아닌 항목만 추가
      for (const [key, value] of Object.entries(paymentItems)) {
        if (value && value !== '' && value !== '0') {
          result.payments[key] = value;
        }
      }
    }

    // 야간수당 추출
    const nightPayMatch = html.match(
      /<th>야간수당<\/th>[\s\S]*?<td[^>]*>(\d+,?\d*)<\/td>/
    );
    if (nightPayMatch && nightPayMatch[1] && nightPayMatch[1] !== '0') {
      result.payments['야간수당'] = nightPayMatch[1];
    }

    // 공제내역 추출
    const deductionMatch = html.match(
      /공제내역<\/td>[\s\S]*?<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/
    );

    if (deductionMatch) {
      const deductionItems = {
        국민연금: deductionMatch[1].trim(),
        건강보험: deductionMatch[2].trim(),
        고용보험: deductionMatch[3].trim(),
        장기요양보험료: deductionMatch[4].trim(),
        소득세: deductionMatch[5].trim(),
        지방소득세: deductionMatch[6].trim(),
      };

      // 빈 값이 아닌 항목만 추가
      for (const [key, value] of Object.entries(deductionItems)) {
        if (value && value !== '' && value !== '0') {
          result.deductions[key] = value;
        }
      }
    }

    // 합계 추출
    const totalMatch = html.match(
      /합계<\/td>[\s\S]*?<tr[^>]*>[\s\S]*?<td[^>]*><\/td>\s*<td[^>]*><\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*><\/td>\s*<td[^>]*>([^<]+)<\/td>/
    );
    if (totalMatch) {
      result.summary.totalPayment = totalMatch[1].trim();
      result.summary.totalDeduction = totalMatch[2].trim();
      result.summary.netPayment = totalMatch[3].trim();
    }
  } catch (error) {
    console.error('HTML parsing error:', error);
  }

  return result;
}

// 보기 좋게 포맷팅된 텍스트 생성 함수
function formatBeautifiedText(data) {
  let text = '';

  // 제목
  text += '='.repeat(25) + '\n';
  text += `        ${data.title}\n`;
  text += '='.repeat(25) + '\n\n';

  // 기본 정보
  text += '📋 기본 정보\n';
  text += `  • 회사명: ${data.basicInfo.companyName}\n`;
  text += `  • 사원명: ${data.basicInfo.employeeName} (${data.basicInfo.employeeCode})\n`;
  text += `  • 부서: ${data.basicInfo.department}\n`;
  text += `  • 지급일: ${data.basicInfo.payDate}\n\n`;

  // 지급 내역
  text += '💰 지급 내역\n';
  for (const [key, value] of Object.entries(data.payments)) {
    if (value && value !== '' && value !== '0') {
      text += `  • ${key}: ${value}원\n`;
    }
  }
  text += '\n';

  // 공제 내역
  text += '📉 공제 내역\n';
  for (const [key, value] of Object.entries(data.deductions)) {
    if (value && value !== '' && value !== '0') {
      text += `  • ${key}: ${value}원\n`;
    }
  }
  text += '\n';

  // 요약
  text += '* 요약\n';
  text += `  • 지급총액: ${data.summary.totalPayment}원\n`;
  text += `  • 공제총액: ${data.summary.totalDeduction}원\n`;
  text += `  • 실지급액: ${data.summary.netPayment}원\n\n`;

  text += '='.repeat(25);

  return text;
}
