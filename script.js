/* =======================================================
   사주 계산 엔진
   ======================================================= */
const STEMS = ["갑","을","병","정","무","기","경","신","임","계"];
const STEM_HANJA = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const BRANCHES = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
const BRANCH_HANJA = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const STEM_ELEM = [0,0,1,1,2,2,3,3,4,4];
const STEM_YY   = [0,1,0,1,0,1,0,1,0,1];
const BRANCH_ELEM = [4,2,0,0,2,1,1,2,3,3,2,4];
const ELEM_NAMES = ["목","화","토","금","수"];
const ELEM_VARS  = ["wood","fire","earth","metal","water"];
const BRANCH_MAIN_STEM = [9,5,0,1,4,2,3,5,6,7,4,8];

function mod(n,m){ return ((n%m)+m)%m; }

function toJD(date){
  const Y = date.getUTCFullYear();
  const M = date.getUTCMonth()+1;
  const D = date.getUTCDate() + (date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600)/24;
  let y=Y,m=M;
  if(m<=2){ y-=1; m+=12; }
  const A = Math.floor(y/100);
  const B = 2-A+Math.floor(A/4);
  return Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(m+1)) + D + B - 1524.5;
}
function solarLongitudeDeg(date){
  const JD = toJD(date);
  const T = (JD-2451545.0)/36525;
  const L0 = mod(280.46646+36000.76983*T+0.0003032*T*T,360);
  const M = mod(357.52911+35999.05029*T-0.0001537*T*T,360);
  const Mrad = M*Math.PI/180;
  const C = (1.914602-0.004817*T-0.000014*T*T)*Math.sin(Mrad)
    + (0.019993-0.000101*T)*Math.sin(2*Mrad)
    + 0.000289*Math.sin(3*Mrad);
  const trueLong = L0+C;
  const omega = 125.04-1934.136*T;
  const lambda = trueLong - 0.00569 - 0.00478*Math.sin(omega*Math.PI/180);
  return mod(lambda,360);
}
function findSolarTermCrossing(approxDate,targetDeg){
  let lo=new Date(approxDate.getTime()-20*86400000);
  let hi=new Date(approxDate.getTime()+20*86400000);
  function diff(d){ const lam=solarLongitudeDeg(d); return mod(lam-targetDeg+180,360)-180; }
  let dLo=diff(lo);
  for(let i=0;i<60;i++){
    const mid=new Date((lo.getTime()+hi.getTime())/2);
    const dMid=diff(mid);
    if((dLo<=0 && dMid>0) || (dLo>0 && dMid<=0 && Math.sign(dMid)!==Math.sign(dLo))){ hi=mid; }
    else{ lo=mid; dLo=dMid; }
  }
  return new Date((lo.getTime()+hi.getTime())/2);
}
const JIEL_LIST = [
  {deg:315,approxMonth:1,approxDay:4},{deg:345,approxMonth:2,approxDay:5},
  {deg:15,approxMonth:3,approxDay:5},{deg:45,approxMonth:4,approxDay:5},
  {deg:75,approxMonth:5,approxDay:5},{deg:105,approxMonth:6,approxDay:6},
  {deg:135,approxMonth:7,approxDay:7},{deg:165,approxMonth:8,approxDay:7},
  {deg:195,approxMonth:9,approxDay:8},{deg:225,approxMonth:10,approxDay:8},
  {deg:255,approxMonth:11,approxDay:7},{deg:285,approxMonth:0,approxDay:5},
];
const DEG_TO_MONTHIDX = {315:0,345:1,15:2,45:3,75:4,105:5,135:6,165:7,195:8,225:9,255:10,285:11};

function getJieBoundaries(year){
  const list=[];
  for(let y=year-1;y<=year+1;y++){
    for(const j of JIEL_LIST){
      const approx=new Date(Date.UTC(y,j.approxMonth,j.approxDay,12,0,0));
      list.push({time:findSolarTermCrossing(approx,j.deg), deg:j.deg});
    }
  }
  list.sort((a,b)=>a.time-b.time);
  return list;
}
function getMonthIndexAndYearInfo(utcInstant){
  const year = utcInstant.getUTCFullYear();
  const boundaries = getJieBoundaries(year);
  let cur=null;
  for(const b of boundaries){ if(b.time<=utcInstant) cur=b; else break; }
  const monthIdx = DEG_TO_MONTHIDX[cur.deg];
  let lastIpchun=null;
  for(const b of boundaries){ if(b.deg===315 && b.time<=utcInstant) lastIpchun=b; }
  if(!lastIpchun){
    const prev=getJieBoundaries(year-1);
    for(const b of prev){ if(b.deg===315 && b.time<=utcInstant) lastIpchun=b; }
  }
  return { monthIdx, sajuYear: lastIpchun.time.getUTCFullYear() };
}
function yearPillar(sajuYear){ return { stemIdx: mod(sajuYear-4,10), branchIdx: mod(sajuYear-4,12) }; }
function monthPillar(sajuYear, monthIdx){
  const yStem = mod(sajuYear-4,10);
  const group = mod(yStem,5);
  const startStem = mod(group*2+2,10);
  return { stemIdx: mod(startStem+monthIdx,10), branchIdx: mod(monthIdx+2,12) };
}
function dayPillar(dateForDay){
  const d0 = Date.UTC(dateForDay.getUTCFullYear(), dateForDay.getUTCMonth(), dateForDay.getUTCDate());
  const b0 = Date.UTC(1900,0,1);
  const diffDays = Math.round((d0-b0)/86400000);
  return { stemIdx: mod(diffDays,10), branchIdx: mod(10+diffDays,12) };
}
function hourPillar(dayStemIdx, hour, minute){
  const totalMin = hour*60+minute;
  let branchIdx;
  if(totalMin>=23*60 || totalMin<1*60) branchIdx=0;
  else branchIdx = Math.floor((totalMin-60)/120)+1;
  const group=mod(dayStemIdx,5);
  const startStem=mod(group*2,10);
  return { stemIdx: mod(startStem+branchIdx,10), branchIdx };
}

/* KST 로컬시각(연,월,일,시,분) -> UTC Date */
function kstToUTC(y,mo,d,h,mi){ return new Date(Date.UTC(y,mo-1,d,h,mi,0) - 9*3600*1000); }

function computeSaju({y,mo,d,h,mi,hasTime,trueSolar}){
  const rawUTC = kstToUTC(y,mo,d, hasTime?h:12, hasTime?mi:0);
  const { monthIdx, sajuYear } = getMonthIndexAndYearInfo(rawUTC);
  const yp = yearPillar(sajuYear);
  const mp = monthPillar(sajuYear, monthIdx);

  let dayUTC = rawUTC;
  let hp = null;
  if(hasTime){
    let adjMin = h*60+mi;
    if(trueSolar) adjMin -= 30;
    let dayShift = 0;
    if(adjMin<0){ adjMin+=24*60; dayShift=-1; }
    if(adjMin>=24*60){ adjMin-=24*60; dayShift=1; }
    const adjH = Math.floor(adjMin/60), adjM = adjMin%60;
    dayUTC = kstToUTC(y,mo,d,12,0); // 기준 정오
    dayUTC = new Date(dayUTC.getTime() + dayShift*86400000);
    const dp = dayPillar(dayUTC);
    hp = hourPillar(dp.stemIdx, adjH, adjM);
    var dpFinal = dp;
  } else {
    var dpFinal = dayPillar(rawUTC);
  }

  return { yp, mp, dp: dpFinal, hp, monthIdx, sajuYear };
}

/* =======================================================
   오행 / 십성 집계
   ======================================================= */
function tallyOheng(chars){
  const cnt=[0,0,0,0,0];
  chars.forEach(c=>{ cnt[c.elem]++; });
  return cnt;
}
function sipseongOf(dayStemIdx, targetStemIdx){
  const de=STEM_ELEM[dayStemIdx], dy=STEM_YY[dayStemIdx];
  const te=STEM_ELEM[targetStemIdx], ty=STEM_YY[targetStemIdx];
  const same = dy===ty;
  const GEN = {0:1,1:2,2:3,3:4,4:0}; // 목생화, 화생토, 토생금, 금생수, 수생목
  const OVERCOME = {0:2,1:3,2:4,3:0,4:1}; // 목극토, 화극금, 토극수, 금극목, 수극화
  if(te===de) return same? "비견":"겁재";
  if(GEN[de]===te) return same? "식신":"상관";
  if(OVERCOME[de]===te) return same? "편재":"정재";
  if(OVERCOME[te]===de) return same? "편관":"정관";
  if(GEN[te]===de) return same? "편인":"정인";
  return "-";
}
const SIPSEONG_GROUP = { "비견":"비겁","겁재":"비겁","식신":"식상","상관":"식상","편재":"재성","정재":"재성","편관":"관성","정관":"관성","편인":"인성","정인":"인성" };

/* =======================================================
   해석 문구 뱅크
   ======================================================= */
