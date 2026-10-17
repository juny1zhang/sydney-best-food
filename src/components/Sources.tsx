interface Props {
  sources: string[];
  accolades?: string[];
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Collapsed list of where a place's rating comes from. */
export function Sources({ sources, accolades = [] }: Props) {
  if (!sources.length) return null;
  return (
    <details className="sources">
      <summary>评价依据（{sources.length}）</summary>
      {accolades.length > 0 && (
        <ul>
          {accolades.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <ul className="sources__links">
        {sources.map((s) => (
          <li key={s}>
            <a href={s} target="_blank" rel="noreferrer">
              {hostOf(s)}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
