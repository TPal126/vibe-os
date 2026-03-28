interface DotProps {
  color?: string;
  pulse?: boolean;
}

export function Dot({ color = "bg-v-green", pulse = false }: DotProps) {
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full ${color} inline-block shrink-0${pulse ? " animate-dot-pulse" : ""}`}
    />
  );
}