const ILGAN_TEXT = {
  "갑":["곧게 뻗은 나무처럼, 한번 마음먹은 방향으로는 흔들림 없이 걸어가는 사람이에요. 남 눈치보다는 스스로 정한 원칙이 먼저고요.",
        "숲에서 가장 먼저 하늘을 향해 자라는 나무 같아요. 시작하는 힘이 좋고, 앞장서는 자리가 은근히 잘 어울려요."],
  "을":["바람에 몸을 맡기면서도 뿌리는 놓지 않는 풀꽃 같은 사람이에요. 유연해 보이지만 은근히 잘 버텨요.",
        "담벼락을 타고도 결국 해가 드는 쪽으로 뻗어나가는 넝쿨처럼, 상황에 맞춰가면서도 원하는 걸 챙기는 재주가 있어요."],
  "병":["한낮의 해처럼 존재만으로 주변을 환하게 만드는 편이에요. 감정 표현이 솔직하고, 숨기는 걸 잘 못해요.",
        "멀리서도 눈에 띄는 볕 같은 사람이에요. 나서는 걸 두려워하지 않고, 열정이 쉽게 식지 않아요."],
  "정":["작은 촛불처럼 은은하지만 꾸준히 따뜻함을 나눠주는 사람이에요. 요란하진 않아도 곁에 있으면 마음이 놓여요.",
        "어두운 곳을 밝히는 등불 같아요. 겉으로 화려하진 않지만 세심하고, 사람 마음을 잘 헤아려요."],
  "무":["넓은 산처럼 든든하게 자리를 지키는 사람이에요. 웬만한 일에는 잘 흔들리지 않고, 곁에 있는 사람을 편안하게 해줘요.",
        "큰 산등성이처럼 품이 넓어서, 이런저런 사람과 이야기를 다 받아주는 편이에요. 다만 속내를 잘 안 보여줄 때가 있어요."],
  "기":["기름진 논밭처럼 묵묵히 뭔가를 키워내는 사람이에요. 화려하진 않아도 실속을 잘 챙기고, 현실 감각이 좋아요.",
        "작은 텃밭을 알뜰히 가꾸듯, 소소한 것들을 세심하게 돌보는 재주가 있어요. 걱정이 많은 편일 수 있어요."],
  "경":["잘 벼린 무쇠처럼 단단하고 원칙적인 사람이에요. 맺고 끊는 게 분명하고, 옳다고 생각하면 밀어붙여요.",
        "가공되기 전 원석 같은 힘이 있어요. 거칠어 보여도 의리 있고, 한번 정한 편은 끝까지 지켜줘요."],
  "신":["섬세하게 세공된 보석처럼 예민하고 정교한 감각을 가졌어요. 디테일을 놓치지 않고, 미적인 감각도 좋은 편이에요.",
        "반짝이는 장신구처럼 눈에 띄고 싶어하는 마음이 있어요. 자존심이 세고, 인정받는 걸 중요하게 여겨요."],
  "임":["큰 강물처럼 스케일이 크고 생각이 트여있는 사람이에요. 한 곳에 고여있기보다 늘 새로운 곳으로 흘러가고 싶어해요.",
        "밀물처럼 오갈 때마다 다른 얼굴을 보여줘요. 머리 회전이 빠르고, 지략이 필요한 상황에서 빛나요."],
  "계":["새벽 이슬처럼 맑고 조용한 사람이에요. 겉으로 드러내진 않아도 속으로는 깊이 생각하고, 촉이 좋은 편이에요.",
        "낮은 곳으로 스며드는 물처럼 적응력이 좋아요. 눈치가 빠르고, 사람 마음을 읽는 감이 남달라요."]
};
const OHENG_STRONG_TEXT = {
  wood:["글자 곳곳에 목(木) 기운이 진하게 스며 있어요. 뭔가를 새로 벌이고 키워나가는 힘이 강한 편이에요.",
        "뻗어나가려는 목(木) 기운이 두드러져요. 가만히 있기보다 계획을 세우고 일단 움직이는 쪽에 가까워요.",
        "성장하려는 목(木) 기운이 사주 곳곳에 자리해요. 새로운 목표를 세우면 유독 추진력이 붙는 편이에요."],
  fire:["화(火) 기운이 두드러져요. 감정도 에너지도 확 타오르는 편이라, 하고 싶은 일 앞에서는 속도가 빨라져요.",
        "타오르는 화(火) 기운이 진하게 자리해요. 마음먹은 걸 숨기지 못하고, 표현이 확실한 편이에요.",
        "화(火) 기운이 강하게 흘러요. 분위기를 밝히는 힘이 있고, 좋아하는 일 앞에서는 망설임이 적어요."],
  earth:["토(土) 기운이 든든하게 자리잡고 있어요. 잘 흔들리지 않고, 사람이든 일이든 오래 붙잡고 가는 힘이 있어요.",
         "묵직한 토(土) 기운이 사주를 받치고 있어요. 급하게 움직이기보다 제자리를 지키며 다지는 편이에요.",
         "토(土) 기운이 두텁게 자리해요. 사람이든 상황이든 쉽게 등지지 않고, 신뢰를 쌓아가는 힘이 있어요."],
  metal:["금(金) 기운이 뚜렷해요. 기준이 분명하고, 맺고 끊는 걸 명확히 하는 편이라 신뢰를 주는 타입이에요.",
         "날이 선 금(金) 기운이 진하게 흘러요. 흐지부지 넘어가는 걸 싫어하고, 할 말은 정확히 하는 편이에요.",
         "금(金) 기운이 강하게 자리해요. 원칙을 세우면 잘 지키고, 스스로에게도 엄격한 편이에요."],
  water:["수(水) 기운이 풍부해요. 생각이 유연하고 응용력이 좋아서, 상황이 바뀌어도 빠르게 방향을 찾아내요.",
         "수(水) 기운이 넉넉하게 흘러요. 머리 회전이 빠르고, 여러 가능성을 동시에 굴려보는 편이에요.",
         "깊은 수(水) 기운이 자리해요. 겉으로 잔잔해 보여도 속으로는 늘 다음 수를 준비해두는 타입이에요."]
};
const OHENG_LACK_TEXT = {
  wood:["다만 목(木) 기운은 거의 보이지 않아요. 새로운 걸 벌이기 전에 한 박자 쉬어가는 습관을 들이면 도움이 될 수 있어요.",
        "다만 목(木) 기운이 약해요. 시작하는 데 남들보다 마음의 준비가 좀 더 필요한 편일 수 있어요."],
  fire:["다만 화(火) 기운이 약해요. 마음속 열정을 표현하는 데 시간이 좀 걸리는 편일 수 있어요.",
        "다만 화(火) 기운이 부족해요. 속마음을 꺼내 보이기까지 한 걸음 더 필요한 편일 수 있어요."],
  earth:["다만 토(土) 기운이 부족해요. 한 가지를 오래 붙드는 게 다른 사람보다 조금 더 노력이 필요할 수 있어요.",
         "다만 토(土) 기운이 약해요. 마음을 다잡고 꾸준히 이어가는 데 의식적인 노력이 필요할 수 있어요."],
  metal:["다만 금(金) 기운이 약해요. 맺고 끊는 결정을 내릴 때 스스로에게 조금 관대해지려는 편일 수 있어요.",
         "다만 금(金) 기운이 부족해요. 단호하게 선을 긋는 게 남들보다 조금 어렵게 느껴질 수 있어요."],
  water:["다만 수(水) 기운이 부족해요. 낯선 상황에 적응하는 데 남들보다 준비 시간이 좀 더 필요할 수 있어요.",
         "다만 수(水) 기운이 약해요. 갑작스러운 변화 앞에서는 마음을 추스르는 데 시간이 조금 걸릴 수 있어요."]
};
const SIPSEONG_TEXT = {
  "비겁":["곁에 있는 사람, 함께하는 동료의 존재가 큰 힘이 되는 사주예요. 혼자보다 함께일 때 더 단단해져요.",
          "스스로에 대한 믿음이 단단한 사주예요. 남에게 기대기보다 내 힘으로 헤쳐나가려는 마음이 커요.",
          "비슷한 결의 사람들과 어울릴 때 유독 편안한 사주예요. 함께 나누는 자리에서 은근히 힘을 얻어요."],
  "식상":["표현하고 만들어내는 힘이 좋은 사주예요. 말이든 글이든 손끝의 무언가든, 밖으로 꺼내놓는 재주가 있어요.",
          "생각을 형태로 만들어내는 힘이 좋은 사주예요. 머릿속 아이디어를 그냥 두지 못하고 자꾸 실행에 옮겨요.",
          "재치와 표현력이 돋보이는 사주예요. 하고 싶은 말을 담아두기보다 자연스럽게 풀어내는 편이에요."],
  "재성":["현실 감각과 실속을 챙기는 힘이 좋은 사주예요. 손에 잡히는 결과를 만들어내는 데 능해요.",
          "계산이 빠르고 실용적인 사주예요. 감정보다 실질적인 이득을 먼저 따져보는 편이에요.",
          "부지런히 쌓아 올리는 힘이 좋은 사주예요. 눈앞의 목표를 현실로 만드는 데 소질이 있어요."],
  "관성":["책임감과 질서를 중요하게 여기는 사주예요. 맡은 자리에서 인정받는 걸 은근히 중요하게 생각해요.",
          "맡은 역할을 제대로 해내려는 마음이 강한 사주예요. 규칙과 체계 안에서 오히려 힘을 발휘해요.",
          "주변의 평가와 위치를 신경 쓰는 사주예요. 흐트러진 모습을 보이지 않으려는 마음이 있어요."],
  "인성":["배우고 받아들이는 힘이 좋은 사주예요. 공부든 사람 마음이든, 차곡차곡 쌓아가는 걸 잘해요.",
          "생각이 깊고 신중한 사주예요. 결정을 내리기 전에 충분히 이해하고 넘어가려는 편이에요.",
          "누군가의 도움과 배움을 잘 받아들이는 사주예요. 혼자 힘으로만 밀어붙이기보다 필요할 땐 기대는 지혜가 있어요."]
};
const SEASON_TEXT = {
  spring:["새싹이 움트는 봄에 태어났어요. 시작하는 일에는 유독 힘이 잘 붙는 편이에요.",
          "만물이 기지개를 켜는 계절의 기운을 타고났어요. 첫걸음을 떼는 용기가 자연스럽게 따라와요."],
  summer:["볕이 가장 뜨거운 여름에 태어났어요. 감정도 에너지도 확실하게 드러내는 편이에요.",
          "생명력이 절정인 계절의 기운이에요. 하고 싶은 걸 미루기보다 바로 움직이는 타입일 확률이 높아요."],
  autumn:["열매가 여무는 가을에 태어났어요. 겉치레보다 알맹이, 결과물을 중요하게 여기는 편이에요.",
          "거두고 정리하는 계절의 기운을 가졌어요. 마무리를 깔끔하게 짓는 데 강점이 있어요."],
  winter:["고요히 다음을 준비하는 겨울에 태어났어요. 겉으로 서두르지 않아도 속으로는 다 계획이 있는 편이에요.",
          "씨앗이 땅속에서 힘을 모으는 계절의 기운이에요. 묵묵히 준비했다가 결정적 순간에 힘을 발휘해요."]
};
const CLOSING_TEXT = [
  "오늘 하루도, 타고난 결 그대로 자연스럽게 흘러가길 바라요.",
  "가진 기운을 너무 억누르지 말고, 오늘은 자기 편이 되어주는 하루였으면 해요.",
  "완벽하지 않아도 괜찮아요. 지금의 결 그대로도 이미 충분히 잘 하고 있어요.",
  "오늘 엽서가 작은 위로나 응원 한 조각이 되었으면 좋겠어요.",
  "무엇을 타고났든, 그 결을 아는 것만으로도 오늘 하루가 조금은 더 편해질 거예요.",
  "이 결이 정답은 아니지만, 나를 이해하는 작은 힌트가 되었으면 해요.",
  "타고난 기운을 탓하기보다, 오늘은 그 기운과 잘 지내보는 하루가 되길 바라요."
];

