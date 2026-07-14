// types/modules.d.ts
declare module 'translate-google' {
  interface TranslateOptions {
    to?: string;
    from?: string;
  }
  
  function translate(text: string, options?: TranslateOptions): Promise<string>;
  
  export = translate;
}