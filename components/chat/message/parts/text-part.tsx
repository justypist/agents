import { Streamdown } from 'streamdown';

type TextPartProps = {
  text: string;
};

export function TextPart({ text }: TextPartProps) {
  return (
    <Streamdown
      dir="auto"
      mode="streaming"
      className={[
        'text-foreground',
        '[&>blockquote]:border-l',
        '[&>blockquote]:border-border',
        '[&>blockquote]:pl-4',
        '[&>blockquote]:text-muted-foreground',
        '[&>h1]:text-2xl',
        '[&>h1]:font-semibold',
        '[&>h2]:text-xl',
        '[&>h2]:font-semibold',
        '[&>h3]:text-lg',
        '[&>h3]:font-semibold',
        '[&>ol]:list-decimal',
        '[&>ol]:pl-6',
        '[&>ul]:list-disc',
        '[&>ul]:pl-6',
        '[&>pre]:overflow-x-auto',
        '[&>pre]:rounded-md',
        '[&>pre]:border',
        '[&>pre]:border-border',
        '[&>pre]:bg-background',
        '[&>pre]:p-3',
        '[&>table]:w-full',
        '[&>table]:border-collapse',
        '[&>table_th]:border',
        '[&>table_th]:border-border',
        '[&>table_th]:px-3',
        '[&>table_th]:py-2',
        '[&>table_th]:text-left',
        '[&>table_td]:border',
        '[&>table_td]:border-border',
        '[&>table_td]:px-3',
        '[&>table_td]:py-2',
        '[&>*+*]:mt-3',
      ].join(' ')}
    >
      {text}
    </Streamdown>
  );
}