const TODAY_SIPSEONG_TEXT = {
  "비견":["오늘은 비견의 기운이 드는 날이에요. 나와 비슷한 사람과 힘을 합치면 좋지만, 괜한 자존심 대결은 피하는 게 나아요.",
          "비견의 기운이 드는 날이에요. 남에게 기대기보다 스스로 해내고 싶은 마음이 커지는 날이에요.",
          "비견의 기운이 드는 날이에요. 같은 편이라 여겨지는 사람과는 힘이 배로 나지만, 경쟁심은 잠시 내려두는 게 좋아요.",
          "비견의 기운이 드는 날이에요. 혼자 해내려는 마음과 함께하려는 마음 사이에서 균형을 잡아보면 좋아요."],
  "겁재":["겁재의 기운이 드는 날이에요. 지출은 한 번 더 확인하고, 사람들과 어울리는 자리에서는 매력이 빛나는 날이에요.",
          "겁재의 기운이 드는 날이에요. 즉흥적인 지출이나 결정은 하루쯤 미뤄두는 게 나아요.",
          "겁재의 기운이 드는 날이에요. 평소보다 사교성이 살아나는 날이니, 새로운 사람과의 자리도 나쁘지 않아요.",
          "겁재의 기운이 드는 날이에요. 손해 보는 느낌이 들어도 사람 사이의 정은 오히려 두터워질 수 있는 날이에요."],
  "식신":["식신의 기운이 드는 날이에요. 먹고 만들고 표현하는 일이 술술 풀려요. 맛있는 것도 챙겨 드세요.",
          "식신의 기운이 드는 날이에요. 여유롭게 몰입할 수 있는 날이니, 좋아하는 일에 시간을 내보세요.",
          "식신의 기운이 드는 날이에요. 마음이 느긋해지는 날이라, 서두르지 않아도 결과가 나쁘지 않을 거예요.",
          "식신의 기운이 드는 날이에요. 편안한 분위기 속에서 뜻밖의 즐거움을 발견할 수 있는 날이에요."],
  "상관":["상관의 기운이 드는 날이에요. 하고 싶은 말이 많아지는 날이니, 표현은 하되 한 번만 다듬어서 전해봐요.",
          "상관의 기운이 드는 날이에요. 예리한 감각이 살아나는 날이에요. 직설적인 말은 한 김 식혀서 전해봐요.",
          "상관의 기운이 드는 날이에요. 평소 참아왔던 생각이 튀어나오기 쉬운 날이니, 타이밍을 살짝 골라봐요.",
          "상관의 기운이 드는 날이에요. 평소보다 재치가 돋보이는 날이니, 유머 감각을 발휘해봐도 좋아요."],
  "편재":["편재의 기운이 드는 날이에요. 예상 밖의 기회나 자잘한 행운이 들어올 수 있어요. 무리한 베팅보다는 흐름을 즐겨봐요.",
          "편재의 기운이 드는 날이에요. 계획에 없던 만남이나 정보가 뜻밖의 도움이 될 수 있는 날이에요.",
          "편재의 기운이 드는 날이에요. 씀씀이가 헐거워지기 쉬운 날이니, 큰 지출은 한 번 더 생각해봐요.",
          "편재의 기운이 드는 날이에요. 여러 갈래의 기회가 동시에 보일 수 있으니, 하나를 골라 집중해봐요."],
  "정재":["정재의 기운이 드는 날이에요. 착실히 쌓아온 게 실속으로 돌아오는 날이에요. 계획했던 일은 그대로 밀고 나가도 좋아요.",
          "정재의 기운이 드는 날이에요. 숫자나 계약처럼 꼼꼼함이 필요한 일을 처리하기에 유독 안정적인 날이에요.",
          "정재의 기운이 드는 날이에요. 평소 하던 대로만 해도 무난하게 흘러가는 날이에요.",
          "정재의 기운이 드는 날이에요. 성실하게 처리한 일이 조용히 인정받는 날이에요."],
  "편관":["편관의 기운이 드는 날이에요. 갑자기 일이 몰리거나 긴장되는 상황이 생길 수 있어요. 순발력을 믿고 움직여봐요.",
          "편관의 기운이 드는 날이에요. 평소보다 긴장감이 도는 날이니, 일정은 살짝 여유 있게 잡아두는 게 좋아요.",
          "편관의 기운이 드는 날이에요. 부담스러운 상황일수록 오히려 순발력이 살아나는 날이에요.",
          "편관의 기운이 드는 날이에요. 예상치 못한 책임이 주어져도, 해내고 나면 자신감이 붙는 날이에요."],
  "정관":["정관의 기운이 드는 날이에요. 원칙대로 움직이면 인정받는 날이에요. 맡은 몫을 제대로 해내면 좋은 평가가 따라와요.",
          "정관의 기운이 드는 날이에요. 미뤄뒀던 서류나 약속을 처리하기에 좋은 날이에요.",
          "정관의 기운이 드는 날이에요. 절차와 순서를 지키면 오히려 일이 매끄럽게 풀리는 날이에요.",
          "정관의 기운이 드는 날이에요. 신뢰를 지키는 태도가 특히 빛을 발하는 날이에요."],
  "편인":["편인의 기운이 드는 날이에요. 엉뚱한 아이디어나 낯선 배움이 뜻밖의 도움이 되는 날이에요.",
          "편인의 기운이 드는 날이에요. 평소와 다른 방식으로 접근하면 의외의 답이 보이는 날이에요.",
          "편인의 기운이 드는 날이에요. 혼자만의 시간에 문득 좋은 아이디어가 떠오를 수 있는 날이에요.",
          "편인의 기운이 드는 날이에요. 익숙하지 않은 정보라도 열린 마음으로 받아들이면 도움이 되는 날이에요."],
  "정인":["정인의 기운이 드는 날이에요. 누군가의 도움이나 반가운 소식이 올 수 있어요. 배우고 쉬는 데 마음을 써봐요.",
          "정인의 기운이 드는 날이에요. 몸과 마음을 돌보는 데 시간을 쓰면 유독 회복이 빠른 날이에요.",
          "정인의 기운이 드는 날이에요. 차분히 배우고 익히는 일이 특히 잘 붙는 날이에요.",
          "정인의 기운이 드는 날이에요. 따뜻한 응원이나 조언이 마음에 오래 남는 날이에요."]
};
const ELEM_TODAY_FILL = {
  wood:["마침 사주에 부족했던 목(木) 기운을 채워주는 날이에요. 새로운 걸 시작해보기 괜찮은 타이밍이에요.",
        "부족했던 목(木) 기운이 오늘 채워져요. 미뤄뒀던 계획을 다시 꺼내보기 좋은 날이에요.",
        "오늘은 목(木) 기운이 살짝 채워지는 날이에요. 작은 시작이라도 한 걸음 떼어보면 좋아요."],
  fire:["마침 부족했던 화(火) 기운이 채워지는 날이에요. 평소보다 마음을 조금 더 표현해봐도 좋아요.",
        "화(火) 기운이 오늘 채워져요. 속마음을 꺼내 보이기에 평소보다 수월한 날이에요.",
        "오늘은 화(火) 기운이 살짝 살아나는 날이에요. 좋아하는 걸 좋아한다고 말해봐도 좋아요."],
  earth:["마침 부족했던 토(土) 기운이 채워지는 날이에요. 미뤄뒀던 일을 진득하게 붙잡아보기 좋은 날이에요.",
         "토(土) 기운이 오늘 채워져요. 흔들리던 마음이 오늘은 조금 더 자리를 잡을 수 있어요.",
         "오늘은 토(土) 기운이 살짝 채워지는 날이에요. 하나를 오래 붙드는 데 평소보다 힘이 덜 들어요."],
  metal:["마침 부족했던 금(金) 기운이 채워지는 날이에요. 미뤄온 결정을 매듭짓기에 괜찮은 타이밍이에요.",
         "금(金) 기운이 오늘 채워져요. 흐릿했던 기준이 오늘은 조금 더 선명해질 수 있어요.",
         "오늘은 금(金) 기운이 살짝 채워지는 날이에요. 미루던 정리를 시작해보기 좋은 날이에요."],
  water:["마침 부족했던 수(水) 기운이 채워지는 날이에요. 낯선 상황에도 평소보다 유연하게 대처할 수 있을 거예요.",
         "수(水) 기운이 오늘 채워져요. 막혀 있던 생각이 오늘은 조금 더 잘 풀릴 수 있어요.",
         "오늘은 수(水) 기운이 살짝 채워지는 날이에요. 새로운 정보나 상황을 받아들이기에 좋은 타이밍이에요."]
};
const ELEM_TODAY_OVER = {
  wood:["원래도 강한 목(木) 기운이 오늘 한 번 더 힘을 받는 날이에요. 벌이는 것보다 마무리에 마음을 써보면 균형이 맞아요.",
        "목(木) 기운이 오늘 한층 더 세지는 날이에요. 새 일을 더 벌이기보다 하나를 끝내는 데 집중해봐요.",
        "가뜩이나 강한 목(木) 기운이 오늘 넘치는 날이에요. 속도를 조금 늦춰도 괜찮아요."],
  fire:["원래도 강한 화(火) 기운이 오늘 더 세지는 날이에요. 감정이 앞서지 않게 한 박자 쉬어가면 좋아요.",
        "화(火) 기운이 오늘 한층 더 뜨거워지는 날이에요. 욱하는 마음이 들면 잠깐 숨을 고르고 넘어가요.",
        "가뜩이나 강한 화(火) 기운이 오늘 넘치는 날이에요. 열정은 좋지만 오늘은 페이스 조절이 필요해요."],
  earth:["원래도 든든한 토(土) 기운이 오늘 더 단단해지는 날이에요. 고집을 살짝 내려두면 더 편안해질 거예요.",
         "토(土) 기운이 오늘 한층 더 두터워지는 날이에요. 익숙한 방식만 고집하지 말고 조금 열어둬도 좋아요.",
         "가뜩이나 든든한 토(土) 기운이 오늘 넘치는 날이에요. 변화를 살짝 받아들여보면 균형이 맞아요."],
  metal:["원래도 뚜렷한 금(金) 기운이 오늘 더 강해지는 날이에요. 너무 날 서지 않게, 마음에 여유를 조금 남겨두세요.",
         "금(金) 기운이 오늘 한층 더 날카로워지는 날이에요. 옳고 그름을 따지기 전에 한 번 더 헤아려봐요.",
         "가뜩이나 뚜렷한 금(金) 기운이 오늘 넘치는 날이에요. 기준을 잠시 느슨하게 풀어줘도 괜찮아요."],
  water:["원래도 풍부한 수(水) 기운이 오늘 더 넘치는 날이에요. 생각이 너무 많아지지 않게 정리하는 시간을 가져봐요.",
         "수(水) 기운이 오늘 한층 더 깊어지는 날이에요. 이 생각 저 생각에 휩쓸리지 않게 우선순위를 정해봐요.",
         "가뜩이나 풍부한 수(水) 기운이 오늘 넘치는 날이에요. 결정을 미루기보다 한 번은 매듭을 지어봐요."]
};
/* 십성/오행 문단과 별개로, 매일 두 문장이 독립적으로 뽑혀 붙는 한마디 — 두 풀의 조합만으로 변주를 크게 늘려줌 */
const TODAY_TAIL_MOOD = [
  "오늘은 평소보다 마음이 조금 가벼워지는 날일 수 있어요.",
  "괜히 마음이 분주해지기 쉬운 하루가 될 수 있어요.",
  "생각보다 순조롭게 흘러가는 하루가 될 가능성이 커요.",
  "예상치 못한 변수가 하나쯤 끼어들 수 있는 날이에요.",
  "차분히 자기 페이스를 지키기 좋은 하루예요.",
  "평소보다 사람들과의 접점이 많아질 수 있는 날이에요.",
  "몸이나 마음의 신호를 평소보다 더 잘 느낄 수 있는 날이에요.",
  "작은 결정 하나가 하루의 분위기를 좌우할 수 있는 날이에요."
];
const TODAY_TAIL_TIP = [
  "오늘 하루, 계획한 것 중 하나만 제대로 해내도 충분해요.",
  "무리한 일정보다는, 나에게 맞는 속도를 지키는 게 좋아요.",
  "작은 컨디션 변화에도 귀 기울이면 하루가 한결 편해질 거예요.",
  "오늘은 남과 비교하지 말고, 어제의 나보다 조금 나은 하루면 충분해요.",
  "예상 밖의 일이 생기더라도, 당황하지 않고 흐름을 따라가면 괜찮을 거예요.",
  "하루 끝에 스스로를 다독이는 한마디를 남겨보는 것도 좋겠어요.",
  "중요한 결정은 오전보다 마음이 가라앉은 뒤로 미뤄봐도 좋아요.",
  "오늘 느낀 감정을 짧게라도 기록해두면 나중에 도움이 될 거예요."
];

