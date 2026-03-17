/** TFT 게임 데이터의 HTML/플레이스홀더 태그를 제거하여 순수 텍스트로 변환 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/@\w+@/g, '').replace(/%i:\w+%/g, '');
}
