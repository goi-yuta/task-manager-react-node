/* HTML文字列からタグを除去し、プレーンテキストを返す */
export const stripHtmlTags = (htmlString: string | null | undefined): string => {
  if (!htmlString) return '';

  // 1. <br> や <p> などのブロック要素の前に改行を入れる（テキストが繋がってしまうのを防ぐ）
  let text = htmlString.replace(/<br\s*[\/]?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');

  // 2. 残りのすべてのHTMLタグ（<...>）を除去する
  text = text.replace(/<[^>]*>?/gm, '');

  // 3. HTMLエンティティをデコードする（&amp; は二重デコードを防ぐため必ず最後）
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&apos;/g, "'");
  //    数値文字参照 (&#39; や &#x27; 形式)
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16))
  );
  text = text.replace(/&#(\d+);/g, (_, dec) =>
    String.fromCodePoint(parseInt(dec, 10))
  );
  text = text.replace(/&amp;/g, '&');

  // 4. 先頭と末尾の余分な空白・改行を削除
  return text.trim();
};