function pick(arr, seed){ return arr[mod(seed, arr.length)]; }

function seasonKey(monthIdx){
  if(monthIdx<=2) return "spring";
  if(monthIdx<=5) return "summer";
  if(monthIdx<=8) return "autumn";
  return "winter";
}

/* =======================================================
   UI
   ======================================================= */
const form = document.getElementById('sajuForm');
const noTimeChk = document.getElementById('noTime');
const timeInput = document.getElementById('ftime');
noTimeChk.addEventListener('change', ()=>{
  timeInput.disabled = noTimeChk.checked;
  if(noTimeChk.checked) timeInput.value = "";
});

document.getElementById('againBtn').addEventListener('click', ()=>{
  document.getElementById('result').classList.remove('show');
  const formCard = document.getElementById('formCard');
  formCard.style.display = '';
  if(openedViaShareLink){
    document.getElementById('fdate').value = '';
    document.getElementById('fname').value = '';
    document.getElementById('trueSolar').checked = true;
    noTimeChk.checked = false;
    timeInput.value = '';
    timeInput.disabled = false;
  }
  formCard.scrollIntoView({behavior:'smooth', block:'start'});
});

form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const dateVal = document.getElementById('fdate').value;
  if(!dateVal) return;
  const [y,mo,d] = dateVal.split('-').map(Number);
  const hasTime = !noTimeChk.checked && !!timeInput.value;
  let h=12, mi=0;
  if(hasTime){ [h,mi] = timeInput.value.split(':').map(Number); }
  const trueSolar = document.getElementById('trueSolar').checked;
  const name = document.getElementById('fname').value.trim();

  const input = {y,mo,d,h,mi,hasTime,trueSolar,name};
  saveSelfEntry(input);
  const res = computeSaju(input);
  render(res, input);
});

