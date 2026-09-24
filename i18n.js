// Interface translation only. Customer reviews, replies and source notes remain verbatim.
const TRANSLATIONS = {
  '리뷰 운영 대시보드': ['Review operations', '评价管理看板', 'レビュー管理'],
  '본문으로 건너뛰기': ['Skip to content', '跳转到正文', '本文へ移動'],
  '새로고침': ['Refresh', '刷新', '更新'],
  '불러오는 중…': ['Refreshing…', '正在刷新…', '更新中…'],
  '시트 연결 중': ['Connecting to sheets', '正在连接表格', 'シート接続中'],
  '시트 갱신 중': ['Refreshing sheets', '正在更新表格', 'シート更新中'],
  '연결 원본': ['Source', '数据来源', 'データ元'],
  '최종 반영 시간 확인 중': ['Checking freshness', '正在检查更新时间', '更新日時を確認中'],
  '원본 시트 열기': ['Open source workbook', '打开原始表格', '元のシートを開く'],
  '대시보드 보기': ['Dashboard views', '看板视图', '表示切り替え'],
  '운영 현황': ['Operations', '工作状态', '運用状況'],
  '리뷰 통계': ['Review analytics', '评价统计', 'レビュー統計'],
  '운영 현황 필터': ['Filters', '筛选条件', '絞り込み'],
  '조회 기간': ['Date range', '时间范围', '表示期間'],
  '7일': ['7 days', '7天', '7日間'],
  '30일': ['30 days', '30天', '30日間'],
  '전체': ['All', '全部', 'すべて'],
  '플랫폼': ['Platform', '平台', 'プラットフォーム'],
  '전체 플랫폼': ['All platforms', '全部平台', 'すべてのプラットフォーム'],
  '처리 상태': ['Status', '处理状态', '対応状況'],
  '전체 상태': ['All statuses', '全部状态', 'すべての状態'],
  '답글 완료': ['Replied', '已回复', '返信済み'],
  'AI 답글 보류': ['AI reply on hold', 'AI暂缓回复', 'AI返信保留'],
  '확인 필요': ['Needs checking', '待确认', '要確認'],
  '리뷰·답글 검색': ['Search reviews & replies', '搜索评价与回复', 'レビュー・返信を検索'],
  '시술명, 리뷰 번호, 내용': ['Treatment, review ID, content', '项目名称、评价编号、内容', '施術名・レビュー番号・内容'],
  '핵심 운영 지표': ['Key metrics', '关键指标', '主要指標'],
  '확인된 리뷰·문의': ['Recorded reviews & inquiries', '已记录评价与咨询', '記録済みレビュー・問い合わせ'],
  '선택 기간 기준': ['Selected date range', '所选时间范围', '選択期間の集計'],
  '완료율 계산 중': ['Calculating reply rate', '正在计算回复率', '返信率を計算中'],
  '담당자 확인이 필요한 건': ['Awaiting staff review', '需要负责人确认', '担当者の確認が必要'],
  '답글 또는 상태가 미확인된 건': ['Reply or status unconfirmed', '回复或状态尚未确认', '返信または状態が未確認'],
  'AI가 답글을 보류한 리뷰': ['Reviews awaiting staff review', 'AI暂缓回复的评价', 'AIが返信を保留したレビュー'],
  '답글을 달지 않은 이유를 확인해 주세요.': ['Check why the AI has not replied.', '请查看AI未回复的原因。', 'AIが返信しなかった理由をご確認ください。'],
  'AI가 답글을 보류한 리뷰를 확인하고 있습니다.': ['Loading reviews on hold.', '正在加载暂缓回复的评价。', '返信保留のレビューを読み込み中です。'],
  '최근 리뷰 처리 내역': ['Recent review activity', '最近评价处理记录', '最近のレビュー対応履歴'],
  '불러오는 중': ['Loading', '加载中', '読み込み中'],
  '일시': ['Date', '日期时间', '日時'],
  '리뷰·문의': ['Review / inquiry', '评价／咨询', 'レビュー・問い合わせ'],
  '게시 답글': ['Published reply', '已发布回复', '投稿済み返信'],
  '상태': ['Status', '状态', '状態'],
  '워크시트에서 데이터를 불러오고 있습니다.': ['Loading data from the workbook.', '正在从工作表加载数据。', 'ワークシートから読み込み中です。'],
  '플랫폼별 처리 흐름': ['Platform performance', '各平台处理情况', 'プラットフォーム別対応状況'],
  '플랫폼별 처리 현황': ['Status by platform', '各平台处理状态', 'プラットフォーム別の状態'],
  '답글 완료, 보류, 확인 필요 건을 비교합니다.': ['Compare replied, on-hold and unconfirmed records.', '比较已回复、暂缓和待确认的记录。', '返信済み・保留・要確認の件数を比較します。'],
  '차트 범례': ['Chart legend', '图例', '凡例'],
  '전체 처리 비율': ['Status breakdown', '处理状态占比', '対応状況の割合'],
  '선택 기간의 상태 분포': ['Status in the selected date range', '所选期间的状态分布', '選択期間の状態分布'],
  '최근 14일 처리 추이': ['Records over the past 14 days', '近14天记录趋势', '直近14日間の記録推移'],
  '워크시트에 기록된 날짜를 기준으로 집계합니다.': ['Grouped by the date recorded in the workbook.', '按工作表中记录的日期汇总。', 'ワークシートに記録された日付で集計します。'],
  '누가 답글을 달았나요?': ['Who replied?', '谁回复了评价？', '誰が返信しましたか？'],
  '현재 선택 조건 · 시트에 기록된 작성 주체 기준': ['Current filters · authorship recorded in the sheet', '当前筛选条件 · 以表格记录的回复者为准', '現在の絞り込み条件・シートに記録された返信者'],
  'AI 답글': ['AI replies', 'AI回复', 'AIの返信'],
  '담당자 직접 답글': ['Staff replies', '人工回复', '担当者の返信'],
  '저평점 리뷰': ['Low-rated reviews', '低评分评价', '低評価レビュー'],
  '평균 평점': ['Average rating', '平均评分', '平均評価'],
  '저평점: 공개 평점 5점 기준 3.5점 이하. 문의는 평점 집계에서 제외합니다.': ['Low rating: 3.5 or below on the public 5-point scale. Inquiries are excluded from ratings.', '低评分：公开5分制评分不高于3.5分。咨询不计入评分统计。', '低評価：公開評価5点満点で3.5点以下。問い合わせは評価集計の対象外です。'],
  '플랫폼 요약': ['Platform summary', '平台概览', 'プラットフォーム概要'],
  '처리량과 완료율을 함께 확인합니다.': ['Record count and reply rate.', '记录数量与回复率。', '記録件数と返信率を確認できます。'],
  '통계는 원본 시트에서 식별 가능한 리뷰·문의 행을 기준으로 하며, 점검 요약 행과 중복 리뷰 ID는 제외합니다.': ['Based on identifiable reviews and inquiries in the source sheet. Check summaries and duplicate IDs are excluded.', '统计基于原始表格中可识别的评价和咨询；检查汇总行及重复ID不计入。', '元シートの識別可能なレビュー・問い合わせを集計します。点検概要行と重複IDは除外します。'],
  '워크시트 연결형 읽기 전용 대시보드': ['Read-only dashboard connected to the workbook', '连接工作表的只读看板', 'ワークシート連携・閲覧専用ダッシュボード'],
  '자동 새로고침': ['Automatic refresh', '自动刷新', '自動更新'],
  '1분': ['1 minute', '1分钟', '1分'],
  '라이트 모드': ['Light mode', '浅色模式', 'ライトモード'],
  '다크 모드': ['Dark mode', '深色模式', 'ダークモード'],
  '선택 조건에 AI가 답글을 보류한 리뷰가 없습니다.': ['No reviews on hold match these filters.', '当前筛选条件下没有AI暂缓回复的评价。', '選択条件に一致する返信保留のレビューはありません。'],
  '선택한 조건에 해당하는 기록이 없습니다.': ['No records match these filters.', '没有符合筛选条件的记录。', '条件に一致する記録はありません。'],
  '표시할 플랫폼 통계가 없습니다.': ['No platform data to display.', '没有可显示的平台数据。', '表示するプラットフォーム統計がありません。'],
  '표시할 요약이 없습니다.': ['No summary available.', '暂无汇总数据。', '表示する概要がありません。'],
  '내용 미기록': ['Content not recorded', '内容未记录', '内容未記録'],
  '답글 미기록': ['Reply not recorded', '回复未记录', '返信未記録'],
  '원문 내용이 기록되지 않았습니다.': ['Original content was not recorded.', '原文内容未记录。', '原文は記録されていません。'],
  '담당자 확인 필요': ['Staff review needed', '需要负责人确认', '担当者の確認が必要'],
  '평점 없음': ['No rating', '暂无评分', '評価なし'],
  '일시 미기록': ['Date not recorded', '日期未记录', '日時未記録'],
  '전체 기간': ['All time', '全部时间', '全期間'],
  '최근 {days}일': ['Last {days} days', '近{days}天', '直近{days}日間'],
  '{n}건': ['{n}', '{n}条', '{n}件'],
  '{period} · 현재 필터 기준': ['{period} · current filters', '{period} · 当前筛选条件', '{period}・現在の絞り込み条件'],
  '완료율 {rate}%': ['Reply rate {rate}%', '回复率 {rate}%', '返信率 {rate}%'],
  '{period} 기준': ['{period}', '{period}', '{period}'],
  '{total}건 중 최근 {shown}건': ['Latest {shown} of {total} records', '共{total}条，显示最近{shown}条', '{total}件中、直近{shown}件'],
  '답글 작성 주체 미확인 {unknown}건 · 평점 기록 {rated}건 / 리뷰 {reviews}건': ['Author unknown: {unknown} · Rated: {rated} / {reviews} reviews', '回复者未确认：{unknown}条 · 有评分：{rated}／{reviews}条评价', '返信者不明 {unknown}件・評価あり {rated}件／レビュー {reviews}件'],
  '최근 갱신: {time}': ['Last refreshed: {time}', '最近刷新：{time}', '最終更新：{time}'],
  '최근 갱신: 데이터 연결 중': ['Last refreshed: connecting', '最近刷新：正在连接数据', '最終更新：データ接続中'],
  '{time} 반영': ['Updated {time}', '更新于 {time}', '{time} 更新'],
  ' · 일부 탭만 갱신': [' · partial update', ' · 部分更新', '・一部のみ更新'],
  '{seconds}초 후 새로고침': ['Refresh in {seconds}s', '{seconds}秒后可刷新', '{seconds}秒後に更新可能'],
  '{count}/{total}개 탭 연결': ['{count}/{total} sheets connected', '已连接{count}／{total}个表格', '{count}/{total}シート接続'],
  '6개 탭 연결됨': ['6 sheets connected', '已连接6个表格', '6シート接続済み'],
  '일부 시트 데이터를 불러오지 못했습니다.': ['Some sheet data could not be loaded.', '部分表格数据加载失败。', '一部のシートを読み込めませんでした。'],
  '원본 시트의 공유 설정을 확인한 뒤 다시 시도해 주세요.': ['Check source sharing settings and try again.', '请检查原始表格的共享设置后重试。', '元シートの共有設定を確認して再試行してください。'],
  '시트 연결 실패': ['Sheet connection failed', '表格连接失败', 'シート接続失敗'],
  '응답 시간 초과': ['Request timed out', '请求超时', 'タイムアウト'],
  '시트 응답 오류': ['Invalid sheet response', '表格响应异常', 'シート応答エラー'],
  '플랫폼별 답글 처리 현황 막대 차트': ['Reply status by platform, bar chart', '各平台回复状态柱状图', 'プラットフォーム別返信状況の棒グラフ'],
  '전체 답글 처리 비율 도넛 차트': ['Reply status breakdown, donut chart', '回复状态占比环形图', '返信状況のドーナツグラフ'],
  '최근 14일 리뷰 처리 추이 차트': ['Review records over 14 days', '近14天评价记录趋势图', '直近14日間のレビュー記録推移'],
  '차트 설명': ['{name}: total {total}, replied {completed}, on hold {hold}, needs checking {pending}', '{name}：共{total}条，已回复{completed}条，暂缓{hold}条，待确认{pending}条', '{name}：全{total}件、返信済み{completed}件、保留{hold}件、要確認{pending}件'],
};
const PLATFORM_TRANSLATIONS = {
  '강남언니': ['Gangnam Unni', '江南姐姐', 'カンナムオンニ'],
  '바비톡': ['Babitalk', 'Babitalk', 'バビトーク'],
  '여신티켓': ['Yeoshin Ticket', '女神票', 'ヨシンチケット'],
  '카카오리뷰': ['Kakao reviews', 'Kakao评价', 'Kakaoレビュー'],
  '여신티켓 시술문의': ['Yeoshin inquiries', '女神票项目咨询', 'ヨシン施術問い合わせ'],
  '강남언니 Q&A': ['Gangnam Unni Q&A', '江南姐姐问答', 'カンナムオンニQ&A'],
};
let language = 'ko';
try { const saved = localStorage.getItem('review-ops-language'); if (['ko', 'en', 'zh', 'ja'].includes(saved)) language = saved; } catch (_) {}
const localeForLanguage = () => ({ ko: 'ko-KR', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP' })[language];
function t(key, values = {}) {
  const index = ['en', 'zh', 'ja'].indexOf(language);
  let result = index < 0 ? key : (TRANSLATIONS[key]?.[index] ?? key);
  return result.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
}
function platformName(value) {
  const index = ['en', 'zh', 'ja'].indexOf(language);
  return index < 0 ? value : (PLATFORM_TRANSLATIONS[value]?.[index] ?? value);
}
const staticTextBindings = [];
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (walker.nextNode()) {
  const node = walker.currentNode;
  if (node.parentElement.closest('script,style,#language-select')) continue;
  const key = node.textContent.trim();
  if (TRANSLATIONS[key]) staticTextBindings.push({ node, key });
}
const staticAttributeBindings = [];
document.querySelectorAll('[aria-label],[placeholder]').forEach((element) => {
  for (const attribute of ['aria-label', 'placeholder']) {
    const key = element.getAttribute(attribute);
    if (TRANSLATIONS[key]) staticAttributeBindings.push({ element, attribute, key });
  }
});
function translateInterface() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
  document.title = t('리뷰 운영 대시보드');
  staticTextBindings.forEach(({ node, key }) => { node.textContent = t(key); });
  staticAttributeBindings.forEach(({ element, attribute, key }) => element.setAttribute(attribute, t(key)));
  document.querySelector('#language-select').value = language;
}
translateInterface();
