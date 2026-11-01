import type { ReactNode } from "react";

const P: Record<string, ReactNode> = {
  home: <path d="M3 11 12 3l9 8v10H3z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 4a3.5 3.5 0 0 1 0 7M22 21c0-3-2-5-5-5.5" /></>,
  book: <><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" /><path d="M8 8h8M8 12h8" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18M16 15h2" /></>,
  star: <path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4 6.4 20.3l1.1-6.2L3 9.7l6.2-.9z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  inbox: <><path d="M3 13l3-8h12l3 8v6H3z" /><path d="M3 13h5l1 3h6l1-3h5" /></>,
  check: <path d="m5 12 5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  note: <><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h7M9 16h5" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></>,
  out: <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  set: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
};

export function Ic({ n, s = 18 }: { n: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[n]}
    </svg>
  );
}

export function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 2 9 2 12 0v-5" />
    </svg>
  );
}

export function Empty({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return <div className="empty"><Ic n={icon} s={36} /><div><b>{title}</b></div><div>{sub}</div></div>;
}
