const CAPABILITIES = {
  instagram: {
    name: "Instagram",
    automated: true,
    contract: "컨테이너 생성 → 준비 상태 확인 → media_publish",
    requirements: ["프로페셔널 계정", "instagram_business_content_publish", "공개 미디어 URL"],
    metricSource: "Instagram Media Insights"
  },
  naver: {
    name: "네이버 블로그",
    automated: false,
    contract: "HTML·이미지 패키지 내보내기 → 사람 검수·게시",
    requirements: ["공식 글쓰기 API 미제공", "검색 API는 조사·모니터링에만 사용"],
    metricSource: "검색 결과·UTM·사이트 분석"
  },
  blogger: {
    name: "Google Blogger",
    automated: true,
    contract: "posts.insert → 필요 시 posts.publish",
    requirements: ["Google OAuth", "blogId", "blogger scope"],
    metricSource: "Blogger + 연결된 웹분석"
  },
  threads: {
    name: "Threads",
    automated: true,
    contract: "미디어 컨테이너 생성 → threads_publish",
    requirements: ["Meta 앱 Threads 유스케이스", "OAuth 토큰"],
    metricSource: "Threads Insights"
  },
  youtube: {
    name: "YouTube Shorts",
    automated: true,
    contract: "영상 렌더 → resumable videos.insert → 처리 상태 확인",
    requirements: ["YouTube OAuth", "API 프로젝트 감사", "세로 영상 파일"],
    metricSource: "YouTube Analytics API"
  }
};

function getCapabilities() {
  return Object.entries(CAPABILITIES).map(([id, value]) => ({ id, ...value }));
}

async function publishDryRun({ job, content }) {
  const capability = CAPABILITIES[job.channel];
  if (!capability) throw new Error(`지원하지 않는 채널: ${job.channel}`);

  if (!capability.automated) {
    return {
      status: "awaiting_manual_publish",
      externalId: `export_${job.id}`,
      externalUrl: `/exports/${job.id}.html`,
      message: `${capability.name} 게시용 원고 패키지를 생성했습니다.`
    };
  }

  return {
    status: "published",
    externalId: `demo_${job.channel}_${Date.now()}`,
    externalUrl: `https://example.invalid/${job.channel}/${job.id}`,
    message: `${capability.name} 데모 게시가 완료되었습니다.`
  };
}

module.exports = { getCapabilities, publishDryRun };
