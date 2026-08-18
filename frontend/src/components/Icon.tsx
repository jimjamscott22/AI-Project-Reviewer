interface IconProps {
  n: string;
  size?: number;
  w?: 'fill' | null;
  style?: React.CSSProperties;
}

export function Icon({ n, size = 16, w, style }: IconProps) {
  return <i className={'ph' + (w ? '-' + w : '') + ' ph-' + n} style={{ fontSize: size, lineHeight: 1, ...style }} />;
}