/* 한번 만든 결과는 이 브라우저에 저장해두고, 다시 방문하면 자동으로 불러옴 */
const SELF_STORAGE_KEY = 'sajuyeopseo_self_v1';
function saveSelfEntry(input){
  try{ localStorage.setItem(SELF_STORAGE_KEY, JSON.stringify(input)); }catch(err){ /* 저장 불가 환경은 조용히 무시 */ }
}
function loadSelfEntry(){
  try{
    const raw = localStorage.getItem(SELF_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(err){ return null; }
}

function pillarChar(stemIdx, branchIdx){
  return { stem:STEMS[stemIdx], stemH:STEM_HANJA[stemIdx], branch:BRANCHES[branchIdx], branchH:BRANCH_HANJA[branchIdx],
           elemStem:STEM_ELEM[stemIdx], elemBranch:BRANCH_ELEM[branchIdx] };
}

function render(res, meta){
  const { yp, mp, dp, hp, monthIdx } = res;
  const pillars = [
    { key:'년주', p:yp }, { key:'월주', p:mp }, { key:'일주', p:dp }
  ];
  if(hp) pillars.push({ key:'시주', p:hp });

  // 그리드
  const grid = document.getElementById('pillarsGrid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${pillars.length},1fr)`;
  pillars.forEach(({key,p})=>{
    const el = document.createElement('div');
    el.className='pillar';
    el.innerHTML = `<div class="label">${key}</div>
      <div class="gan">${STEMS[p.stemIdx]}</div>
      <div class="ji">${BRANCHES[p.branchIdx]}</div>
      <div class="hanja">${STEM_HANJA[p.stemIdx]}${BRANCH_HANJA[p.branchIdx]}</div>`;
    grid.appendChild(el);
  });

  // 오행 집계 (8자 또는 6자)
  const chars = [];
  pillars.forEach(({p})=>{
    chars.push({ elem: STEM_ELEM[p.stemIdx] });
    chars.push({ elem: BRANCH_ELEM[p.branchIdx] });
  });
  const ohengCnt = tallyOheng(chars);
  const ohengBox = document.getElementById('ohengBars');
  ohengBox.innerHTML = '';
  const maxCnt = Math.max(...ohengCnt, 1);
  ELEM_NAMES.forEach((nm,i)=>{
    const pct = Math.round((ohengCnt[i]/maxCnt)*100);
    const row = document.createElement('div');
    row.className='oheng-row';
    row.innerHTML = `<div class="nm">${nm}</div>
      <div class="bar-bg"><div class="bar-fill" style="width:${ohengCnt[i]===0?0:Math.max(pct,10)}%; background:var(--el-${ELEM_VARS[i]})"></div></div>
      <div class="cnt">${ohengCnt[i]}</div>`;
    ohengBox.appendChild(row);
  });

  // 십성 집계 (일간 제외 나머지 문자들, 일주 지지 포함)
  const dayStemIdx = dp.stemIdx;
  const sipseongTargets = [];
  sipseongTargets.push(yp.stemIdx, BRANCH_MAIN_STEM[yp.branchIdx]);
  sipseongTargets.push(mp.stemIdx, BRANCH_MAIN_STEM[mp.branchIdx]);
  sipseongTargets.push(BRANCH_MAIN_STEM[dp.branchIdx]);
  if(hp) sipseongTargets.push(hp.stemIdx, BRANCH_MAIN_STEM[hp.branchIdx]);

  const groupCnt = { "비겁":0,"식상":0,"재성":0,"관성":0,"인성":0 };
  sipseongTargets.forEach(t=>{
    const ss = sipseongOf(dayStemIdx, t);
    if(SIPSEONG_GROUP[ss]) groupCnt[SIPSEONG_GROUP[ss]]++;
  });
  const tagBox = document.getElementById('sipseongTags');
  tagBox.innerHTML = '';
  Object.entries(groupCnt).forEach(([g,c])=>{
    if(c<=0) return;
    const tag = document.createElement('span');
    tag.className='tag';
    tag.textContent = `${g} ${c}`;
    tagBox.appendChild(tag);
  });

  // seed
  const seed = yp.branchIdx*97 + mp.stemIdx*31 + dp.stemIdx*13 + dp.branchIdx*7 + (hp? hp.branchIdx*3:1);

  // to line
  document.getElementById('toName').textContent = meta.name? `${meta.name}에게` : '나에게';
  document.getElementById('toMeta').textContent = `${meta.y}.${String(meta.mo).padStart(2,'0')}.${String(meta.d).padStart(2,'0')}` + (meta.hasTime? ` ${String(meta.h).padStart(2,'0')}:${String(meta.mi).padStart(2,'0')}` : ' · 시간 모름');

  const stampMap = ["🌱","🔥","⛰️","⚙️","🌊"];
  const dominantElemIdx = ohengCnt.indexOf(Math.max(...ohengCnt));
  document.getElementById('stampEmoji').textContent = stampMap[dominantElemIdx];

  // 편지 본문
  const dayStemName = STEMS[dayStemIdx];
  const lackIdx = ohengCnt.indexOf(0);
  const sortedGroups = Object.entries(groupCnt).sort((a,b)=>b[1]-a[1]);
  const topGroup = sortedGroups[0][1] > 0 ? sortedGroups[0][0] : null;
  const season = seasonKey(monthIdx);

  const paras = [];
  paras.push(pick(ILGAN_TEXT[dayStemName], seed));
  let ohengPara = pick(OHENG_STRONG_TEXT[ELEM_VARS[dominantElemIdx]], seed+1);
  if(lackIdx>=0 && lackIdx!==dominantElemIdx){ ohengPara += " " + pick(OHENG_LACK_TEXT[ELEM_VARS[lackIdx]], seed+5); }
  paras.push(ohengPara);
  if(topGroup) paras.push(pick(SIPSEONG_TEXT[topGroup], seed+2));
  paras.push(pick(SEASON_TEXT[season], seed+3));
  paras.push(pick(CLOSING_TEXT, seed+4));

  const letterEl = document.getElementById('letterBody');
  letterEl.innerHTML = paras.map(p=>`<p>${p}</p>`).join('');

  // 더 자세히 보기 패널
  const PILLAR_MEANING = {
    '년주':'조상과 어린 시절의 기운, 사회에서 보여지는 첫인상을 나타내요.',
    '월주':'부모형제와 성장기, 사회생활의 바탕이 되는 자리예요.',
    '일주':'나 자신과 배우자 자리를 함께 나타내는, 사주의 중심이에요.',
    '시주':'자녀와 말년, 내가 이뤄가는 결실을 보여줘요.'
  };
  const pillarMeaningHTML = pillars.map(({key,p})=>
    `<p class="pillar-meaning"><b>${key} ${STEMS[p.stemIdx]}${BRANCHES[p.branchIdx]}(${STEM_HANJA[p.stemIdx]}${BRANCH_HANJA[p.branchIdx]})</b> — ${PILLAR_MEANING[key]}</p>`
  ).join('');

  function ohengTier(n){
    if(n<=0) return '이 기운은 사주에 거의 보이지 않아요.';
    if(n===1) return '이 기운이 아주 살짝 자리하고 있어요.';
    if(n===2) return '이 기운이 적당히 자리잡고 있어요.';
    if(n===3) return '이 기운이 꽤 강하게 자리잡고 있어요.';
    return '이 기운이 아주 강하게, 사주 전체를 주도하고 있어요.';
  }
  const ohengDetailHTML = ELEM_NAMES.map((nm,i)=>
    `<p><b>${nm}(${["木","火","土","金","水"][i]}) ${ohengCnt[i]}개</b> — ${ohengTier(ohengCnt[i])}</p>`
  ).join('');

  const groupOrder = ["비겁","식상","재성","관성","인성"];
  const sipseongDetailHTML = groupOrder.map(g=>{
    const c = groupCnt[g];
    const txt = c>0 ? SIPSEONG_TEXT[g][0] : '이번 사주에는 이 기운이 나타나지 않았어요.';
    return `<p><b>${g} ${c}개</b> — ${txt}</p>`;
  }).join('');

  document.getElementById('detailPanel').innerHTML = `
    <div class="detail-block">
      <h4>네 기둥이 담은 뜻</h4>
      ${pillarMeaningHTML}
    </div>
    <div class="detail-block">
      <h4>오행 전체 흐름</h4>
      ${ohengDetailHTML}
    </div>
    <div class="detail-block">
      <h4>십성 전체 구성</h4>
      ${sipseongDetailHTML}
    </div>
  `;

  lastChart = { dayStemIdx, dp, ohengCnt, groupCnt, dominantElemIdx, lackIdx };
  lastMeta = meta;
  renderToday();

  // 이전 궁합 결과는 새 결과에 맞지 않으니 정리
  const cOut = document.getElementById('compareOutput');
  if(cOut){ cOut.classList.remove('show'); cOut.innerHTML=''; }

  const resultEl = document.getElementById('result');
  resultEl.classList.add('show');
  resultEl.scrollIntoView({behavior:'smooth', block:'start'});
}

/* =======================================================
   오늘의 운세
   ======================================================= */
let lastChart = null;
let lastMeta = null;

function getTodayKST(){
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit'
  }).formatToParts(new Date());
  const map = {};
  parts.forEach(p=>{ map[p.type]=p.value; });
  return { y:Number(map.year), mo:Number(map.month), d:Number(map.day) };
}

function renderToday(){
  if(!lastChart) return;
  const { y, mo, d } = getTodayKST();
  const todayDP = dayPillar(kstToUTC(y, mo, d, 12, 0));
  const ss = sipseongOf(lastChart.dayStemIdx, todayDP.stemIdx);
  const group = SIPSEONG_GROUP[ss];
  const todayBranchElemIdx = BRANCH_ELEM[todayDP.branchIdx];

  const paras = [];
  if(group && TODAY_SIPSEONG_TEXT[ss]) paras.push(pick(TODAY_SIPSEONG_TEXT[ss], todayDP.stemIdx*7 + todayDP.branchIdx));

  const todaySeed = todayDP.stemIdx*11 + todayDP.branchIdx*5;
  if(lastChart.lackIdx>=0 && todayBranchElemIdx===lastChart.lackIdx){
    paras.push(pick(ELEM_TODAY_FILL[ELEM_VARS[todayBranchElemIdx]], todaySeed));
  } else if(todayBranchElemIdx===lastChart.dominantElemIdx){
    paras.push(pick(ELEM_TODAY_OVER[ELEM_VARS[todayBranchElemIdx]], todaySeed));
  }

  const moodSeed = todayDP.stemIdx*9 + todayDP.branchIdx*4 + lastChart.dayStemIdx;
  const tipSeed = todayDP.stemIdx*13 + todayDP.branchIdx*17 + lastChart.dayStemIdx*3;
  paras.push(`${pick(TODAY_TAIL_MOOD, moodSeed)} ${pick(TODAY_TAIL_TIP, tipSeed)}`);

  document.getElementById('todayBody').innerHTML = paras.map(p=>`<p>${p}</p>`).join('');
  document.getElementById('todayGanji').innerHTML =
    `${STEMS[todayDP.stemIdx]}${BRANCHES[todayDP.branchIdx]}<span class="hj">${STEM_HANJA[todayDP.stemIdx]}${BRANCH_HANJA[todayDP.branchIdx]}일</span>`;

  const weekday = new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', month:'long', day:'numeric', weekday:'short' }).format(new Date());
  document.getElementById('todayDateLabel').textContent = weekday;

  document.getElementById('todayNote').style.display = 'block';
}

document.getElementById('todayRefresh').addEventListener('click', renderToday);

/* =======================================================
   궁합용 사주 분석 헬퍼 (render() 안의 집계 로직과 동일한 방식)
   ======================================================= */
function analyzeChart(res){
  const { yp, mp, dp, hp } = res;
  const pillars = [{key:'년주',p:yp},{key:'월주',p:mp},{key:'일주',p:dp}];
  if(hp) pillars.push({key:'시주',p:hp});
  const chars = [];
  pillars.forEach(({p})=>{
    chars.push({ elem: STEM_ELEM[p.stemIdx] });
    chars.push({ elem: BRANCH_ELEM[p.branchIdx] });
  });
  const ohengCnt = tallyOheng(chars);
  const dayStemIdx = dp.stemIdx;
  const sipseongTargets = [yp.stemIdx, BRANCH_MAIN_STEM[yp.branchIdx], mp.stemIdx, BRANCH_MAIN_STEM[mp.branchIdx], BRANCH_MAIN_STEM[dp.branchIdx]];
  if(hp) sipseongTargets.push(hp.stemIdx, BRANCH_MAIN_STEM[hp.branchIdx]);
  const groupCnt = { "비겁":0,"식상":0,"재성":0,"관성":0,"인성":0 };
  sipseongTargets.forEach(t=>{ const ss=sipseongOf(dayStemIdx,t); if(SIPSEONG_GROUP[ss]) groupCnt[SIPSEONG_GROUP[ss]]++; });
  const dominantElemIdx = ohengCnt.indexOf(Math.max(...ohengCnt));
  const lackIdx = ohengCnt.indexOf(0);
  return { pillars, ohengCnt, groupCnt, dayStemIdx, dp, dominantElemIdx, lackIdx };
}

/* 한글 조사(이/가, 은/는, 을/를, 와/과) 자동 선택 — 받침 유무 + '나'의 불규칙(내가) 처리 */
function hasBatchim(str){
  if(!str) return false;
  const ch = str.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if(code < 0xAC00 || code > 0xD7A3) return false;
  return (code - 0xAC00) % 28 !== 0;
}
function withGa(name){ if(name==='나') return '내가'; return hasBatchim(name) ? `${name}이` : `${name}가`; }
function withNeun(name){ return hasBatchim(name) ? `${name}은` : `${name}는`; }
function withReul(name){ return hasBatchim(name) ? `${name}을` : `${name}를`; }
function withWa(name){ return hasBatchim(name) ? `${name}과` : `${name}와`; }
function withE(name){ return `${name}에게`; }

const COMPAT_TEXT = {
  "비겁": [
    (A,B)=>`${withWa(A)} ${withNeun(B)} 서로 비슷한 기운을 타고났어요. 통하는 게 많아서 편안하지만, 취향도 고집도 겹쳐서 가끔은 부딪힐 수 있어요.`,
    (A,B)=>`${withGa(A)} ${withGa(B)} 결이 참 비슷한 관계예요. 굳이 설명하지 않아도 통하는 게 많아서 편안한 사이예요.`,
    (A,B)=>`${withWa(A)} ${withNeun(B)} 닮은 기운을 갖고 있어요. 편안하게 잘 맞지만, 둘 다 고집이 있어서 양보가 필요한 순간도 있을 거예요.`,
    (A,B)=>`${withGa(A)} ${withGa(B)} 겹치는 부분이 많은 관계예요. 같은 걸 좋아할 확률이 높아서 이야기가 잘 통해요.`
  ],
  "식상": [
    (A,B)=>`${A}의 기운이 자연스럽게 ${withReul(B)} 북돋아주는 관계예요. ${withGa(A)} 이끌고 ${withGa(B)} 받아들이면 편안하게 잘 맞아요.`,
    (A,B)=>`${withGa(A)} 표현하면 ${withGa(B)} 자연스럽게 받아주는 관계예요. 대화가 술술 풀리는 편안한 사이예요.`,
    (A,B)=>`${A}의 기운이 ${withE(B)} 활력을 불어넣어주는 관계예요. ${withGa(B)} ${withE(A)} 맞장구쳐주면 케미가 좋아져요.`,
    (A,B)=>`${withGa(A)} 뭔가를 벌이면 ${withGa(B)} 옆에서 자연스럽게 살을 붙여주는 관계예요. 함께면 아이디어가 더 풍성해져요.`
  ],
  "재성": [
    (A,B)=>`${withGa(A)} 은근히 주도권을 쥐는 관계예요. ${withNeun(A)} 이끌고 ${withNeun(B)} 맞춰주는 흐름이 자연스러운 편이에요.`,
    (A,B)=>`${withGa(A)} ${withE(B)} 실속을 챙겨주는 관계예요. ${withGa(B)} 맞춰주면 서로에게 이득이 되는 사이예요.`,
    (A,B)=>`${withGa(A)} 흐름을 만들고 ${withGa(B)} 그 흐름에 올라타는 관계예요. 서로 손발이 잘 맞는 편이에요.`,
    (A,B)=>`${withGa(A)} ${withGa(B)} 실속을 챙기는 데 서로 도움이 되는 관계예요. 함께 계획을 세우면 결과가 더 좋아져요.`
  ],
  "관성": [
    (A,B)=>`${withGa(B)} ${withE(A)} 자극과 긴장감을 주는 관계예요. 덕분에 서로 자라나는 사이가 될 수 있어요.`,
    (A,B)=>`${withGa(B)} ${withE(A)} 은근한 긴장감을 주는 관계예요. 편하지만은 않아도, 서로를 성장시키는 힘이 있어요.`,
    (A,B)=>`${withGa(A)} ${withGa(B)} 서로에게 적당한 자극이 되는 관계예요. 부딪히는 순간도 있지만, 그만큼 배우는 것도 많아요.`,
    (A,B)=>`${withGa(A)} ${withGa(B)} 함께 있으면 자연스럽게 자세를 다잡게 되는 관계예요. 서로에게 좋은 자극이 돼요.`
  ],
  "인성": [
    (A,B)=>`${B}의 기운이 ${withReul(A)} 든든하게 채워주는 관계예요. ${withGa(A)} ${withE(B)} 편하게 기댈 수 있는 사이예요.`,
    (A,B)=>`${withGa(B)} ${withE(A)} 든든한 버팀목이 되어주는 관계예요. 기대고 싶을 때 편하게 기댈 수 있는 사이예요.`,
    (A,B)=>`${B}의 기운이 ${withE(A)} 안정감을 주는 관계예요. ${withGa(A)} 지치는 순간에 ${withGa(B)} 채워주는 힘이 있어요.`,
    (A,B)=>`${withGa(A)} ${withGa(B)} 마음을 나누기에 편안한 관계예요. 힘든 순간에 서로를 먼저 떠올리게 되는 사이예요.`
  ]
};
const COMPAT_CLOSING = [
  "잘 맞고 안 맞고보다, 서로 다른 결을 알아가는 재미가 있는 사이예요.",
  "궁합은 참고만 하고, 진짜 케미는 함께 보내는 시간이 만들어가는 거니까요.",
  "오늘 이 인연도 나름의 결이 있다는 것만 기억해두면 좋겠어요.",
  "결이 다르다고 안 맞는 건 아니에요. 서로를 알아가는 데 조금 더 마음을 쓰면 충분해요.",
  "오늘 본 궁합은 참고용이에요. 두 사람이 함께 채워가는 시간이 진짜 궁합을 만들어요.",
  "숫자보다 중요한 건, 오늘 이 인연을 어떻게 대하느냐일 거예요.",
  "궁합 점수보다, 오늘 서로를 향한 마음이 더 중요한 법이니까요."
];
const ELEM_COMPLEMENT_TEXT = {
  aFilled: [
    (nameA,nameB,elem)=>`${withE(nameA)} 부족했던 ${elem} 기운을, ${withGa(nameB)} 넉넉하게 채워줄 수 있어요.`,
    (nameA,nameB,elem)=>`${withGa(nameB)} 가진 ${elem} 기운이 ${withE(nameA)} 딱 필요했던 부분을 채워줘요.`,
    (nameA,nameB,elem)=>`${withE(nameA)} 아쉬웠던 ${elem} 기운을, ${withGa(nameB)} 자연스럽게 보완해주는 사이예요.`,
    (nameA,nameB,elem)=>`${withGa(nameB)} 채워주는 ${elem} 기운 덕분에, ${withGa(nameA)} 한결 편안해지는 관계예요.`
  ],
  sameDominant: [
    (nameA,nameB,elem)=>`둘 다 ${elem} 기운이 강한 편이라, 통하는 부분이 많을 거예요.`,
    (nameA,nameB,elem)=>`${elem} 기운이 강하다는 공통점이 있어요. 비슷한 방식으로 세상을 대하는 사이예요.`,
    (nameA,nameB,elem)=>`둘 다 ${elem} 기운이 짙은 편이에요. 같은 파장이라 이해가 빠른 관계예요.`,
    (nameA,nameB,elem)=>`${elem} 기운이 겹치는 만큼, 서로를 이해하는 속도가 빠른 관계예요.`
  ],
  different: [
    ()=>`서로 다른 기운을 갖고 있어요. 다름을 있는 그대로 즐기면 더 좋은 사이가 될 수 있어요.`,
    (nameA,nameB)=>`${withGa(nameA)} ${withGa(nameB)} 서로 다른 결의 기운을 갖고 있어요. 다른 만큼 서로에게 신선한 자극이 될 수 있어요.`,
    ()=>`기운의 결이 서로 다른 관계예요. 맞춰가는 재미가 있는 사이가 될 거예요.`,
    (nameA,nameB)=>`${withGa(nameA)} ${withGa(nameB)} 기운의 방향이 달라서, 서로에게 없는 걸 배울 수 있는 관계예요.`
  ]
};
function elemComplementText(nameA, nameB, chartA, chartB){
  const seed = chartA.dp.branchIdx*4 + chartB.dp.branchIdx*2 + chartA.dayStemIdx;
  if(chartA.lackIdx>=0 && chartB.ohengCnt[chartA.lackIdx]>0 && chartB.dominantElemIdx===chartA.lackIdx){
    return pick(ELEM_COMPLEMENT_TEXT.aFilled, seed)(nameA, nameB, ELEM_NAMES[chartA.lackIdx]);
  }
  if(chartB.lackIdx>=0 && chartA.ohengCnt[chartB.lackIdx]>0 && chartA.dominantElemIdx===chartB.lackIdx){
    return pick(ELEM_COMPLEMENT_TEXT.aFilled, seed)(nameB, nameA, ELEM_NAMES[chartB.lackIdx]);
  }
  if(chartA.dominantElemIdx===chartB.dominantElemIdx){
    return pick(ELEM_COMPLEMENT_TEXT.sameDominant, seed)(nameA, nameB, ELEM_NAMES[chartA.dominantElemIdx]);
  }
  return pick(ELEM_COMPLEMENT_TEXT.different, seed)(nameA, nameB);
}

/* 십성 관계 + 오행 상호보완을 바탕으로 계산하는 궁합 점수(60~99) */
const SIPSEONG_SCORE_BASE = { "비겁":60, "식상":80, "재성":70, "관성":45, "인성":88 };
function compatScore(chartA, chartB){
  const ss = sipseongOf(chartA.dayStemIdx, chartB.dayStemIdx);
  const group = SIPSEONG_GROUP[ss];
  let score = group ? SIPSEONG_SCORE_BASE[group] : 65;

  if(chartA.lackIdx>=0 && chartB.ohengCnt[chartA.lackIdx]>0 && chartB.dominantElemIdx===chartA.lackIdx){
    score += 12;
  } else if(chartB.lackIdx>=0 && chartA.ohengCnt[chartB.lackIdx]>0 && chartA.dominantElemIdx===chartB.lackIdx){
    score += 12;
  } else if(chartA.dominantElemIdx===chartB.dominantElemIdx){
    score -= 15;
  }

  const wiggle = mod(chartA.dp.branchIdx*5 + chartB.dp.branchIdx*3 + chartB.dayStemIdx, 25) - 12;
  score += wiggle;

  return Math.max(15, Math.min(99, score));
}

/* 궁합 결과 카드 HTML — 궁합 보기 직후 / 저장한 궁합 / 방명록에서 공통으로 사용 */
function compatDetailHTML(r){
  const scoreHTML = (r.score!=null)
    ? `<div class="compat-score">궁합 점수 <b>${r.score}</b><span class="unit">점</span></div>`
    : '';
  return `
    <div class="compare-pair">
      <div class="compare-person"><span class="stamp-mini">${r.stampA}</span><b>${r.pillarA}</b><span>${r.nameA}</span></div>
      <div class="compare-link">＋</div>
      <div class="compare-person"><span class="stamp-mini">${r.stampB}</span><b>${r.pillarB}</b><span>${r.nameB}</span></div>
    </div>
    ${scoreHTML}
    <p>${r.relText}</p>
    <p>${r.elemText}</p>
    <p>${r.closing}</p>
  `;
}
function showCompatDetail(r){
  document.getElementById('comparePanel').classList.add('open');
  const out = document.getElementById('compareOutput');
  out.innerHTML = compatDetailHTML(r);
  out.classList.add('show');
  document.getElementById('saveCompareBtn').classList.remove('show');
  out.scrollIntoView({behavior:'smooth', block:'center'});
}

const cNoTimeChk = document.getElementById('cNoTime');
const cTimeInput = document.getElementById('cftime');
cNoTimeChk.addEventListener('change', ()=>{
  cTimeInput.disabled = cNoTimeChk.checked;
  if(cNoTimeChk.checked) cTimeInput.value = "";
});

document.getElementById('compareForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  if(!lastChart) return;
  const dateVal = document.getElementById('cfdate').value;
  if(!dateVal) return;
  const [y,mo,d] = dateVal.split('-').map(Number);
  const hasTime = !cNoTimeChk.checked && !!cTimeInput.value;
  let h=12, mi=0;
  if(hasTime){ [h,mi] = cTimeInput.value.split(':').map(Number); }
  const trueSolar = document.getElementById('trueSolar').checked;
  const nameB = document.getElementById('cfname').value.trim() || '친구';
  const nameA = (lastMeta && lastMeta.name) || (openedViaShareLink ? '링크 주인' : '나');

  const resB = computeSaju({y,mo,d,h,mi,hasTime,trueSolar});
  const chartB = analyzeChart(resB);
  const chartA = lastChart;

  const ss = sipseongOf(chartA.dayStemIdx, chartB.dayStemIdx);
  const group = SIPSEONG_GROUP[ss];
  const compatSeed = chartA.dayStemIdx*13 + chartA.dp.branchIdx*7 + chartB.dayStemIdx*5 + chartB.dp.branchIdx*3;
  const relText = group ? pick(COMPAT_TEXT[group], compatSeed)(nameA, nameB) : '';
  const elemText = elemComplementText(nameA, nameB, chartA, chartB);
  const closing = pick(COMPAT_CLOSING, chartB.dayStemIdx + chartB.dp.branchIdx);
  const score = compatScore(chartA, chartB);

  const stampMap = ["🌱","🔥","⛰️","⚙️","🌊"];
  const pillarA = `${STEMS[chartA.dayStemIdx]}${BRANCHES[chartA.dp.branchIdx]}`;
  const pillarB = `${STEMS[chartB.dayStemIdx]}${BRANCHES[chartB.dp.branchIdx]}`;

  const record = {
    nameA, nameB, pillarA, pillarB,
    stampA: stampMap[chartA.dominantElemIdx], stampB: stampMap[chartB.dominantElemIdx],
    score, relText, elemText, closing
  };

  const out = document.getElementById('compareOutput');
  out.innerHTML = compatDetailHTML(record);
  out.classList.add('show');

  currentCompatRecord = record;
  const saveBtn = document.getElementById('saveCompareBtn');
  saveBtn.classList.add('show');
  saveBtn.disabled = false;
  saveBtn.textContent = '💾 이 궁합 저장하기';

  const today = new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
  const fingerprint = `${nameA}|${nameB}|${dateVal}|${hasTime ? cTimeInput.value : 'no-time'}`;
  if(!hasPublishedCompat(fingerprint) && !pendingCompatFingerprints.has(fingerprint)){
    pendingCompatFingerprints.add(fingerprint);
    publishCompatEntry({ ...record, forName: nameA, submittedAt: today }, fingerprint)
      .finally(()=> pendingCompatFingerprints.delete(fingerprint));
  }
});

