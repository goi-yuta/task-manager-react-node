/* HTML文字列からタグを除去し、プレーンテキストを返す */
export const stripHtmlTags = (htmlString: string | null | undefined): string => {
  if (!htmlString) return '';

  // 1. <br> や <p> などのブロック要素の前に改行を入れる（テキストが繋がってしまうのを防ぐ）
  let text = htmlString.replace(/<br\s*[\/]?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');

  // 2. 残りのすべてのHTMLタグ（<...>）を除去する
  text = text.replace(/<[^>]*>?/gm, '');

  // 3. HTMLエンティティ（&nbsp; など）をデコードする（簡易版）
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');

  // 4. 先頭と末尾の余分な空白・改行を削除
  return text.trim();
};
