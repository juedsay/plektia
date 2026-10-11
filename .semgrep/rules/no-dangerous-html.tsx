declare const html: string;

// ruleid: plektia-no-dangerous-html
export const unsafeBio = <div dangerouslySetInnerHTML={{ __html: html }} />;

// ok: plektia-no-dangerous-html
export const safeBio = <div>{html}</div>;