/* =======================================================
   궁합 저장 (localStorage)
   ======================================================= */
const COMPAT_STORAGE_KEY = 'sajuyeopseo_compat_v1';
let currentCompatRecord = null;

function loadSavedCompat(){
  try{
    const raw = localStorage.getItem(COMPAT_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  }catch(err){ return []; }
}
function writeSavedCompat(list){
  try{ localStorage.setItem(COMPAT_STORAGE_KEY, JSON.stringify(list)); }catch(err){ /* 저장 불가 환경은 조용히 무시 */ }
}
function renderSavedCompatList(){
  const list = loadSavedCompat();
  const wrap = document.getElementById('savedListWrap');
  const box = document.getElementById('savedCompatList');
  if(list.length === 0){
    wrap.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  wrap.style.display = 'block';
  box.innerHTML = list.map((r,i)=>`
    <div class="saved-item" data-idx="${i}">
      <div class="si-main">
        <span class="si-names">${r.stampA} ${r.pillarA} ${r.nameA} · ${r.stampB} ${r.pillarB} ${r.nameB}${r.score!=null ? ` · ${r.score}점` : ''}</span>
        <div class="si-date">${r.savedAt}</div>
      </div>
      <button type="button" class="si-del" aria-label="삭제" data-idx="${i}">✕</button>
    </div>
  `).join('');

  box.querySelectorAll('.saved-item').forEach(el=>{
    el.addEventListener('click', (e)=>{
      if(e.target.classList.contains('si-del')) return;
      const idx = Number(el.dataset.idx);
      const r = loadSavedCompat()[idx];
      if(!r) return;
      showCompatDetail(r);
    });
  });
  box.querySelectorAll('.si-del').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const idx = Number(btn.dataset.idx);
      const list = loadSavedCompat();
      list.splice(idx,1);
      writeSavedCompat(list);
      renderSavedCompatList();
    });
  });
}

