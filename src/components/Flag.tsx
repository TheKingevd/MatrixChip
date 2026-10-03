export function Flag({ code, name, className }: { code: string; name: string; className?: string }) {
  const cc = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w80/${cc}.png`}
      srcSet={`https://flagcdn.com/w160/${cc}.png 2x`}
      alt={`Bandeira de ${name}`}
      loading="lazy"
      decoding="async"
      className={className ?? "inline-block h-5 w-7 rounded-[3px] object-cover shadow-sm"}
    />
  );
}
