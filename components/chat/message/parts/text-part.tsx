type TextPartProps = {
  text: string;
};

export function TextPart({ text }: TextPartProps) {
  return <p className="text-foreground">{text}</p>;
}