document.getElementById('saveCompareBtn').addEventListener('click', ()=>{
  if(!currentCompatRecord) return;
  const list = loadSavedCompat();
  const today = new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
  list.unshift({ ...currentCompatRecord, savedAt: today });
  writeSavedCompat(list.slice(0, 12));
  renderSavedCompatList();

  const btn = document.getElementById('saveCompareBtn');
  btn.disabled = true;
  btn.textContent = '💾 저장했어요';
  showToast('궁합을 저장했어요. 아래 목록에서 다시 볼 수 있어요.');
});

renderSavedCompatList();

/* =======================================================
   궁합 방명록 (Supabase에 저장되어 모두에게 공유되는 기록)
   ======================================================= */
let openedViaShareLink = false;

const supabaseClient = (typeof window.supabase !== 'undefined'
  && typeof SUPABASE_URL === 'string' && SUPABASE_URL && !SUPABASE_URL.includes('YOUR-PROJECT'))
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let compatBook = [];

function rowToCompatEntry(row){
  return {
    forName: row.for_name || '',
    nameA: row.name_a, nameB: row.name_b,
    pillarA: row.pillar_a, pillarB: row.pillar_b,
    stampA: row.stamp_a, stampB: row.stamp_b,
    score: (row.score===null || row.score===undefined) ? null : row.score,
    relText: row.rel_text, elemText: row.elem_text, closing: row.closing,
    submittedAt: row.submitted_at
  };
}

async function loadCompatBook(){
  if(!supabaseClient){ renderCompatBook(); return; }
  try{
    const { data, error } = await supabaseClient
      .from('compat_entries')
      .select('*')
      .order('created_at', { ascending:false })
      .limit(30);
    if(error) throw error;
    compatBook = (data || []).map(rowToCompatEntry);
  }catch(err){
    compatBook = [];
  }
  renderCompatBook();
}

function renderCompatBook(){
  const listEl = document.getElementById('compatBookList');
  const emptyEl = document.getElementById('compatBookEmpty');
  const label = document.getElementById('bookToggleLabel');
  const isOpen = document.getElementById('bookPanel').classList.contains('open');
  const closedLabel = compatBook.length ? `궁합 방명록 보기 (${compatBook.length})` : '궁합 방명록 보기';
  label.textContent = isOpen ? '접어두기' : closedLabel;
  if(compatBook.length === 0){
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';
  const ranked = compatBook
    .map((r,i)=>({ r, i }))
    .sort((a,b)=> (b.r.score ?? -1) - (a.r.score ?? -1));
  listEl.innerHTML = ranked.map(({r},rank)=>`
    <div class="saved-item" data-idx="${compatBook.indexOf(r)}">
      <div class="si-main">
        <span class="si-rank">${rank+1}위${r.score!=null ? ` · ${r.score}점` : ''}</span>
        <span class="si-names">${r.stampA} ${r.pillarA} ${r.nameA} · ${r.stampB} ${r.pillarB} ${r.nameB}</span>
        <div class="si-date">${r.forName ? `${r.forName}님에게 남긴 궁합 · ` : ''}${r.submittedAt}</div>
      </div>
    </div>
  `).join('');
  listEl.querySelectorAll('.saved-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      const idx = Number(el.dataset.idx);
      const r = compatBook[idx];
      if(!r) return;
      showCompatDetail(r);
    });
  });
}
loadCompatBook();

/* 같은 브라우저에서 같은 조합(이름+생년월일)을 다시 조회해도 방명록에 중복으로 올라가지 않도록 기록해둠 */
const PUBLISHED_COMPAT_KEY = 'sajuyeopseo_published_compat_v1';
const pendingCompatFingerprints = new Set();
function hasPublishedCompat(fingerprint){
  try{
    const raw = localStorage.getItem(PUBLISHED_COMPAT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) && list.includes(fingerprint);
  }catch(err){ return false; }
}
function markPublishedCompat(fingerprint){
  try{
    const raw = localStorage.getItem(PUBLISHED_COMPAT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = (Array.isArray(list) ? list : []).filter(fp=>fp!==fingerprint);
    next.push(fingerprint);
    localStorage.setItem(PUBLISHED_COMPAT_KEY, JSON.stringify(next.slice(-50)));
  }catch(err){ /* 저장 불가 환경은 조용히 무시 */ }
}

async function publishCompatEntry(entry, fingerprint){
  if(!supabaseClient){
    showToast('방명록 저장소가 아직 설정되지 않았어요. supabase-config.js를 확인해주세요.');
    return;
  }
  try{
    const { error } = await supabaseClient.from('compat_entries').insert({
      for_name: entry.forName || null,
      name_a: entry.nameA, name_b: entry.nameB,
      pillar_a: entry.pillarA, pillar_b: entry.pillarB,
      stamp_a: entry.stampA, stamp_b: entry.stampB,
      score: entry.score ?? null,
      rel_text: entry.relText, elem_text: entry.elemText, closing: entry.closing,
      submitted_at: entry.submittedAt
    });
    if(error) throw error;
    if(fingerprint) markPublishedCompat(fingerprint);
    compatBook.unshift(entry);
    if(compatBook.length > 30) compatBook.length = 30;
    renderCompatBook();
    showToast('궁합이 방명록에 자동으로 남았어요.');
  }catch(err){
    showToast('방명록 저장에 실패했어요. 잠시 후 다시 시도해주세요.');
  }
}

const bookToggle = document.getElementById('bookToggle');
const bookPanel = document.getElementById('bookPanel');
bookToggle.addEventListener('click', ()=>{
  const open = bookPanel.classList.toggle('open');
  bookToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.getElementById('bookToggleLabel').textContent =
    (open ? '접어두기' : (compatBook.length ? `궁합 방명록 보기 (${compatBook.length})` : '궁합 방명록 보기'));
});

/* =======================================================
   더 자세히 보기 토글
   ======================================================= */
const detailToggle = document.getElementById('detailToggle');
const detailPanel = document.getElementById('detailPanel');
detailToggle.addEventListener('click', ()=>{
  const open = detailPanel.classList.toggle('open');
  detailToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  detailToggle.querySelector('span').textContent = open ? '접어두기' : '더 자세히 보기';
});

/* =======================================================
   공유하기
   ======================================================= */
let toastTimer = null;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 2400);
}

function pad2(n){ return String(n).padStart(2,'0'); }

function buildShareUrl(meta, trueSolar){
  const params = new URLSearchParams();
  params.set('b', `${meta.y}${pad2(meta.mo)}${pad2(meta.d)}`);
  if(meta.hasTime) params.set('h', `${pad2(meta.h)}${pad2(meta.mi)}`);
  if(!trueSolar) params.set('s','0');
  if(meta.name) params.set('n', meta.name);
  const url = new URL(location.href);
  url.search = params.toString();
  url.hash = '';
  return url.toString();
}

document.getElementById('shareBtn').addEventListener('click', async ()=>{
  if(!lastMeta) return;
  const trueSolar = document.getElementById('trueSolar').checked;
  const shareUrl = buildShareUrl(lastMeta, trueSolar);
  const shareText = lastMeta.name
    ? `${lastMeta.name}의 사주엽서가 도착했어요 💌`
    : '내 사주엽서가 도착했어요 💌';

  if(navigator.share){
    try{
      await navigator.share({ title:'사주엽서', text:shareText, url:shareUrl });
      return;
    }catch(err){
      if(err && err.name === 'AbortError') return;
      // 공유 실패 시 아래 클립보드 복사로 대체
    }
  }
  try{
    await navigator.clipboard.writeText(shareUrl);
    showToast('링크를 복사했어요. 친구에게 붙여넣어 보내보세요!');
  }catch(err){
    showToast(shareUrl);
  }
});

/* =======================================================
   공유 링크로 들어온 경우 자동으로 결과 열기
   ======================================================= */
(function initFromShareLink(){
  const params = new URLSearchParams(location.search);
  const b = params.get('b');
  if(!b || !/^\d{8}$/.test(b)) return;
  openedViaShareLink = true;

  const y = Number(b.slice(0,4)), mo = Number(b.slice(4,6)), d = Number(b.slice(6,8));
  const hRaw = params.get('h');
  const hasTime = !!(hRaw && /^\d{4}$/.test(hRaw));
  const h = hasTime ? Number(hRaw.slice(0,2)) : 12;
  const mi = hasTime ? Number(hRaw.slice(2,4)) : 0;
  const trueSolar = params.get('s') !== '0';
  const name = params.get('n') || '';
  const ownerLabel = name || '이 사람';

  document.getElementById('compareIntro').textContent = `${ownerLabel}의 사주와 내 사주를 비교해보려면, 내 생년월일을 넣어보세요.`;

  // 링크로 들어온 경우 폼은 숨기고 공유한 사람의 결과만 보여줌
  document.getElementById('formCard').style.display = 'none';

  // 공유하기 버튼 대신 "나도 받아보기" 버튼을 주 액션으로 보여줌
  document.querySelector('.action-row').style.display = 'none';
  const tryItBtn = document.getElementById('againBtn');
  tryItBtn.textContent = '🎁 나도 사주엽서 받아보기';
  tryItBtn.classList.add('share-btn');
  tryItBtn.style.width = '100%';

  // 공유 링크로 들어온 사람에게만 궁합 보기를 보여주고, 결과 카드 맨 위로 옮김
  const resultCard = document.getElementById('result');
  const airmailEdge = resultCard.querySelector('.airmail-edge');
  const comparePanelEl = document.getElementById('comparePanel');
  const insertAfter = airmailEdge ? airmailEdge.nextSibling : resultCard.firstChild;
  resultCard.insertBefore(comparePanelEl, insertAfter);
  comparePanelEl.classList.add('open');

  document.getElementById('fdate').value = `${b.slice(0,4)}-${b.slice(4,6)}-${b.slice(6,8)}`;
  document.getElementById('fname').value = name;
  document.getElementById('trueSolar').checked = trueSolar;
  if(hasTime){
    timeInput.value = `${pad2(h)}:${pad2(mi)}`;
    noTimeChk.checked = false;
    timeInput.disabled = false;
  } else {
    noTimeChk.checked = true;
    timeInput.disabled = true;
  }

  const res = computeSaju({y,mo,d,h,mi,hasTime,trueSolar});
  render(res, {y,mo,d,h,mi,hasTime,name});
})();

/* =======================================================
   이전에 만든 결과 자동 불러오기 (공유 링크가 아닌 재방문일 때)
   ======================================================= */
(function restoreSelfEntry(){
  if(openedViaShareLink) return;
  const saved = loadSelfEntry();
  if(!saved) return;
  const { y, mo, d, h, mi, hasTime, trueSolar, name } = saved;

  document.getElementById('fdate').value = `${y}-${pad2(mo)}-${pad2(d)}`;
  document.getElementById('fname').value = name || '';
  document.getElementById('trueSolar').checked = trueSolar;
  if(hasTime){
    timeInput.value = `${pad2(h)}:${pad2(mi)}`;
    noTimeChk.checked = false;
    timeInput.disabled = false;
  } else {
    noTimeChk.checked = true;
    timeInput.disabled = true;
  }

  const res = computeSaju(saved);
  render(res, saved);
})();
